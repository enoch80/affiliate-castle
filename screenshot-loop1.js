const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const dir = '/tmp/loop1';
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const CAMP = 'https://app.digitalfinds.net/preview/campaign-preview.html';
  const TED  = 'https://app.digitalfinds.net/preview/tedwoodworking.html';

  // ── CAMPAIGN: Bridge ────────────────────────────────────────────────────
  await page.goto(CAMP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click("button[onclick*=\"'bridge'\"]");
  await page.waitForTimeout(1000);
  await page.locator('#panel-bridge').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/01-bridge-hero.png` });
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/02-bridge-photos.png` });
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/03-bridge-testimonials.png` });

  // ── CAMPAIGN: Pinterest ─────────────────────────────────────────────────
  await page.goto(CAMP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click("button[onclick*=\"'pinterest'\"]");
  await page.waitForTimeout(1000);
  await page.locator('#panel-pinterest').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const pinBox = await page.locator('#panel-pinterest').boundingBox();
  await page.screenshot({ path: `${dir}/04-pinterest-grid.png`, clip: { x: pinBox.x, y: pinBox.y, width: pinBox.width, height: Math.min(pinBox.height, 3000) } });

  // individual pin closeups
  const pins = page.locator('.pin');
  for (let i = 0; i < 3; i++) {
    await pins.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const b = await pins.nth(i).boundingBox();
    if (b) await page.screenshot({ path: `${dir}/05-pin${i+1}.png`, clip: { x: b.x-2, y: b.y-2, width: b.width+4, height: b.height+4 } });
  }

  // ── CAMPAIGN: Medium ────────────────────────────────────────────────────
  await page.goto(CAMP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click("button[onclick*=\"'article-medium'\"]");
  await page.waitForTimeout(800);
  await page.locator('#panel-article-medium').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/06-medium-top.png` });

  // ── CAMPAIGN: Lead Magnet ───────────────────────────────────────────────
  await page.goto(CAMP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click("button[onclick*=\"'leadmagnet'\"]");
  await page.waitForTimeout(800);
  await page.locator('#panel-leadmagnet').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/07-leadmagnet-cover.png` });

  // ── CAMPAIGN: Blogger ───────────────────────────────────────────────────
  await page.goto(CAMP, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click("button[onclick*=\"'article-blogger'\"]");
  await page.waitForTimeout(800);
  await page.locator('#panel-article-blogger').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/08-blogger-top.png` });

  // ── TED: Article ────────────────────────────────────────────────────────
  await page.goto(TED, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/09-ted-article-top.png` });
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/10-ted-article-cover.png` });

  // ── TED: Bridge ─────────────────────────────────────────────────────────
  await page.click("button:has-text('Bridge Page')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/11-ted-bridge-top.png` });
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/12-ted-bridge-testimonials.png` });

  await browser.close();
  console.log('DONE');
})();
