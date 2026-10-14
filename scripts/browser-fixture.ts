import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../apps/admin/store.ts';
import {
  emptyLibrary,
  type Library,
  type PublicContent,
} from '../packages/shared/src/index.ts';
const target = join(ROOT, '.local/browser-fixture');
await rm(target, { recursive: true, force: true });
await mkdir(join(target, 'originals'), { recursive: true });
const publicData = JSON.parse(
  await readFile(join(ROOT, 'content/gallery.json'), 'utf8'),
) as PublicContent;
const library: Library = {
  ...emptyLibrary(),
  ...publicData,
  revision: 0,
  photos: publicData.photos.map((p) => ({
    ...p,
    originalFile: `${p.id}.webp`,
    location: {
      ...p.location,
      city: p.location.city ?? '',
      label: p.location.label ?? '',
      confirmPrecise: p.location.privacy === 'precise',
      ...(p.location.privacy === 'city'
        ? {
            cityLatitude: p.location.latitude,
            cityLongitude: p.location.longitude,
          }
        : {}),
    },
  })),
};
await writeFile(join(target, 'library.json'), JSON.stringify(library));
await cp(join(ROOT, 'public/images'), join(target, 'processed'), {
  recursive: true,
});
for (const p of library.photos)
  await copyFile(
    join(target, 'processed', p.variants.at(-1)!.file),
    join(target, 'originals', p.originalFile),
  );
console.log(
  'Browser tests use isolated copies of public images; real local originals are untouched.',
);
