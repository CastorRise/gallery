import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
test('公开站导航、真实图片、筛选、详情 URL、键盘浏览器及缩放', async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/gallery/');
  await expect(page.locator('.hero-image img')).toBeVisible();
  expect(
    await page
      .locator('.hero-image img')
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Gallery', exact: true })
    .click();
  await expect(page.locator('.photo-card')).toHaveCount(14);
  await page.getByPlaceholder('Search photographs / 搜索作品').fill('佩佩');
  await expect(page.locator('.photo-card:visible')).toHaveCount(1);
  await page.getByPlaceholder('Search photographs / 搜索作品').fill('');
  await page.locator('#category-filter').selectOption('weather');
  await expect(page.locator('.photo-card:visible')).toHaveCount(5);
  await page.locator('.photo-card:visible a[data-photo]').first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#viewer-count')).toHaveText('01 / 05');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#viewer-count')).toHaveText('02 / 05');
  if (isMobile) {
    const rect = await page.locator('#viewer-image').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const y = rect!.y + rect!.height / 2,
      x = rect!.x + rect!.width * 0.75;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x - 100, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(page.locator('#viewer-count')).toHaveText('03 / 05');
  }
  await page.getByRole('button', { name: '缩放照片' }).click();
  await expect(page.locator('#viewer-image')).toHaveClass('zoomed');
  await page.getByRole('button', { name: '查看照片信息' }).click();
  await expect(page.locator('#viewer-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).not.toBeVisible();
  const link = page.locator('.photo-card:visible .photo-caption a').first();
  await link.click();
  await expect(page.locator('.detail h1')).toBeVisible();
  await page.reload();
  await expect(page.locator('.detail-image img')).toBeVisible();
  expect(errors).toEqual([]);
});
test('专题、Journal 空状态、地图聚合与地点筛选、About、无横向溢出', async ({
  page,
}) => {
  await page.goto('/gallery/collections/');
  await expect(page.locator('.collection-cover')).toHaveCount(3);
  await page.locator('.collection-cover').first().click();
  await expect(page.locator('.photo-card')).toHaveCount(5);
  await page.goto('/gallery/journal/');
  await expect(page.getByText('摄影手记尚未发布。')).toBeVisible();
  await page.goto('/gallery/map/');
  await expect(page.locator('.photo-marker')).toHaveCount(3);
  await page.locator('#map-city').selectOption('长沙');
  await expect(page.locator('.photo-marker')).toHaveCount(1);
  await page.locator('.photo-marker').click();
  await expect(page.locator('.map-popup a')).toHaveCount(3);
  await page.goto('/gallery/about/');
  await expect(page.getByText('Canon EOS 700D')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('公开首页、Gallery、About 无严重无障碍问题', async ({ page }) => {
  for (const route of ['/gallery/', '/gallery/gallery/', '/gallery/about/']) {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact ?? ''),
      ),
    ).toEqual([]);
  }
});
test('后台导入、真实 EXIF、编辑保存、分类、专题和故事模块实时预览', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, '后台完整流程在桌面执行，移动端另测布局');
  test.setTimeout(120000);
  const admin = 'http://127.0.0.1:4174';
  const initial = await (await page.request.get(admin + '/api/library')).json();
  await page.goto(admin);
  await expect(
    page.getByRole('heading', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.recent-list img').length === 5 &&
      [
        ...document.querySelectorAll<HTMLImageElement>('.recent-list img'),
      ].every((i) => i.naturalWidth > 0),
  );
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  const buffer = await sharp({
    create: { width: 400, height: 300, channels: 3, background: '#707080' },
  })
    .withExif({ IFD0: { Make: 'Canon', Model: 'EOS 700D' } })
    .jpeg()
    .toBuffer();
  await page.getByLabel('导入照片').setInputFiles({
    name: 'browser-test.jpg',
    mimeType: 'image/jpeg',
    buffer,
  });
  await expect(page.getByRole('status')).toContainText('已处理 1');
  await page.getByRole('button', { name: 'browser-test', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('浏览器测试照片');
  await page
    .getByLabel('描述', { exact: true })
    .fill('<script>window.injected=true</script>');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('修改已保存');
  await page.reload();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '浏览器测试照片', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新建专题' }).click();
  await page.getByLabel('名称', { exact: true }).fill('本地测试专题');
  await page.getByLabel('英文名称').fill('Local Test');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('button', { name: 'Journal', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新建故事' }).click();
  await page.getByLabel('文章标题').fill('本地测试故事');
  await page.getByRole('button', { name: '＋ 段落', exact: true }).click();
  await page
    .getByLabel('模块 1 文字')
    .fill('<script>window.injected=true</script>真实段落');
  await expect(page.locator('.journal-preview')).toContainText('真实段落');
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
  await page.getByRole('button', { name: '＋ 引用', exact: true }).click();
  await page.getByLabel('模块 2 文字').fill('引用内容');
  await page.getByRole('button', { name: '模块 2 上移' }).click();
  await expect(page.getByLabel('模块 1 文字')).toHaveValue('引用内容');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByLabel('公开状态', { exact: true }).selectOption('published');
  await page.getByRole('button', { name: '＋ 双图并排', exact: true }).click();
  const firstPair = page.locator('.block-editor').last();
  await firstPair.locator('input[type=checkbox]').nth(0).check();
  await firstPair.locator('input[type=checkbox]').nth(1).check();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('button', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: '＋ 新建分类' }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('button', { name: '构建与预览变更' }).click();
  await expect(page.getByRole('status')).toContainText('生产构建通过', {
    timeout: 90000,
  });
  await expect(page.getByText('尚未创建或配置独立远程仓库。')).toBeVisible();
  const current = await (await page.request.get(admin + '/api/library')).json();
  const story = current.journals.find((j: any) => j.title === '本地测试故事');
  await page.goto('/gallery/journal/' + story.id + '/');
  await expect(page.locator('.journal-heading h1')).toHaveText('本地测试故事');
  await expect(page.locator('.journal-photos.pair img')).toHaveCount(2);
  await expect(page.locator('.journal-paragraph')).toContainText('<script>');
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
  const token = (await (await page.request.get(admin + '/api/session')).json())
    .csrf;
  const restored = await page.request.put(admin + '/api/library', {
    headers: { Origin: admin, 'X-Gallery-CSRF': token },
    data: { ...initial, revision: current.revision },
  });
  expect(restored.ok()).toBe(true);
  const rebuild = await page.request.post(admin + '/api/publish/preview', {
    headers: { Origin: admin, 'X-Gallery-CSRF': token },
    data: {},
  });
  expect(rebuild.ok()).toBe(true);
});
test('后台窄屏布局与键盘焦点', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174');
  await expect(
    page.getByRole('heading', { name: 'Dashboard', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    'BODY',
  );
});
