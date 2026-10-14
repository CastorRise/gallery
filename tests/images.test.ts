import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import {
MAX_BYTES,
processImage,
} from '../packages/image-processing/src/index.ts';
test('真实 JPEG 解码、EXIF/GPS 提取、Orientation、ICC、无放大和公开元数据移除', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gallery-image-test-'));
  try {
    const input = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 112, g: 81, b: 49 },
      },
    })
      .withMetadata({ orientation: 6 })
      .withExifMerge({
        IFD0: { Make: 'Canon', Model: 'Canon EOS 700D' },
        IFD2: {
          LensModel: 'Canon EF-S 55-250mm',
          DateTimeOriginal: '2026:10:14 10:30:00',
          FNumber: '56/10',
          ExposureTime: '1/125',
          ISOSpeedRatings: '200',
          FocalLength: '100/1',
        },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '34/1 44/1 42/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '113/1 37/1 30/1',
        },
      })
      .jpeg({ quality: 100 })
      .toBuffer();
    const out = await processImage(
      input,
      join(dir, 'processed'),
      join(dir, 'originals'),
    );
    assert.equal(out.width, 800);
    assert.equal(out.height, 1200);
    assert.deepEqual(
      out.variants.map((v) => v.width),
      [480, 800],
    );
    assert.ok(out.exif.camera?.includes('700D'));
    assert.equal(out.takenAt, '2026-10-14');
    assert.ok(out.gps && Math.abs(out.gps.latitude - 34.745) < 0.0001);
    assert.deepEqual(
      await readFile(join(dir, 'originals', out.originalFile)),
      input,
    );
    for (const v of out.variants) {
      const m = await sharp(join(dir, 'processed', v.file)).metadata();
      assert.equal(m.exif, undefined);
      assert.equal(m.xmp, undefined);
      assert.ok(m.icc);
      assert.equal(m.width, v.width);
      assert.equal(m.height, v.height);
      assert.ok(v.width <= out.width);
      const color = await sharp(join(dir, 'processed', v.file))
        .resize(1, 1)
        .raw()
        .toBuffer();
      assert.ok(Math.abs(color[0] - 112) < 5);
      assert.ok(Math.abs(color[1] - 81) < 5);
      assert.ok(Math.abs(color[2] - 49) < 5);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('小图原始尺寸、PNG / WebP、伪装文件与 RAW 错误', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gallery-format-test-'));
  try {
    for (const format of ['png', 'webp'] as const) {
      const input = await sharp({
        create: { width: 120, height: 60, channels: 3, background: '#abc' },
      })
        [format]()
        .toBuffer();
      const result = await processImage(
        input,
        join(dir, 'processed'),
        join(dir, 'originals'),
      );
      assert.deepEqual(
        result.variants.map((v) => v.width),
        [120],
      );
    }
    await assert.rejects(
      processImage(Buffer.from('<script>evil</script>'), dir, dir),
      /无法解码/,
    );
    await assert.rejects(
      processImage(Buffer.alloc(MAX_BYTES + 1), dir, dir),
      /80 MB/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
