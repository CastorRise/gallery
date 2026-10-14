import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  locked,
  paths,
  readLibrary,
  saveLibrary,
} from '../apps/admin/store.ts';
import { processImage } from '../packages/image-processing/src/index.ts';
const source = process.argv[2];
if (!source) throw Error('请通过命令参数提供原站目录；导入仅执行只读复制');
const captions = await readFile(
  join(source, 'src/data/image-descriptions.ts'),
  'utf8',
);
const entries = [
  ...captions
    .split('photography: {')[1]
    .split('},')[0]
    .matchAll(/'(photo-\d+)': '([^']*)'/g),
];
await locked(async () => {
  let data = await readLibrary();
  if (data.photos.length) throw Error('初始导入仅适用于空图库，防止重复复制');
  for (const [_, stem, description] of entries) {
    const result = await processImage(
      await readFile(join(source, 'public/images/photography', `${stem}.jpg`)),
      paths.processed,
      paths.originals,
    );
    const { gps, ...image } = result;
    const index = Number(stem.slice(-2));
    const city =
      description.includes('郑州') || description.includes('航空港')
        ? '郑州'
        : description.includes('长沙')
          ? '长沙'
          : description.includes('浏阳')
            ? '浏阳'
            : '';
    const center =
      city === '郑州'
        ? [34.7, 113.6]
        : city === '长沙'
          ? [28.2, 113.0]
          : city === '浏阳'
            ? [28.2, 113.6]
            : undefined;
    const categoryId = [1, 3, 5, 6, 7].includes(index)
      ? 'weather'
      : [10, 11, 12].includes(index)
        ? 'cityscape'
        : [2, 13, 14].includes(index)
          ? 'landscape'
          : 'other';
    data.photos.push({
      ...image,
      title: description.split('，拍摄于')[0] || stem,
      description,
      alt: description || stem,
      categoryId,
      status: 'published',
      featured: [1, 2, 3, 6, 11, 14].includes(index),
      order: index - 1,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      location: {
        privacy: city ? 'city' : 'hidden',
        city,
        label: city,
        confirmPrecise: false,
        ...gps,
        ...(center
          ? { cityLatitude: center[0], cityLongitude: center[1] }
          : {}),
      },
    });
    console.log(
      `已复制 ${stem}；${image.width} × ${image.height}；EXIF ${Object.keys(image.exif).length} 个字段`,
    );
  }
  const group = (category: string) =>
    data.photos.filter((p) => p.categoryId === category).map((p) => p.id);
  data.collections = [
    ['cloud-atlas', '云图', 'Cloud Atlas', 'weather'],
    ['urban-silence', '城市静默', 'Urban Silence', 'cityscape'],
    ['light-and-shadow', '光影之间', 'Between Light and Shadow', 'landscape'],
  ].map(([id, name, englishName, cat], order) => ({
    id,
    name,
    englishName,
    description: '',
    photoIds: group(cat),
    coverId: group(cat)[0],
    status: 'published',
    createdAt: new Date().toISOString(),
    order,
  }));
  data.settings.homeCoverId = data.photos[0].id;
  await saveLibrary(data);
  console.log(
    '原有照片与说明已只读复制。城市标记为粗略城市中心，不代表拍摄坐标。',
  );
});
