import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
const testRoot = await mkdtemp(join(tmpdir(), 'gallery-api-test-'));
const local = join(testRoot, '.local');
process.env.GALLERY_DATA_DIR = local;
const { createApp, errorHandler } = await import('../apps/admin/server.ts');
const store = await import('../apps/admin/store.ts');
const port = 4191,
  base = `http://127.0.0.1:${port}`;
let server: Server,
  csrf = '',
  imported = '';
const call = (
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) =>
  fetch(`${base}/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body
      ? {
          'Content-Type': 'application/json',
          Origin: base,
          'X-Gallery-CSRF': csrf,
          ...extra,
        }
      : extra,
    body: body ? JSON.stringify(body) : undefined,
  });
before(async () => {
  const app = createApp(port);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(port, '127.0.0.1', () => resolve());
  });
  csrf = (await (await call('session')).json()).csrf;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(testRoot, { recursive: true, force: true });
});
test('API 实际绑定 loopback 并阻止跨 Origin、DNS rebinding 与无 CSRF 写入', async () => {
  assert.equal((server.address() as any).address, '127.0.0.1');
  assert.equal(
    (await call('session', undefined, { Origin: 'https://evil.example' }))
      .status,
    403,
  );
  assert.equal(
    await new Promise<number>((resolve) => {
      const req = request(
        base + '/api/session',
        { headers: { Host: 'evil.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode!);
        },
      );
      req.end();
    }),
    403,
  );
  assert.equal(
    (await call('backups', {}, { 'X-Gallery-CSRF': '' })).status,
    403,
  );
  assert.equal(
    (await call('backups', {}, { Origin: 'https://evil.example' })).status,
    403,
  );
});
test('全新空图库也能完整导出并创建正确目录', async () => {
  const response = await call('export', {});
  assert.equal(response.status, 200);
  const url = (await response.json()).url;
  assert.equal((await call(url.replace('/api/', ''))).status, 200);
  assert.equal((await store.readLibrary()).photos.length, 0);
  assert.equal((await readdir(store.paths.originals)).length, 0);
});
test('真实 multipart 导入、默认草稿和私有位置、无 EXIF 衍生图片', async () => {
  const form = new FormData();
  const image = await sharp({
    create: { width: 640, height: 480, channels: 3, background: '#82939a' },
  })
    .withExif({ IFD0: { Make: 'Canon', Model: 'EOS 700D' } })
    .jpeg()
    .toBuffer();
  form.append('photos', new Blob([image]), '真实照片.jpg');
  const res = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { Origin: base, 'X-Gallery-CSRF': csrf },
    body: form,
  });
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.successes.length, 1);
  const photo = result.library.photos[0];
  imported = photo.id;
  assert.equal(photo.status, 'draft');
  assert.equal(photo.location.privacy, 'hidden');
  assert.ok(photo.exif.camera.includes('700D'));
  const preview = await call(`images/${photo.variants[0].file}`);
  assert.equal(preview.status, 200);
  assert.equal(
    (await sharp(Buffer.from(await preview.arrayBuffer())).metadata()).exif,
    undefined,
  );
});
test('无效上传得到可见错误；非法路径不可读', async () => {
  const form = new FormData();
  form.append('photos', new Blob(['evil']), 'evil.jpg');
  const res = await fetch(`${base}/api/import`, {
    method: 'POST',
    headers: { Origin: base, 'X-Gallery-CSRF': csrf },
    body: form,
  });
  assert.equal((await res.json()).errors.length, 1);
  assert.equal((await call(`images/${imported}/library.json`)).status, 400);
  assert.ok((await call('images/%2e%2e%2f/library.json')).status >= 400);
});
test('编辑持久化、并发 revision 冲突、自动备份和恢复', async () => {
  const library = await (await call('library')).json();
  const updated = {
    ...library,
    photos: library.photos.map((p: any) => ({
      ...p,
      title: '已编辑',
      description: '<script>不可执行</script>',
    })),
  };
  const put = () =>
    fetch(`${base}/api/library`, {
      method: 'PUT',
      headers: {
        Origin: base,
        'X-Gallery-CSRF': csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updated),
    });
  assert.equal((await put()).status, 200);
  assert.equal((await put()).status, 409);
  const saved = await (await call('library')).json();
  assert.equal(saved.photos[0].title, '已编辑');
  const backupId = (await (await call('backups', {})).json()).id;
  assert.equal(
    (await call('restore', { id: '../../secret', confirm: true })).status,
    400,
  );
  assert.equal(
    (await call('restore', { id: backupId, confirm: false })).status,
    400,
  );
  assert.equal(
    (await call('restore', { id: backupId, confirm: true })).status,
    200,
  );
  assert.ok((await readdir(store.paths.backups)).length >= 3);
});
test('软删除须确认、原图仍保留、完整导出可下载、未确认不能发布', async () => {
  const data = await (await call('library')).json();
  assert.equal(
    (
      await call('archive', {
        ids: [imported],
        revision: data.revision,
        confirm: false,
      })
    ).status,
    400,
  );
  const res = await call('archive', {
    ids: [imported],
    revision: data.revision,
    confirm: true,
  });
  assert.equal(res.status, 200);
  const after = await res.json();
  assert.equal(after.photos[0].status, 'archived');
  assert.ok(
    (await readFile(join(store.paths.originals, after.photos[0].originalFile)))
      .length,
  );
  const archive = await call('export', {});
  assert.equal(archive.status, 200);
  const download = await call((await archive.json()).url.replace('/api/', ''));
  assert.equal(download.status, 200);
  assert.ok((await download.arrayBuffer()).byteLength > 100);
  assert.equal(
    (await call('publish/confirm', { id: 'invalid', confirmation: 'wrong' }))
      .status,
    400,
  );
});
