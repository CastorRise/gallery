import { locked, readLibrary } from '../apps/admin/store.ts';
import { generate } from './publication.ts';
await locked(async () => {
  const data = await readLibrary();
  if (data.photos.length === 0)
    throw Error('本地图库为空，拒绝覆盖公开内容；CI 请运行 build:web');
  const content = await generate(data);
  console.log(
    `公开内容：${content.photos.length} 张照片，${content.collections.length} 个专题，${content.journals.length} 篇故事`,
  );
});
