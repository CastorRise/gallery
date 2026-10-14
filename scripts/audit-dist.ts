import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from '../apps/admin/store.ts';
const directory = join(ROOT, 'apps/web/dist');
let checked = 0;
async function audit(dir: string) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      if (['.local', 'originals', 'admin', 'backups'].includes(file.name))
        throw Error(`私有目录进入产物：${file.name}`);
      await audit(path);
    } else if (/\.(html|json|js|css|xml|txt)$/.test(file.name)) {
      const text = await readFile(path, 'utf8');
      if (
        /127\.0\.0\.1:4173|\/api\/library|originalFile|confirmPrecise|cityLatitude|cityLongitude|\/Users\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}/.test(
          text,
        )
      )
        throw Error(`产物中存在私有信息：${file.name}`);
    } else if (file.name.endsWith('.webp')) {
      const meta = await sharp(path).metadata();
      if (meta.exif || meta.xmp) throw Error('公开图片残留 EXIF / XMP');
      checked++;
    } else if (/\.(jpe?g|heic|dng|raw)$/i.test(file.name))
      throw Error('原图进入构建产物');
  }
}
await audit(directory);
console.log(`构建隔离和隐私检查通过，${checked} 张衍生图片`);
