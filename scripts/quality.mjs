import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { writeFile, mkdir } from 'node:fs/promises';
const directory = new URL('../.local/qa/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
for (const [name, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto('http://127.0.0.1:4321/gallery/');
  await page.locator('.hero-image img').waitFor();
  await page.screenshot({
    path: new URL(`home-${name}.png`, directory).pathname,
    fullPage: true,
  });
  await page.close();
}
await browser.close();
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new'],
});
try {
  for (const preset of ['desktop', 'mobile']) {
    const result = await lighthouse('http://127.0.0.1:4321/gallery/', {
      port: chrome.port,
      output: ['json', 'html'],
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      ...(preset === 'desktop' ? { preset: 'desktop' } : {}),
    });
    await writeFile(
      new URL(`lighthouse-${preset}.json`, directory),
      result.report[0],
    );
    await writeFile(
      new URL(`lighthouse-${preset}.html`, directory),
      result.report[1],
    );
    console.log(
      JSON.stringify({
        preset,
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([k, v]) => [
            k,
            Math.round(v.score * 100),
          ]),
        ),
        lcp: result.lhr.audits['largest-contentful-paint'].displayValue,
        cls: result.lhr.audits['cumulative-layout-shift'].displayValue,
      }),
    );
  }
} finally {
  await chrome.kill();
}
