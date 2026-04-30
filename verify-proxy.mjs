import { chromium } from 'playwright';
import fs from 'fs';

const PROXY = 'http://918099f23f7baa58e1b8:fa4bd2593abef583@gw.dataimpulse.com:823';
const BASE = 'https://app.digitalfinds.net';
const OUT = '/tmp/verify-proxy';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  proxy: { server: PROXY }
});

const ctx = await browser.newContext({
  proxy: { server: PROXY },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
});

const page = await ctx.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// --- campaign-preview.html Bridge tab ---
await page.goto(`${BASE}/preview/campaign-preview.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.click('text=Bridge');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/1-bridge-hero.png` });
await page.evaluate(() => window.scrollBy(0, 500));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/2-bridge-photogrid.png` });

// Pinterest tab
await page.click('text=Pinterest');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/3-pinterest-pins.png` });

// Medium/article tab
await page.click('text=Medium');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/4-article-cover.png` });

// --- tedwoodworking.html ---
await page.goto(`${BASE}/preview/tedwoodworking.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/5-ted-article.png` });
// Click Bridge tab
const tabs = await page.$$('.tab-btn, [role="tab"], button.tab');
console.log('Ted tabs found:', tabs.length);
if (tabs.length > 1) {
  await tabs[1].click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/6-ted-bridge.png` });
}

await browser.close();
console.log('Done! Screenshots saved to', OUT);
