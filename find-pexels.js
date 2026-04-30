const { chromium } = require('playwright');
const EXE = '/tmp/pw-browsers/chromium-1117/chrome-linux/chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // Search 1: woodworking workshop
  await page.goto('https://www.pexels.com/search/woodworking%20workshop/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Extract photo IDs and alt text from the page
  const photos = await page.evaluate(() => {
    const imgs = document.querySelectorAll('article[data-photo-id] img, [data-photo-id] img, img[data-photo-id]');
    const articles = document.querySelectorAll('article[data-photo-id]');
    const results = [];
    articles.forEach(a => {
      const id = a.getAttribute('data-photo-id');
      const img = a.querySelector('img');
      const alt = img ? img.getAttribute('alt') : '';
      const src = img ? img.src : '';
      if (id) results.push({ id, alt, src: src.slice(0, 80) });
    });
    return results.slice(0, 15);
  });
  
  console.log('=== WOODWORKING WORKSHOP ===');
  photos.forEach(p => console.log(`ID: ${p.id} | ALT: ${p.alt}`));

  // Search 2: carpenter workshop
  await page.goto('https://www.pexels.com/search/carpenter%20workshop/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const photos2 = await page.evaluate(() => {
    const articles = document.querySelectorAll('article[data-photo-id]');
    const results = [];
    articles.forEach(a => {
      const id = a.getAttribute('data-photo-id');
      const img = a.querySelector('img');
      const alt = img ? img.getAttribute('alt') : '';
      if (id) results.push({ id, alt });
    });
    return results.slice(0, 15);
  });
  
  console.log('=== CARPENTER WORKSHOP ===');
  photos2.forEach(p => console.log(`ID: ${p.id} | ALT: ${p.alt}`));

  await page.screenshot({ path: '/tmp/pexels-page.png' });
  await browser.close();
})();
