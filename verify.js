const { chromium } = require('playwright');
const fs = require('fs');
const EXE = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const out = '/tmp/shots';
  fs.mkdirSync(out, { recursive: true });

  // Helper: load page, click tab, scroll to el, screenshot
  async function shot(page, url, tabText, selector, scrollY, filename) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (tabText) {
      await page.click(`button:has-text("${tabText}")`);
      await page.waitForTimeout(800);
    }
    if (selector) {
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    if (scrollY) { await page.evaluate(y => window.scrollBy(0,y), scrollY); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${out}/${filename}` });
  }

  const CAMP = 'https://app.digitalfinds.net/preview/campaign-preview.html';
  const TED  = 'https://app.digitalfinds.net/preview/tedwoodworking.html';

  // ── 1280px viewport ───────────────────────────────────────────────
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // BRIDGE TAB ─ hero background + photo grid + testimonials
  await shot(page, CAMP, 'Bridge', '.bridge-hero', 0,   '01-camp-bridge-hero.png');
  await page.evaluate(() => window.scrollBy(0, 400)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/02-camp-bridge-photogrid.png` });
  await page.evaluate(() => window.scrollBy(0, 500)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/03-camp-bridge-testimonials.png` });

  // PINTEREST TAB ─ all 3 pins close-up
  await shot(page, CAMP, 'Pinterest', '#panel-pinterest', 0, '04-pins-grid.png');
  const pins = page.locator('.pin');
  for (let i=0; i<3; i++) {
    await pins.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const box = await pins.nth(i).boundingBox();
    if (box) await page.screenshot({ path: `${out}/05-pin-${i+1}.png`, clip: { x:box.x, y:box.y, width:box.width, height:box.height } });
  }

  // MEDIUM TAB ─ hero cover
  await shot(page, CAMP, 'Medium', '#panel-article-medium', 0, '06-medium-top.png');

  // BLOGGER TAB ─ featured image
  await shot(page, CAMP, 'Blogger', '#panel-article-blogger', 0, '07-blogger-top.png');

  // LEAD MAGNET ─ PDF cover
  await shot(page, CAMP, 'Lead Magnet', '#panel-leadmagnet', 0, '08-leadmagnet-top.png');

  // TED ─ article cover image
  await shot(page, TED, null, '.cover-image', 0, '09-ted-article-cover.png');

  // TED ─ bridge hero + testimonials
  await page.goto(TED, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('button:has-text("Bridge")');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/10-ted-bridge-top.png` });
  await page.evaluate(() => window.scrollBy(0, 400)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/11-ted-bridge-mid.png` });
  await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/12-ted-bridge-testimonials.png` });

  await browser.close();
  console.log('DONE');
})();
