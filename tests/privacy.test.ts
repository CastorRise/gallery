import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyLibrary,
  librarySchema,
  migrate,
  publicContent,
  validatePublication,
  type Photo,
} from '../packages/shared/src/index.ts';
import { changeSummary } from '../scripts/publication.ts';
const sample = (): Photo => ({
  id: 'test-photo',
  title: '真实测试照片',
  description: '',
  alt: '测试照片',
  status: 'published',
  featured: false,
  categoryId: 'other',
  order: 0,
  createdAt: '2026-10-14',
  takenAt: '',
  exif: {},
  width: 100,
  height: 200,
  variants: [{ width: 100, height: 200, file: 'test-photo/100.webp' }],
  originalFile: 'test-photo.jpg',
  location: {
    privacy: 'hidden',
    city: 'PRIVATE CITY',
    label: 'PRIVATE PLACE',
    latitude: 34.12345678,
    longitude: 113.87654321,
    confirmPrecise: false,
  },
});
test('隐藏地点和原图路径不进入任何公开字段', () => {
  const data = emptyLibrary();
  data.photos = [sample()];
  const out = JSON.stringify(publicContent(data));
  for (const secret of [
    'PRIVATE CITY',
    'PRIVATE PLACE',
    '34.12345678',
    '113.87654321',
    'originalFile',
    'confirmPrecise',
  ])
    assert.ok(!out.includes(secret));
});
test('城市公开仅保留粗略中心，近似坐标经取整', () => {
  const data = emptyLibrary();
  const p = sample();
  p.location = {
    ...p.location,
    privacy: 'city',
    city: '长沙',
    cityLatitude: 28.2278,
    cityLongitude: 112.9388,
  };
  data.photos = [p];
  let l = publicContent(data).photos[0].location;
  assert.deepEqual(l, {
    privacy: 'city',
    city: '长沙',
    label: '长沙',
    latitude: 28.2,
    longitude: 112.9,
  });
  p.location.privacy = 'approximate';
  l = publicContent(data).photos[0].location;
  assert.equal(l.latitude, 34.12);
  assert.equal(l.longitude, 113.88);
});
test('精确公开必须主动确认', () => {
  const data = emptyLibrary();
  const p = sample();
  p.location.privacy = 'precise';
  data.photos = [p];
  assert.throws(() => publicContent(data), /精确位置/);
  p.location.confirmPrecise = true;
  assert.equal(publicContent(data).photos[0].location.latitude, 34.12345678);
});
test('草稿和归档及其专题、故事不进入公开内容', () => {
  const data = emptyLibrary();
  data.photos = [
    { ...sample(), status: 'draft' },
    {
      ...sample(),
      id: 'archived',
      originalFile: 'archived.jpg',
      status: 'archived',
    },
  ];
  data.journals = [
    {
      id: 'secret-story',
      title: 'PRIVATE STORY',
      subtitle: '',
      place: '',
      date: '2026-10-14',
      status: 'draft',
      blocks: [],
    },
  ];
  assert.equal(publicContent(data).photos.length, 0);
  assert.ok(!JSON.stringify(publicContent(data)).includes('PRIVATE STORY'));
});
test('公开专题不能意外引用草稿照片，凭据与本地路径阻止发布', () => {
  const data = emptyLibrary();
  data.photos = [{ ...sample(), status: 'draft' }];
  data.collections = [
    {
      id: 'test',
      name: 'test',
      englishName: '',
      description: '',
      status: 'published',
      createdAt: '2026-10-14',
      order: 0,
      photoIds: ['test-photo'],
    },
  ];
  assert.throws(() => validatePublication(data), /未公开/);
  data.collections = [];
  data.settings.bio = '/Users/private/secret';
  assert.throws(() => validatePublication(data), /本地路径/);
});
test('ID、路径、重复引用和未知 schema 均被拒绝；v1 可迁移', () => {
  const data = emptyLibrary();
  data.photos = [sample()];
  assert.equal(migrate({ ...data, schemaVersion: 1 }).schemaVersion, 2);
  assert.throws(() => migrate({ ...data, schemaVersion: 99 }));
  assert.throws(() =>
    librarySchema.parse({
      ...data,
      photos: [{ ...sample(), originalFile: '../../secret' }],
    }),
  );
  assert.throws(() =>
    librarySchema.parse({ ...data, photos: [sample(), sample()] }),
  );
});
test('发布摘要识别新增、修改、移除', () => {
  const data = emptyLibrary();
  data.photos = [sample()];
  const before = publicContent(data);
  data.photos[0].title = '修改';
  data.photos.push({ ...sample(), id: 'second', originalFile: 'second.jpg' });
  const out = changeSummary(before, publicContent(data));
  assert.deepEqual(out.photos, { added: 1, modified: 1, removed: 0 });
  data.photos = [];
  assert.equal(changeSummary(before, publicContent(data)).photos.removed, 1);
});

test('首次发布没有远程基线时摘要仍完整', () => {
  const data = emptyLibrary();
  data.photos = [sample()];
  const summary = changeSummary(undefined, publicContent(data));
  assert.equal(summary.photos.added, 1);
  assert.equal(summary.settings, true);
});
