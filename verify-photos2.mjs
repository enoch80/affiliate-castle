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

// --- campaign-preview.html ---
await page.goto(`${BASE}/preview/campaign-preview.html`, { waitUntil: 'networkidle', timeout: 30000 });

// Click Bridge tab
await page.click('text=Bridge');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/camp-bridge-hero.png` });
await page.evaluate(() => window.scrollBy(0, 800));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/camp-bridge-photogrid.png` });

// Click Pinterest tab
await page.click('text=Pinterest');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/camp-pins-top.png` });

// Click Medium/article tab
await page.click('text=Medium');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/camp-article-cover.png` });

// --- tedwoodworking.html ---
await page.goto(`${BASE}/preview/tedwoodworking.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: `${OUT}/ted-article-tab.png` });
// Click Bridge tab in ted page
const bridgeBtn = await page.$('button:has-text("Bridge"), [data-tab="bridge"], .tab:has-text("Bridge")');
if (bridgeBtn) {
  await bridgeBtn.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ted-bridge-bg.png` });
} else {
  // Try tab 2
  const tabs = await page.$$('.tab, [role="tab"]');
  if (tabs.length > 1) {
    await tabs[1].click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/ted-bridge-bg.png` });
  }
}

await browser.close();
console.log('DONE — screenshots in', OUT);
