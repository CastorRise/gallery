import { z } from 'zod';
export const idSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const text = (n = 2000) => z.string().max(n);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/);
export const statusSchema = z.enum(['draft', 'published', 'archived']);
export const variantSchema = z
  .object({
    width: z.number().int().positive().max(2400),
    height: z.number().int().positive(),
    file: z.string().regex(/^[a-z0-9-]+\/\d+\.webp$/),
  })
  .strict();
export const exifSchema = z
  .object({
    camera: text(200).optional(),
    lens: text(200).optional(),
    focalLength: text(80).optional(),
    aperture: text(80).optional(),
    shutterSpeed: text(80).optional(),
    iso: text(80).optional(),
    dateTaken: text(80).optional(),
  })
  .strict();
export const locationSchema = z
  .object({
    privacy: z.enum(['hidden', 'city', 'approximate', 'precise']),
    city: text(100),
    label: text(200),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    cityLatitude: z.number().min(-90).max(90).optional(),
    cityLongitude: z.number().min(-180).max(180).optional(),
    confirmPrecise: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.privacy === 'precise' &&
      (!v.confirmPrecise ||
        v.latitude === undefined ||
        v.longitude === undefined)
    )
      ctx.addIssue({
        code: 'custom',
        message: '精确位置公开必须明确确认并填写坐标',
      });
    if (
      v.privacy === 'approximate' &&
      (v.latitude === undefined || v.longitude === undefined)
    )
      ctx.addIssue({ code: 'custom', message: '近似位置需要坐标' });
  });
export const photoSchema = z
  .object({
    id: idSchema,
    title: text(200),
    description: text(6000),
    alt: text(500),
    status: statusSchema,
    featured: z.boolean(),
    categoryId: idSchema,
    order: z.number().int(),
    createdAt: date,
    publishedAt: date.optional(),
    takenAt: text(80),
    location: locationSchema,
    exif: exifSchema,
    variants: z.array(variantSchema).min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    originalFile: z.string().regex(/^[a-z0-9-]+\.(jpg|png|webp|heic)$/),
  })
  .strict();
export const categorySchema = z
  .object({ id: idSchema, name: text(80), order: z.number().int() })
  .strict();
export const collectionSchema = z
  .object({
    id: idSchema,
    name: text(200),
    englishName: text(200),
    description: text(6000),
    coverId: idSchema.optional(),
    photoIds: z.array(idSchema),
    status: statusSchema,
    createdAt: date,
    order: z.number().int(),
  })
  .strict();
export const blockSchema = z
  .object({
    id: idSchema,
    type: z.enum(['paragraph', 'quote', 'image', 'pair', 'grid']),
    text: text(12000),
    photoIds: z.array(idSchema).max(20),
    caption: text(1000),
  })
  .strict();
export const journalSchema = z
  .object({
    id: idSchema,
    title: text(200),
    subtitle: text(500),
    date: date,
    place: text(200),
    coverId: idSchema.optional(),
    status: statusSchema,
    blocks: z.array(blockSchema).max(200),
  })
  .strict();
export const settingsSchema = z
  .object({
    name: text(200),
    manifesto: text(500),
    homeCoverId: idSchema.optional(),
    bio: text(8000),
    philosophy: text(8000),
    equipment: z.array(text(200)).max(40),
    email: z.union([z.literal(''), z.email()]),
    github: z.literal('https://github.com/CastorRise'),
  })
  .strict();
export const librarySchema = z
  .object({
    schemaVersion: z.literal(2),
    revision: z.number().int().nonnegative(),
    photos: z.array(photoSchema).max(20000),
    categories: z.array(categorySchema).min(1).max(200),
    collections: z.array(collectionSchema).max(2000),
    journals: z.array(journalSchema).max(2000),
    settings: settingsSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    for (const key of [
      'photos',
      'categories',
      'collections',
      'journals',
    ] as const) {
      const ids = v[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', message: `${key} ID 重复` });
    }
    const photos = new Set(v.photos.map((p) => p.id));
    const categories = new Set(v.categories.map((c) => c.id));
    for (const p of v.photos)
      if (!categories.has(p.categoryId))
        ctx.addIssue({ code: 'custom', message: '照片引用了不存在的分类' });
    for (const c of v.collections)
      if (
        c.photoIds.some((id) => !photos.has(id)) ||
        (c.coverId && !c.photoIds.includes(c.coverId))
      )
        ctx.addIssue({ code: 'custom', message: '专题照片或封面引用无效' });
    for (const j of v.journals)
      if (
        (j.coverId && !photos.has(j.coverId)) ||
        j.blocks.some((b) => b.photoIds.some((id) => !photos.has(id)))
      )
        ctx.addIssue({ code: 'custom', message: '故事图片引用无效' });
    if (v.settings.homeCoverId && !photos.has(v.settings.homeCoverId))
      ctx.addIssue({ code: 'custom', message: '首页封面不存在' });
  });
export type Library = z.infer<typeof librarySchema>;
export type Photo = z.infer<typeof photoSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type Journal = z.infer<typeof journalSchema>;
export type Block = z.infer<typeof blockSchema>;
export type PublicPhoto = Omit<Photo, 'originalFile' | 'location'> & {
  location: {
    privacy: Photo['location']['privacy'];
    city?: string;
    label?: string;
    latitude?: number;
    longitude?: number;
  };
};
export interface PublicContent {
  schemaVersion: 2;
  photos: PublicPhoto[];
  categories: Library['categories'];
  collections: Collection[];
  journals: Journal[];
  settings: Library['settings'];
}
export function emptyLibrary(): Library {
  return {
    schemaVersion: 2,
    revision: 0,
    photos: [],
    categories: [
      'Landscape',
      'Cityscape',
      'Railway',
      'Weather',
      'Travel',
      'Other',
    ].map((name, order) => ({ id: name.toLowerCase(), name, order })),
    collections: [],
    journals: [],
    settings: {
      name: 'CastorRise',
      manifesto: '在流动的世界里，留下一瞬。',
      bio: '',
      philosophy: '',
      equipment: [
        'Canon EOS 700D',
        'Canon EF-S 55-250mm',
        'DJI Osmo Pocket 3',
        'DJI Air 3S',
      ],
      email: '',
      github: 'https://github.com/CastorRise',
    },
  };
}
export function migrate(data: unknown): Library {
  if (
    typeof data === 'object' &&
    data !== null &&
    'schemaVersion' in data &&
    data.schemaVersion === 1
  )
    return librarySchema.parse({
      ...data,
      schemaVersion: 2,
      revision: 'revision' in data ? data.revision : 0,
    });
  return librarySchema.parse(data);
}
export function publicContent(data: Library): PublicContent {
  librarySchema.parse(data);
  const photos = data.photos
    .filter((p) => p.status === 'published')
    .map((p) => {
      const { originalFile: _, location: l, ...rest } = p;
      const location: PublicPhoto['location'] = { privacy: l.privacy };
      if (l.privacy !== 'hidden') {
        location.city = l.city;
        location.label = l.privacy === 'city' ? l.city : l.label;
        if (
          l.privacy === 'city' &&
          l.cityLatitude !== undefined &&
          l.cityLongitude !== undefined
        ) {
          location.latitude = Math.round(l.cityLatitude * 10) / 10;
          location.longitude = Math.round(l.cityLongitude * 10) / 10;
        }
        if (
          l.privacy === 'approximate' &&
          l.latitude !== undefined &&
          l.longitude !== undefined
        ) {
          location.latitude = Math.round(l.latitude * 100) / 100;
          location.longitude = Math.round(l.longitude * 100) / 100;
        }
        if (l.privacy === 'precise' && l.confirmPrecise) {
          location.latitude = l.latitude;
          location.longitude = l.longitude;
        }
      }
      return { ...rest, location };
    });
  const ids = new Set(photos.map((p) => p.id));
  const collections = data.collections
    .filter((c) => c.status === 'published')
    .map((c) => ({
      ...c,
      photoIds: c.photoIds.filter((id) => ids.has(id)),
      coverId: c.coverId && ids.has(c.coverId) ? c.coverId : undefined,
    }));
  const journals = data.journals
    .filter((j) => j.status === 'published')
    .map((j) => ({
      ...j,
      coverId: j.coverId && ids.has(j.coverId) ? j.coverId : undefined,
      blocks: j.blocks
        .map((b) => ({
          ...b,
          photoIds: b.photoIds.filter((id) => ids.has(id)),
        }))
        .filter(
          (b) => ['paragraph', 'quote'].includes(b.type) || b.photoIds.length,
        ),
    }));
  return {
    schemaVersion: 2,
    photos,
    categories: data.categories,
    collections,
    journals,
    settings: {
      ...data.settings,
      homeCoverId:
        data.settings.homeCoverId && ids.has(data.settings.homeCoverId)
          ? data.settings.homeCoverId
          : undefined,
    },
  };
}
export function validatePublication(data: Library) {
  const result = publicContent(data);
  const ids = new Set(result.photos.map((p) => p.id));
  for (const p of result.photos)
    if (!p.title.trim() || !p.alt.trim())
      throw Error(`照片 ${p.id} 需要标题和 Alt 文本`);
  if (data.settings.homeCoverId && !ids.has(data.settings.homeCoverId))
    throw Error('首页封面必须是已发布照片');
  for (const c of data.collections.filter((c) => c.status === 'published'))
    if (!c.name.trim() || c.photoIds.some((id) => !ids.has(id)))
      throw Error(`专题 ${c.name} 包含未公开照片或缺少名称`);
  for (const j of data.journals.filter((j) => j.status === 'published'))
    if (
      !j.title.trim() ||
      (j.coverId && !ids.has(j.coverId)) ||
      j.blocks.some((b) => b.photoIds.some((id) => !ids.has(id)))
    )
      throw Error(`故事 ${j.title} 包含未公开照片或缺少标题`);
  const serialized = JSON.stringify(result);
  if (
    /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\/Users\/|[A-Za-z]:\\\\)/.test(
      serialized,
    )
  )
    throw Error('公开内容包含凭据模式或本地路径，请检查');
  return result;
}
