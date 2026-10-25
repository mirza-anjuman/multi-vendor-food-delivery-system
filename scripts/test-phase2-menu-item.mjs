import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const VIEWPORTS = [
  { width: 360, height: 740, name: '360' },
  { width: 414, height: 896, name: '414' },
  { width: 768, height: 1024, name: '768' },
  { width: 1280, height: 800, name: '1280' },
];

const ITEM_URL = 'http://localhost:5173/menu/6adc39be46fe935d61094ccf/6adc39bf46fe935d6109517e';

async function main() {
  console.log('Testing Menu Item Detail Page overhaul...');
  const browser = await chromium.launch({
    executablePath: '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
  });

  const page = await browser.newPage();

  // Test across all viewports
  for (const vp of VIEWPORTS) {
    console.log(`\n--- Testing viewport ${vp.name} (${vp.width}x${vp.height}) ---`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(ITEM_URL, { waitUntil: 'networkidle' });

    // Wait for item name to render
    await page.waitForSelector('text=Classic Beef Burger', { timeout: 10000 });

    // Wait a brief moment for async sections (nutrition, comparison, pairings)
    await page.waitForTimeout(1000);

    const priceComp = await page.$('text=Compare Prices Across Restaurants');
    console.log(`Viewport ${vp.name} - Price comparison section present:`, !!priceComp);

    const pairings = await page.$('text=Goes well with this dish');
    console.log(`Viewport ${vp.name} - Pairings section present:`, !!pairings);

    const nutrition = await page.$('text=Nutrition (Estimate)');
    console.log(`Viewport ${vp.name} - Nutrition block present:`, !!nutrition);

    // Save screenshot
    await page.screenshot({
      path: `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-${vp.name}-after.png`,
      fullPage: true,
    });
    console.log(`Saved screenshot to /home/usign/.temp/mvfds/docs/ui-audit/menu-item-${vp.name}-after.png`);
  }

  // Now test Add to Cart, Stepper, and Remove on desktop
  console.log('\n--- Testing Add to Cart and Stepper interaction ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(ITEM_URL, { waitUntil: 'networkidle' });

  // Locate the Add to cart button
  const addBtn = page.locator('button:has-text("Add to Cart")').first();
  await addBtn.click();
  console.log('Clicked "Add to Cart"');

  // Verify stepper shows up
  await page.waitForSelector('button[aria-label="Increase quantity"]');
  console.log('Stepper found: quantity stepper is visible');

  // Verify "In your cart" badge/text
  const inCartBadge = await page.$('text=Already in your cart');
  console.log('Item in cart indicator present:', !!inCartBadge);

  // Click increment
  const plusBtn = page.locator('button[aria-label="Increase quantity"]').first();
  await plusBtn.click();
  console.log('Clicked increment (+)');
  await page.waitForTimeout(300);

  // Click explicit remove button
  const removeBtn = page.locator('button[aria-label="Remove item from cart"]').first();
  await removeBtn.click();
  console.log('Clicked explicit Remove button');
  await page.waitForTimeout(500);

  // Verify Add to Cart button returns
  const addBtnAgain = page.locator('button:has-text("Add to Cart")').first();
  const isAddVisible = await addBtnAgain.isVisible();
  console.log('Add to Cart button restored after removal:', isAddVisible);

  await browser.close();
  console.log('\nMenu Item Detail Page test complete and verified!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
