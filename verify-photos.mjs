import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://app.digitalfinds.net';
const OUT = '/tmp/verify-shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Campaign preview — multiple sections
await page.goto(`${BASE}/preview/campaign-preview.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: `${OUT}/camp-1-hero.png`, fullPage: false });
await page.evaluate(() => window.scrollTo(0, 1800));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/camp-2-photogrid.png` });
await page.evaluate(() => window.scrollTo(0, 3200));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/camp-3-pins.png` });
await page.evaluate(() => window.scrollTo(0, 5500));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/camp-4-article.png` });

// Ted page
await page.goto(`${BASE}/preview/tedwoodworking.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: `${OUT}/ted-1-cover.png`, fullPage: false });
await page.evaluate(() => window.scrollTo(0, 1400));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/ted-2-bridge-bg.png` });
// Click to bridge tab if available
const bridgeTab = await page.$('[data-tab="bridge"], .tab-bridge, button:has-text("Bridge")');
if (bridgeTab) {
  await bridgeTab.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/ted-3-bridge-tab.png` });
}

await browser.close();
console.log('Screenshots saved to', OUT);
