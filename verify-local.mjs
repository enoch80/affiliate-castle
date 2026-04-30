import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'https://app.digitalfinds.net';
const OUT = '/tmp/verify-proxy';
const CACHE = '/tmp/new-photos';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Route Pexels CDN requests to local cache
await page.route('**/images.pexels.com/photos/**', async (route) => {
  const url = route.request().url();
  const match = url.match(/photos\/(\d+)\//);
  if (match) {
    const id = match[1];
    const localPath = path.join(CACHE, `${id}.jpg`);
    if (fs.existsSync(localPath)) {
      await route.fulfill({
        contentType: 'image/jpeg',
        body: fs.readFileSync(localPath)
      });
      return;
    }
  }
  await route.continue();
});

// --- campaign-preview.html Bridge tab ---
await page.goto(`${BASE}/preview/campaign-preview.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.click('text=Bridge');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/1-bridge-hero.png` });
await page.evaluate(() => window.scrollBy(0, 500));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/2-bridge-photogrid.png` });

// Pinterest tab
await page.click('text=Pinterest');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/3-pinterest-pins.png` });

// Medium/article tab
await page.click('text=Medium');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/4-article-cover.png` });

// --- tedwoodworking.html ---
await page.goto(`${BASE}/preview/tedwoodworking.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/5-ted-article.png` });

const tabs = await page.$$('[data-tab], .nav-tab');
console.log('Ted tabs found:', tabs.length);
if (tabs.length > 1) {
  await tabs[1].click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/6-ted-bridge.png` });
}

await browser.close();
console.log('DONE — screenshots in', OUT);
