import express from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ZodError } from 'zod';
import {
  MAX_BYTES,
  processImage,
} from '../../packages/image-processing/src/index.ts';
import { idSchema, librarySchema } from '../../packages/shared/src/index.ts';
import {
  command,
  confirmPublish,
  gitStatus,
  previewPublish,
} from '../../scripts/publication.ts';
import {
  backupLibrary,
  listBackups,
  LOCAL,
  locked,
  paths,
  readLibrary,
  restoreBackup,
  ROOT,
  saveLibrary,
} from './store.ts';
export function createApp(port = 4173) {
  const app = express();
  const csrf = randomBytes(32).toString('hex');
  const expected = `http://127.0.0.1:${port}`;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.headers.host !== `127.0.0.1:${port}`) {
      res.status(403).json({ error: '只允许 127.0.0.1 本地访问' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (
        (req.headers.origin && req.headers.origin !== expected) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      ) {
        res.status(403).json({ error: 'Origin 校验失败' });
        return;
      }
      if (
        !['GET', 'HEAD'].includes(req.method) &&
        (req.headers.origin !== expected ||
          req.headers['x-gallery-csrf'] !== csrf)
      ) {
        res.status(403).json({ error: '本地会话已失效，请刷新后台' });
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '8mb' }));
  app.get('/api/session', (_req, res) => res.json({ csrf }));
  app.get('/api/library', async (_req, res) => res.json(await readLibrary()));
  app.put('/api/library', async (req, res) => {
    const data = librarySchema.parse(req.body);
    res.json(await locked(() => saveLibrary(data, data.revision)));
  });
  app.get('/api/dashboard', async (_req, res) => {
    const data = await readLibrary();
    let build: unknown = { ok: false, builtAt: null };
    try {
      build = JSON.parse(
        await readFile(join(LOCAL, 'build-status.json'), 'utf8'),
      );
    } catch {}
    res.json({
      total: data.photos.length,
      published: data.photos.filter((p) => p.status === 'published').length,
      drafts: data.photos.filter((p) => p.status === 'draft').length,
      collections: data.collections.length,
      journals: data.journals.length,
      build,
      git: await gitStatus(),
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1, parts: 3 },
  });
  app.post('/api/import', upload.array('photos', 1), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) throw Error('请选择照片');
    const successes: string[] = [];
    const errors: { name: string; message: string }[] = [];
    await locked(async () => {
      let data = await readLibrary();
      for (const f of files) {
        try {
          const result = await processImage(
            f.buffer,
            paths.processed,
            paths.originals,
          );
          const { gps, ...image } = result;
          data = {
            ...data,
            photos: [
              ...data.photos,
              {
                ...image,
                title: f.originalname.replace(/\.[^.]+$/, ''),
                description: '',
                alt: f.originalname.replace(/\.[^.]+$/, ''),
                status: 'draft',
                featured: false,
                categoryId:
                  data.categories.find((c) => c.id === 'other')?.id ??
                  data.categories[0].id,
                order: data.photos.length,
                createdAt: new Date().toISOString(),
                location: {
                  privacy: 'hidden',
                  city: '',
                  label: '',
                  confirmPrecise: false,
                  ...gps,
                },
              },
            ],
          };
          data = await saveLibrary(data, data.revision);
          successes.push(image.id);
        } catch (e) {
          errors.push({ name: f.originalname, message: (e as Error).message });
        }
      }
    });
    res.json({ successes, errors, library: await readLibrary() });
  });
  app.get('/api/images/:id/:size', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    if (!/^\d+\.webp$/.test(req.params.size)) throw Error('图片路径无效');
    const data = await readLibrary();
    const file = `${id}/${req.params.size}`;
    if (
      !data.photos.some(
        (p) => p.id === id && p.variants.some((v) => v.file === file),
      )
    ) {
      res.status(404).end();
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(file, { root: paths.processed, dotfiles: 'allow' });
  });
  app.post('/api/archive', async (req, res) => {
    if (req.body.confirm !== true || !Array.isArray(req.body.ids))
      throw Error('归档需要明确确认');
    const ids = req.body.ids.map((id: unknown) => idSchema.parse(id));
    const data = await locked(async () => {
      const current = await readLibrary();
      const photos = current.photos.map((p) =>
        ids.includes(p.id) ? { ...p, status: 'archived' as const } : p,
      );
      const collections = current.collections.map((c) => ({
        ...c,
        photoIds: c.photoIds.filter((id) => !ids.includes(id)),
        coverId: c.coverId && ids.includes(c.coverId) ? undefined : c.coverId,
      }));
      const journals = current.journals.map((j) => ({
        ...j,
        coverId: j.coverId && ids.includes(j.coverId) ? undefined : j.coverId,
        blocks: j.blocks.map((b) => ({
          ...b,
          photoIds: b.photoIds.filter((id) => !ids.includes(id)),
        })),
      }));
      const settings = {
        ...current.settings,
        homeCoverId:
          current.settings.homeCoverId &&
          ids.includes(current.settings.homeCoverId)
            ? photos.find((p) => p.status === 'published')?.id
            : current.settings.homeCoverId,
      };
      return saveLibrary(
        { ...current, photos, collections, journals, settings },
        req.body.revision,
      );
    });
    res.json(data);
  });
  app.get('/api/backups', async (_req, res) => res.json(await listBackups()));
  app.post('/api/backups', async (_req, res) =>
    res.json({
      id: await locked(async () => backupLibrary(await readLibrary())),
    }),
  );
  app.post('/api/restore', async (req, res) => {
    if (req.body.confirm !== true) throw Error('恢复需要明确确认');
    res.json(await locked(() => restoreBackup(req.body.id)));
  });
  app.post('/api/export', async (_req, res) => {
    await mkdir(LOCAL, { recursive: true, mode: 0o700 });
    await mkdir(join(LOCAL, 'exports'), { recursive: true });
    const name = `gallery-${Date.now()}.tar.gz`;
    await locked(async () => {
      const data = await readLibrary();
      await writeFile(paths.library, JSON.stringify(data, null, 2), {
        flag: 'wx',
        mode: 0o600,
      }).catch((error) => {
        if (error.code !== 'EEXIST') throw error;
      });
      for (const dir of [paths.originals, paths.processed, paths.backups])
        await mkdir(dir, { recursive: true, mode: 0o700 });
      await command('tar', [
        '-czf',
        join(LOCAL, 'exports', name),
        '-C',
        LOCAL,
        'library.json',
        'originals',
        'processed',
        'backups',
      ]);
    });
    res.json({ url: `/api/exports/${name}` });
  });
  app.get('/api/exports/:name', (req, res) => {
    if (!/^gallery-\d+\.tar\.gz$/.test(req.params.name)) {
      res.status(400).end();
      return;
    }
    res.download(join(LOCAL, 'exports', req.params.name), req.params.name, {
      dotfiles: 'allow',
    });
  });
  app.post('/api/publish/preview', async (_req, res) =>
    res.json(
      await locked(async () => {
        try {
          return await previewPublish();
        } catch (error) {
          await mkdir(LOCAL, { recursive: true });
          await writeFile(
            join(LOCAL, 'build-status.json'),
            JSON.stringify({ ok: false, builtAt: new Date().toISOString() }),
          );
          throw error;
        }
      }),
    ),
  );
  app.post('/api/publish/confirm', async (req, res) =>
    res.json(
      await locked(() => confirmPublish(req.body.id, req.body.confirmation)),
    ),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
  return app;
}
export function errorHandler(
  error: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  const status =
    error instanceof ZodError
      ? 400
      : 'status' in error
        ? Number(error.status)
        : 400;
  const message =
    error instanceof ZodError
      ? error.issues.map((i) => i.message).join('；')
      : error.message
          .replaceAll(ROOT, '[项目目录]')
          .replaceAll(LOCAL, '[本地数据]');
  res.status(status).json({ error: message });
}
if (process.argv[1]?.endsWith('server.ts')) {
  const port = Number(process.env.GALLERY_ADMIN_PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error('端口无效');
  const app = createApp(port);
  if (process.argv.includes('--dev')) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: join(ROOT, 'apps/admin'),
      server: { middlewareMode: true, host: '127.0.0.1' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const dist = join(ROOT, 'apps/admin/dist');
    app.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
      );
      next();
    });
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }
  app.use(errorHandler);
  app.listen(port, '127.0.0.1', () =>
    console.log(`Local Studio: http://127.0.0.1:${port}`),
  );
}
