import { readLibrary } from '../apps/admin/store.ts';
import { validatePublication } from '../packages/shared/src/index.ts';
const data = await readLibrary();
const publicData = validatePublication(data);
console.log(
  `本地 ${data.photos.length} 张 / 公开 ${publicData.photos.length} 张，schema v${data.schemaVersion}`,
);
