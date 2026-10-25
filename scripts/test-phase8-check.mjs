import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // 1. Visit /restaurants
  console.log('--- Checking /restaurants ---');
  await page.goto('http://localhost:5173/restaurants', { waitUntil: 'networkidle' });

  // Verify "Recommended for you" is NOT in DOM
  const recommendedHeading = await page.$('text=Recommended for you');
  console.log('"Recommended for you" present (should be false):', !!recommendedHeading);

  // Check "Book a table" buttons: should only be visible for restaurants with reservations enabled
  const bookBtns = await page.$$('button:has-text("Book a table")');
  console.log('Number of "Book a table" buttons found on /restaurants:', bookBtns.length);

  // Take /restaurants screenshot
  await page.screenshot({ path: '/home/usign/.temp/mvfds/docs/ui-audit/restaurants-page-after.png' });
  console.log('Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/restaurants-page-after.png');

  // 2. Visit a restaurant with reservations enabled
  console.log('\n--- Checking restaurant detail with reservation enabled (The Burgers Point) ---');
  await page.goto('http://localhost:5173/restaurants/6adc39be46fe935d61094ccf', { waitUntil: 'networkidle' });
  const bookCard = await page.$('text=Reserve a Table');
  console.log('Reserve a Table card present on Burgers Point (expected true):', !!bookCard);

  // Check delivery fee text
  const heroText = await page.innerText('section');
  console.log('Hero text contains live fee or set location prompt:', heroText.includes('delivery') || heroText.includes('Set location'));

  // Take screenshot
  await page.screenshot({ path: '/home/usign/.temp/mvfds/docs/ui-audit/restaurant-detail-burgers-point.png' });
  console.log('Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/restaurant-detail-burgers-point.png');

  // 3. Visit a restaurant with reservations disabled
  console.log('\n--- Checking restaurant detail with reservation disabled ---');
  await page.goto('http://localhost:5173/restaurants/6adc39bf46fe935d61094f16', { waitUntil: 'networkidle' });
  const noBookCard = await page.$('text=Reserve a Table');
  console.log('Reserve a Table card present on disabled restaurant (expected false):', !!noBookCard);

  await page.screenshot({ path: '/home/usign/.temp/mvfds/docs/ui-audit/restaurant-detail-disabled-booking.png' });
  console.log('Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/restaurant-detail-disabled-booking.png');

  await browser.close();
  console.log('\nPhase 8 verification complete!');
}

main().catch(console.error);
