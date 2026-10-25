import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/menu', { waitUntil: 'networkidle' });

  // 1. Initial state: search input should be visible
  const searchInput = page.locator('input[aria-label="Search food items"]');
  console.log('Search input visible initially:', await searchInput.isVisible());

  // 2. Wheel scroll down
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);

  // Search input should be collapsed / not visible
  const isSearchVisibleAfterScrollDown = await searchInput.isVisible();
  console.log('Search input visible after scroll down (expected false):', isSearchVisibleAfterScrollDown);

  // Category pills container should still be visible and sticky
  const categoryPills = page.locator('[aria-label="Category filter"]');
  console.log('Category pills visible while search collapsed:', await categoryPills.isVisible());

  // 3. Wheel scroll up
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(500);
  const isSearchVisibleAfterScrollUp = await searchInput.isVisible();
  console.log('Search input restored after scroll up (expected true):', isSearchVisibleAfterScrollUp);

  // 4. Test selecting category scrolls into view
  await page.goto('http://localhost:5173/menu?categories=Beverages', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const bevButton = page.locator('button[aria-pressed="true"]');
  console.log('Selected category pill found:', (await bevButton.innerText()).replace(/\n/g, ' '));

  // Take screenshot
  await page.screenshot({ path: '/home/usign/.temp/mvfds/docs/ui-audit/menu-page-sticky-after.png' });
  console.log('Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/menu-page-sticky-after.png');

  await browser.close();
}

main().catch(console.error);
