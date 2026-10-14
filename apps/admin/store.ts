import { randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyLibrary,
  librarySchema,
  migrate,
  type Library,
} from '../../packages/shared/src/index.ts';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const LOCAL = process.env.GALLERY_DATA_DIR ?? join(ROOT, '.local');
export const paths = {
  library: join(LOCAL, 'library.json'),
  originals: join(LOCAL, 'originals'),
  processed: join(LOCAL, 'processed'),
  backups: join(LOCAL, 'backups'),
};
let queue: Promise<unknown> = Promise.resolve();
export function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}
export async function readLibrary(): Promise<Library> {
  try {
    return migrate(JSON.parse(await readFile(paths.library, 'utf8')));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyLibrary();
    throw e;
  }
}
export async function backupLibrary(data: Library) {
  await mkdir(paths.backups, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  await writeFile(
    join(paths.backups, `${id}.json`),
    JSON.stringify({ createdAt: new Date().toISOString(), data }, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  return id;
}
export async function saveLibrary(data: Library, expected?: number) {
  const previous = await readLibrary();
  if (expected !== undefined && previous.revision !== expected)
    throw Object.assign(Error('数据已发生变化，请刷新后重新编辑'), {
      status: 409,
    });
  const validated = librarySchema.parse({
    ...data,
    revision: previous.revision + 1,
  });
  await mkdir(LOCAL, { recursive: true, mode: 0o700 });
  await backupLibrary(previous);
  const tmp = `${paths.library}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(validated, null, 2), { mode: 0o600 });
  await rename(tmp, paths.library);
  return validated;
}
export async function listBackups() {
  await mkdir(paths.backups, { recursive: true, mode: 0o700 });
  return Promise.all(
    (await readdir(paths.backups))
      .filter((f) => /^[a-f0-9-]+\.json$/.test(f))
      .map(async (f) => {
        const b = JSON.parse(await readFile(join(paths.backups, f), 'utf8'));
        return {
          id: f.slice(0, -5),
          createdAt: b.createdAt,
          photos: b.data.photos.length,
        };
      }),
  ).then((a) => a.sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
}
export async function restoreBackup(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('备份 ID 无效');
  const backup = JSON.parse(
    await readFile(join(paths.backups, `${id}.json`), 'utf8'),
  );
  const data = migrate(backup.data);
  for (const p of data.photos)
    for (const v of p.variants) await readFile(join(paths.processed, v.file));
  return saveLibrary(data);
}
export async function exportPublicImages(files: string[], target: string) {
  for (const file of files) {
    if (!/^[a-z0-9-]+\/\d+\.webp$/.test(file)) throw Error('图片路径无效');
    await mkdir(join(target, file, '..'), { recursive: true });
    await copyFile(join(paths.processed, file), join(target, file));
  }
}
