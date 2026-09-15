import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Browser-only regression: every checkout POST is intercepted; no application
// or payment is created on the supplied server. Run against a deployed UI:
// CHECKOUT_TEST_BASE_URL=https://missdiasporagh.org node tests/browser/checkout-retry.mjs
const base = process.env.CHECKOUT_TEST_BASE_URL;
if (!base) throw new Error('Set CHECKOUT_TEST_BASE_URL to the portal to test.');
const script = await readFile(new URL('../../public/scripts/apply-form.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/scripts/apply-form.js*', route => route.fulfill({ contentType: 'text/javascript', body: script }));
  await page.route('https://challenges.cloudflare.com/**', route => route.abort());
  await page.addInitScript(() => {
    window.testResets = 0;
    window.turnstile = {
      render(_host, options) { window.testChallenge = options; options.callback('first-token'); return 'test-widget'; },
      reset() { window.testResets++; window.testChallenge.callback(`fresh-token-${window.testResets}`); },
    };
  });
  let calls = 0;
  let mode = 'limited';
  let release;
  let receivedToken;
  await page.route('**/api/checkout/create', async route => {
    calls++;
    receivedToken = route.request().postDataJSON().turnstileToken;
    if (mode === 'held') await new Promise(resolve => { release = resolve; });
    if (mode === 'network') return route.abort('failed');
    if (mode === 'non-json') return route.fulfill({ status: 502, contentType: 'text/html', body: 'Unavailable' });
    if (mode === 'success') return route.fulfill({ json: { ok: true, flow: 'redirect', checkoutUrl: '/apply/manual-payment?reference=MOMO-BROWSER-TEST' } });
    return route.fulfill({ status: 429, json: { ok: false, error: 'rate_limited', retryAfter: 1 } });
  });
  await page.route('**/apply/manual-payment?reference=MOMO-BROWSER-TEST', route => route.fulfill({ contentType: 'text/html', body: '<h1>Payment instructions test destination</h1>' }));
  await page.goto(`${base}/apply`, { waitUntil: 'domcontentloaded' });
  await page.locator('#eligibility-quiz button', { hasText: '18-25' }).click();
  const yes = page.locator('#eligibility-quiz button', { hasText: 'Yes' });
  for (let i = 0; i < 4; i++) await yes.nth(i).click();
  await page.locator('#apply-email').fill('browser-retry@example.com');
  await page.locator('#apply-phone').fill('2025550142');
  await page.locator('[name="consentPolicy"]').check();
  await page.locator('[name="consentRefund"]').check();
  for (const name of ['consentMediaUse', 'consentMarketing']) await page.locator(`[data-name="${name}"] button`).first().click();
  const button = page.locator('#submit-btn');
  await button.click();
  await page.waitForFunction(() => document.getElementById('form-err').textContent.includes('Please wait'));
  assert.equal(await button.isDisabled(), true);
  assert.equal(await page.locator('#apply-email').inputValue(), 'browser-retry@example.com');
  await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
  assert.ok(await page.evaluate(() => window.testResets >= 2));
  console.log('PASS: readable 429, cooldown, preserved form, refreshed token');

  mode = 'held';
  const before = calls;
  await page.evaluate(() => { const form = document.getElementById('apply-form'); form.requestSubmit(); form.requestSubmit(); });
  await page.waitForFunction(() => document.getElementById('submit-btn').getAttribute('aria-busy') === 'true');
  await page.locator('#apply-email').fill('browser-retry@example.com');
  assert.equal(await button.isDisabled(), true);
  while (!release) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls, before + 1);
  assert.match(receivedToken, /^fresh-token-/);
  release();
  await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
  console.log('PASS: repeated submit events create only one in-flight request');

  for (const failure of ['network', 'non-json']) {
    mode = failure;
    await button.click();
    await page.waitForFunction(() => document.getElementById('form-err').textContent.includes('could not connect'));
    await page.waitForFunction(() => !document.getElementById('submit-btn').disabled);
    assert.equal(await page.locator('#apply-email').inputValue(), 'browser-retry@example.com');
  }
  await page.evaluate(() => window.testChallenge['expired-callback']());
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => window.testChallenge.callback('fresh-after-expiry'));
  mode = 'success';
  await button.click();
  await page.waitForURL('**/apply/manual-payment?reference=MOMO-BROWSER-TEST');
  console.log('PASS: network/HTML failures recover, expired CAPTCHA disables submit, success navigates to manual instructions');
} finally {
  await browser.close();
}
