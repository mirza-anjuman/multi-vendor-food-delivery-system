import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const VIEWPORTS = [
  { width: 360, height: 740, name: '360' },
  { width: 414, height: 896, name: '414' },
  { width: 768, height: 1024, name: '768' },
  { width: 1280, height: 800, name: '1280' },
];

const PAGES_TO_TEST = [
  { name: 'home', path: '/' },
  { name: 'menu', path: '/menu' },
  { name: 'item', path: '/menu/6adc39be46fe935d61094ccf/6adc39bf46fe935d6109517e' },
  { name: 'restaurants', path: '/restaurants' },
  { name: 'restaurant', path: '/restaurants/6adc39be46fe935d61094ccf' },
];

async function runRegression() {
  console.log('Running comprehensive Playwright regression check across breakpoints...');
  const browser = await chromium.launch({
    executablePath: '/home/usign/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    headless: true,
  });

  const errors = [];

  for (const pageDef of PAGES_TO_TEST) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error(`[Console Error on ${pageDef.name} @ ${vp.name}]:`, msg.text());
          errors.push({ page: pageDef.name, viewport: vp.name, error: msg.text() });
        }
      });

      page.on('pageerror', err => {
        console.error(`[Page Error on ${pageDef.name} @ ${vp.name}]:`, err.message);
        errors.push({ page: pageDef.name, viewport: vp.name, error: err.message });
      });

      page.on('response', resp => {
        if (resp.status() >= 400 && !resp.url().includes('favicon')) {
          console.warn(`[HTTP ${resp.status()} on ${pageDef.name} @ ${vp.name}]:`, resp.url());
        }
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      const url = `http://localhost:5173${pageDef.path}`;
      await page.goto(url, { waitUntil: 'networkidle' });

      // Save screenshot
      await page.screenshot({
        path: `/home/usign/.temp/mvfds/docs/ui-audit/regression-${pageDef.name}-${vp.name}.png`,
        fullPage: false,
      });

      await page.close();
    }
    console.log(`✓ Completed 4 breakpoints for ${pageDef.name}`);
  }

  await browser.close();

  console.log('\n--- Final Regression Results ---');
  console.log(`Total console/page errors encountered: ${errors.length}`);
  if (errors.length > 0) {
    console.error('Errors:', errors);
    process.exit(1);
  } else {
    console.log('Zero console errors detected across all tested routes and viewports!');
  }
}

runRegression().catch(err => {
  console.error(err);
  process.exit(1);
});
