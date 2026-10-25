import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

async function auditMenuItemPage() {
  const browser = await chromium.launch({ headless: true });
  const url = 'http://localhost:5173/menu/6adc39be46fe935d61094ccf/6adc39bf46fe935d6109517e';
  const widths = [360, 414, 768, 1280];

  const consoleLogs = [];
  const networkErrors = [];

  for (const width of widths) {
    const page = await browser.newPage();
    page.on('console', msg => consoleLogs.push(`[${width}px] ${msg.type()}: ${msg.text()}`));
    page.on('requestfailed', req => networkErrors.push(`[${width}px] FAILED: ${req.url()} - ${req.failure()?.errorText}`));

    await page.setViewportSize({ width, height: width < 768 ? 800 : 1000 });
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Screenshot 1: Without item in cart (guest)
    await page.screenshot({ path: `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-${width}-guest-nocart.png`, fullPage: true });

    // Click Add to cart
    const addBtn = page.locator('button:has-text("Add to cart")').last();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Screenshot 2: With item in cart
      await page.screenshot({ path: `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-${width}-guest-incart.png`, fullPage: true });
    }

    await page.close();
  }

  await browser.close();

  console.log('Console logs count:', consoleLogs.length);
  if (consoleLogs.length > 0) {
    console.log('Sample console logs:', consoleLogs.slice(0, 10));
  }
  console.log('Network errors:', networkErrors);
}

auditMenuItemPage().catch(err => {
  console.error(err);
  process.exit(1);
});
