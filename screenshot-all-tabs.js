const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const outDir = '/tmp/audit-shots/all-tabs';
  fs.mkdirSync(outDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  const BASE = 'https://app.digitalfinds.net/preview/campaign-preview.html';

  const tabs = [
    { id: 'article-blogger',  label: 'blogger' },
    { id: 'article-devto',    label: 'devto' },
    { id: 'article-hashnode', label: 'hashnode' },
    { id: 'article-tumblr',   label: 'tumblr' },
    { id: 'article-medium',   label: 'medium' },
    { id: 'telegram',         label: 'telegram' },
    { id: 'email',            label: 'email' },
    { id: 'leadmagnet',       label: 'leadmagnet' },
    { id: 'tracking',         label: 'tracking' },
    { id: 'cluster',          label: 'topic-cluster' },
  ];

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  let idx = 1;
  for (const tab of tabs) {
    const btn = page.locator(`button[onclick*="'${tab.id}'"]`);
    await btn.click();
    await page.waitForTimeout(700);
    await page.locator(`#panel-${tab.id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/${String(idx).padStart(2,'0')}-${tab.label}-top.png` });
    idx++;
    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/${String(idx).padStart(2,'0')}-${tab.label}-scroll.png` });
    idx++;
  }

  await browser.close();
  console.log('DONE');
})();
