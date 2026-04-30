const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const out = '/tmp/audit-shots/verify';
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // ── CAMPAIGN: Bridge ──
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button[onclick*="\'bridge\'"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/01-bridge-hero.png` });
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/02-bridge-testimonials.png` });

  // ── CAMPAIGN: Pinterest ──
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button[onclick*="\'pinterest\'"]');
  await page.waitForTimeout(700);
  await page.locator('#panel-pinterest').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const panelBox = await page.locator('#panel-pinterest').boundingBox();
  if (panelBox) await page.screenshot({ path: `${out}/03-pinterest-grid.png`, clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: Math.min(panelBox.height, 3500) } });
  // individual pins
  const pins = page.locator('.pin');
  for (let i = 0; i < 3; i++) {
    await pins.nth(i).scrollIntoViewIfNeeded();
    const box = await pins.nth(i).boundingBox();
    if (box) await page.screenshot({ path: `${out}/0${4+i}-pin${i+1}.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  }

  // ── CAMPAIGN: Medium ──
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button[onclick*="\'article-medium\'"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/07-medium-top.png` });

  // ── CAMPAIGN: Lead Magnet ──
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button[onclick*="\'leadmagnet\'"]');
  await page.waitForTimeout(700);
  await page.locator('#panel-leadmagnet').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/08-leadmagnet-cover.png` });

  // ── CAMPAIGN: Blogger ──
  await page.goto('https://app.digitalfinds.net/preview/campaign-preview.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button[onclick*="\'article-blogger\'"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/09-blogger-featured.png` });

  // ── TEDWOOD: Article ──
  await page.goto('https://app.digitalfinds.net/preview/tedwoodworking.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `${out}/10-tedwood-article-top.png` });
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/11-tedwood-article-cover.png` });

  // ── TEDWOOD: Bridge ──
  await page.click('button:has-text("Bridge")');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/12-tedwood-bridge-top.png` });
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/13-tedwood-bridge-testimonials.png` });

  await browser.close();
  console.log('DONE');
})();
