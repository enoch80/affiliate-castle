const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const outDir = '/tmp/audit-shots';
  fs.mkdirSync(outDir, { recursive: true });

  // --- campaign-preview.html: Dashboard tab (default) ---
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outDir}/01-campaign-dashboard.png`, fullPage: false });

  // --- campaign-preview.html: Bridge tab ---
  await page.click('button:has-text("Bridge")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/02-campaign-bridge-above-fold.png`, fullPage: false });
  // scroll to testimonials
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/03-campaign-bridge-testimonials.png`, fullPage: false });

  // --- tedwoodworking.html: Article tab ---
  await page.goto('https://app.digitalfinds.net/preview/tedwoodworking.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${outDir}/04-tedwood-article-above-fold.png`, fullPage: false });
  // scroll to cover image
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/05-tedwood-article-cover.png`, fullPage: false });

  // --- tedwoodworking.html: Bridge tab ---
  await page.click('button:has-text("Bridge")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/06-tedwood-bridge-above-fold.png`, fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/07-tedwood-bridge-testimonials.png`, fullPage: false });

  await browser.close();
  console.log('DONE');
})();
