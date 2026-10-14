import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { ROOT } from '../apps/admin/store.ts';
import {
  categorySchema,
  collectionSchema,
  journalSchema,
  photoSchema,
  settingsSchema,
} from '../packages/shared/src/index.ts';
const location = z.discriminatedUnion('privacy', [
  z.object({ privacy: z.literal('hidden') }).strict(),
  z
    .object({
      privacy: z.enum(['city', 'approximate', 'precise']),
      city: z.string().optional(),
      label: z.string().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .strict(),
]);
const schema = z
  .object({
    schemaVersion: z.literal(2),
    photos: z.array(
      photoSchema
        .omit({ originalFile: true, location: true })
        .extend({ status: z.literal('published'), location }),
    ),
    categories: z.array(categorySchema),
    collections: z.array(
      collectionSchema.extend({ status: z.literal('published') }),
    ),
    journals: z.array(journalSchema.extend({ status: z.literal('published') })),
    settings: settingsSchema,
  })
  .strict();
const content = schema.parse(
  JSON.parse(await readFile(join(ROOT, 'content/gallery.json'), 'utf8')),
);
const ids = new Set(content.photos.map((p) => p.id));
for (const p of content.photos) {
  const l = p.location;
  if (l.privacy === 'city' || l.privacy === 'approximate') {
    const factor = l.privacy === 'city' ? 10 : 100;
    for (const coordinate of [l.latitude, l.longitude])
      if (
        coordinate !== undefined &&
        Math.abs(coordinate * factor - Math.round(coordinate * factor)) > 1e-7
      )
        throw Error('公开位置坐标粒度不符');
  }
}
for (const c of content.collections)
  if (c.photoIds.some((id) => !ids.has(id)))
    throw Error('公开专题引用了未公开照片');
for (const j of content.journals)
  if (j.blocks.some((b) => b.photoIds.some((id) => !ids.has(id))))
    throw Error('公开故事引用了未公开照片');
console.log(`公开快照 schema / 状态 / 隐私 / 引用校验通过：${ids.size} 张照片`);
