import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Wait for categories
  await page.waitForSelector('text=Top Food Categories');
  const catNames = await page.$$eval('section:has-text("Top Food Categories") h3', els => els.map(e => e.innerText.trim()));
  console.log('Top Food Categories rendered:', catNames);

  // Check category images
  const catImages = await page.$$eval('section:has-text("Top Food Categories") img', els => els.map(e => e.src));
  console.log('Category image src sample:', catImages.slice(0, 3));

  // Check Nearby Restaurants
  await page.waitForSelector('text=Restaurants Near You');
  const nearbyNames = await page.$$eval('section:has-text("Restaurants Near You") h3', els => els.map(e => e.innerText.trim()));
  console.log('Nearby Restaurants rendered:', nearbyNames);

  // Check Popular Restaurants
  await page.waitForSelector('text=Popular Restaurants');
  const popularNames = await page.$$eval('section:has-text("Popular Restaurants") h3', els => els.map(e => e.innerText.trim()));
  console.log('Popular Restaurants rendered:', popularNames);

  const overlap = nearbyNames.filter(n => popularNames.includes(n));
  console.log('Overlap between Nearby and Popular:', overlap);

  // Save screenshot
  await page.screenshot({ path: '/home/usign/.temp/mvfds/docs/ui-audit/landing-page-after.png', fullPage: false });
  console.log('Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/landing-page-after.png');

  await browser.close();
}

main().catch(console.error);
