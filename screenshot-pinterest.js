const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const outDir = '/tmp/audit-shots/pinterest';
  fs.mkdirSync(outDir, { recursive: true });

  // ── Full grid view at 1280px ──────────────────────────────────────────────
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button:has-text("Pinterest")');
  await page.waitForTimeout(700);
  // full panel screenshot (scroll to bring panel into view + capture)
  await page.locator('#panel-pinterest').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/01-pins-grid-1280.png`, fullPage: false });

  // scroll down a bit to see pin meta area
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/02-pins-grid-scrolled.png`, fullPage: false });

  // ── Full panel full-height screenshot ────────────────────────────────────
  const panelBox = await page.locator('#panel-pinterest').boundingBox();
  if (panelBox) {
    await page.screenshot({
      path: `${outDir}/03-pins-panel-full.png`,
      clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: Math.min(panelBox.height, 4000) }
    });
  }

  // ── Close-up of each individual pin ──────────────────────────────────────
  const pins = page.locator('.pin');
  const count = await pins.count();
  for (let i = 0; i < count; i++) {
    await pins.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = await pins.nth(i).boundingBox();
    if (box) {
      await page.screenshot({
        path: `${outDir}/pin-${i + 1}-closeup.png`,
        clip: { x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8 }
      });
    }
  }

  // ── Mobile view (375px) ───────────────────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button:has-text("Pinterest")');
  await page.waitForTimeout(700);
  await page.locator('#panel-pinterest').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/04-pins-mobile-375.png`, fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/05-pins-mobile-scrolled.png`, fullPage: false });

  await browser.close();
  console.log('DONE — shots in', outDir);
})();
