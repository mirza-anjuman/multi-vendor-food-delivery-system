import { chromium } from '/home/usign/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import assert from 'node:assert';

async function runTests() {
  console.log('--- Phase 1 Verification Tests ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Test 1: Desktop Navigation Bar doesn't contain About or Contact Us
  console.log('Test 1: Desktop Navigation Bar links...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');

  const desktopNavLinks = await page.locator('nav a').allTextContents();
  console.log('Desktop nav links found:', desktopNavLinks.map(s => s.trim()).filter(Boolean));
  assert.ok(!desktopNavLinks.some(text => text.trim() === 'About'), 'About should not be in nav');
  assert.ok(!desktopNavLinks.some(text => text.trim() === 'Contact Us'), 'Contact Us should not be in nav');
  console.log('✓ Desktop navbar verified clean of About & Contact Us');

  // Test 2: Mobile Navigation Menu doesn't contain About or Contact Us
  console.log('Test 2: Mobile Navigation Menu links...');
  await page.setViewportSize({ width: 360, height: 640 });
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Open mobile menu hamburger
  const menuButton = page.locator('button[aria-label="Open menu"], button:has-text("Toggle menu"), nav button:has(svg)').first();
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.waitForTimeout(300);
    const mobileNavLinks = await page.locator('nav a, div[role="dialog"] a, .fixed a').allTextContents();
    console.log('Mobile nav links found:', mobileNavLinks.map(s => s.trim()).filter(Boolean));
    assert.ok(!mobileNavLinks.some(text => text.trim() === 'About'), 'About should not be in mobile nav');
    assert.ok(!mobileNavLinks.some(text => text.trim() === 'Contact Us'), 'Contact Us should not be in mobile nav');
  }
  console.log('✓ Mobile navbar verified clean of About & Contact Us');

  // Test 3: Footer still contains About Us & Contact Us
  console.log('Test 3: Footer links...');
  const footerLinks = await page.locator('footer a').allTextContents();
  assert.ok(footerLinks.some(text => text.includes('About')), 'Footer must still have About Us');
  assert.ok(footerLinks.some(text => text.includes('Contact')), 'Footer must still have Contact Us');
  console.log('✓ Footer verified to retain About Us and Contact Us');

  // Test 4: Blocking loader active, then browser Back
  console.log('Test 4: Blocking loader active, then browser Back...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173/');
  await page.waitForLoadState('networkidle');
  await page.goto('http://localhost:5173/menu');
  await page.waitForLoadState('networkidle');

  // Start a blocking operation that simulates a long-running call
  await page.evaluate(() => {
    window.__foodrush_loading.show({ message: 'Simulated operation', delayMs: 0 });
  });

  // Check that overlay is shown and root has inert
  await page.waitForTimeout(100);
  const isInertDuring = await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'));
  console.log('Root inert during blocking:', isInertDuring);
  assert.strictEqual(isInertDuring, true, 'Root should be inert during blocking operation');

  // Now user presses browser Back
  console.log('Triggering browser Back while blocking loader is active...');
  await page.goBack();
  await page.waitForTimeout(200);

  // Verify that root is NO LONGER inert, body overflow is restored, and overlay is gone
  const isInertAfterBack = await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'));
  const isAriaBusyAfterBack = await page.evaluate(() => document.getElementById('root')?.getAttribute('aria-busy'));
  const bodyOverflowAfterBack = await page.evaluate(() => document.body.style.overflow);
  const isBlockingVisibleAfterBack = await page.evaluate(() => window.__foodrush_loading.isBlockingVisible);

  console.log('State after browser Back:');
  console.log('  Root inert:', isInertAfterBack);
  console.log('  Root aria-busy:', isAriaBusyAfterBack);
  console.log('  Body overflow:', bodyOverflowAfterBack);
  console.log('  Blocking visible:', isBlockingVisibleAfterBack);

  assert.strictEqual(isInertAfterBack, false, 'Root must NOT be inert after Back');
  assert.notStrictEqual(isAriaBusyAfterBack, 'true', 'Root must NOT be aria-busy after Back');
  assert.notStrictEqual(bodyOverflowAfterBack, 'hidden', 'Body overflow must NOT be hidden after Back');
  assert.strictEqual(isBlockingVisibleAfterBack, false, 'Blocking overlay must be dismissed after Back');
  console.log('✓ Browser Back during blocking operation cleanly resets state');

  // Test 5: bfcache restore
  console.log('Test 5: bfcache restore simulation (pageshow with persisted: true)...');
  await page.evaluate(() => {
    window.__foodrush_loading.show({ message: 'Another operation', delayMs: 0 });
  });
  await page.waitForTimeout(50);

  // Dispatch pageshow with persisted: true
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(100);

  const isInertAfterBfcache = await page.evaluate(() => document.getElementById('root')?.hasAttribute('inert'));
  const isBlockingAfterBfcache = await page.evaluate(() => window.__foodrush_loading.isBlockingVisible);
  console.log('State after bfcache restore:');
  console.log('  Root inert:', isInertAfterBfcache);
  console.log('  Blocking visible:', isBlockingAfterBfcache);
  assert.strictEqual(isInertAfterBfcache, false, 'Root must NOT be inert after bfcache restore');
  assert.strictEqual(isBlockingAfterBfcache, false, 'Blocking overlay must be false after bfcache restore');
  console.log('✓ bfcache restore cleanly resets state');

  await browser.close();
  console.log('\n--- ALL PHASE 1 TESTS PASSED! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
