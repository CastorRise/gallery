import ExifReader from 'exifreader';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Photo } from '../../shared/src/index.ts';
export const MAX_BYTES = 80 * 1024 * 1024;
export const MAX_PIXELS = 100_000_000;
export async function processImage(
  buffer: Buffer,
  directory: string,
  originals: string,
): Promise<
  Pick<
    Photo,
    'id' | 'variants' | 'width' | 'height' | 'originalFile' | 'exif' | 'takenAt'
  > & { gps?: { latitude: number; longitude: number } }
> {
  if (buffer.length > MAX_BYTES) throw Error('单张照片最大 80 MB');
  const image = sharp(buffer, {
    limitInputPixels: MAX_PIXELS,
    failOn: 'warning',
  });
  let meta;
  try {
    meta = await image.metadata();
  } catch {
    throw Error(
      '无法解码图片。RAW 不支持；HEIC 需要当前 Sharp / libvips 的 HEVC 解码支持。',
    );
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'heif'].includes(meta.format))
    throw Error('仅支持 JPEG、PNG、WebP 和环境可解码的 HEIC');
  if ((meta.pages ?? 1) > 1)
    throw Error('请导入单帧照片，暂不接受动画或多页图片');
  const id = randomUUID();
  const temp = join(directory, `.${id}`);
  await mkdir(temp, { recursive: true, mode: 0o700 });
  await mkdir(originals, { recursive: true, mode: 0o700 });
  const swap = (meta.orientation ?? 0) >= 5 && (meta.orientation ?? 0) <= 8;
  const width = swap ? meta.height! : meta.width!;
  const height = swap ? meta.width! : meta.height!;
  const widths = [480, 960, 1600, 2400].filter((w) => w <= width);
  if (!widths.length || (width < 2400 && !widths.includes(width)))
    widths.push(width);
  const variants: Photo['variants'] = [];
  try {
    for (const w of widths) {
      const result = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .withIccProfile('srgb')
        .webp({ quality: 90, effort: 4 })
        .toFile(join(temp, `${w}.webp`));
      variants.push({
        width: result.width,
        height: result.height,
        file: `${id}/${w}.webp`,
      });
    }
    const ext = (
      { jpeg: 'jpg', png: 'png', webp: 'webp', heif: 'heic' } as Record<
        string,
        string
      >
    )[meta.format];
    const originalFile = `${id}.${ext}`;
    await writeFile(join(originals, originalFile), buffer, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temp, join(directory, id));
    let exif: Photo['exif'] = {};
    let gps: { latitude: number; longitude: number } | undefined;
    try {
      const tags = ExifReader.load(buffer as unknown as ArrayBuffer);
      const get = (key: string) => {
        const value = tags[key]?.description;
        return value === undefined ? undefined : String(value).trim();
      };
      const make = get('Make'),
        model = get('Model');
      const camera = model
        ? model.startsWith(make ?? '')
          ? model
          : [make, model].filter(Boolean).join(' ')
        : make;
      exif = Object.fromEntries(
        Object.entries({
          camera,
          lens: get('LensModel'),
          focalLength: get('FocalLength'),
          aperture: get('FNumber'),
          shutterSpeed: get('ExposureTime'),
          iso: get('ISOSpeedRatings') ?? get('PhotographicSensitivity'),
          dateTaken: get('DateTimeOriginal'),
        }).filter(([, v]) => v),
      ) as Photo['exif'];
      const lat = Number(get('GPSLatitude')),
        lng = Number(get('GPSLongitude'));
      if (
        get('GPSLatitude') &&
        get('GPSLongitude') &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      )
        gps = {
          latitude: get('GPSLatitudeRef')?.startsWith('S') ? -lat : lat,
          longitude: get('GPSLongitudeRef')?.startsWith('W') ? -lng : lng,
        };
    } catch {
      /* EXIF is optional; decoding already succeeded. */
    }
    return {
      id,
      variants,
      width,
      height,
      originalFile,
      exif,
      takenAt:
        exif.dateTaken?.replace(/^(\d{4}):(\d{2}):(\d{2}).*$/, '$1-$2-$3') ??
        '',
      gps,
    };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}
