import { test, expect } from '@playwright/test';

test('happy path navigation: /apply → mock-checkout → /apply/form renders with token', async ({ page }) => {
  await page.goto('/apply');

  // --- Step 1: Eligibility quiz ---
  // Pick a passing age band. Buttons are rendered by apply-form.js inside #eligibility-quiz.
  await page.locator('#eligibility-quiz button', { hasText: '18-25' }).click();

  // The four yes/no questions follow the age row. Each row has two .btn-ghost buttons;
  // the first is "Yes". Locate all "Yes" buttons scoped to the quiz host.
  const yesButtons = page.locator('#eligibility-quiz button', { hasText: 'Yes' });
  await yesButtons.nth(0).click(); // isWoman
  await yesButtons.nth(1).click(); // africanDescent
  await yesButtons.nth(2).click(); // outsideGhana
  await yesButtons.nth(3).click(); // validPassport

  // --- Step 2: Email ---
  await page.locator('input[name="email"]').fill('test-happy@example.com');

  // --- Step 3: Consent ---
  await page.locator('input[name="consentPolicy"]').check();

  // Media-use binary toggle: "Yes, I consent" / "No, do not use"
  await page.locator('.binary-toggle[data-name="consentMediaUse"] button', { hasText: 'Yes, I consent' }).click();

  // Marketing binary toggle: "Yes, subscribe me" / "No, thanks"
  await page.locator('.binary-toggle[data-name="consentMarketing"] button', { hasText: 'No, thanks' }).click();

  // --- Step 4: Wait for Turnstile test key to auto-resolve, then submit ---
  // Turnstile site key 1x00000000000000000000AA always resolves immediately in test mode.
  await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 15_000 });
  await page.locator('#submit-btn').click();

  // --- Step 5: Mock checkout ---
  // /api/checkout/create redirects to mock-checkout (MOCK_PAYMENTS=true in .dev.vars)
  await expect(page).toHaveURL(/\/mock-checkout/, { timeout: 10_000 });
  await page.getByRole('link', { name: 'Simulate successful payment' }).click();

  // --- Step 6: /apply/return verifies the reference and redirects to /apply/form?token= ---
  await expect(page).toHaveURL(/\/apply\/form\?token=/, { timeout: 10_000 });

  // Payment confirmation banner
  await expect(page.locator('text=Payment confirmed')).toBeVisible();

  // Form heading
  await expect(page.locator('h1', { hasText: 'Your Application' })).toBeVisible();

  // Transaction reference code (format: MDGH-2026-XXXXXXXX)
  await expect(page.locator('code')).toContainText(/^MDGH-2026-/);

  // Form sections are present
  await expect(page.locator('text=About you')).toBeVisible();
  await expect(page.locator('text=Your story')).toBeVisible();
  await expect(page.locator('text=Headshot')).toBeVisible();
  await expect(page.locator('text=Intro video')).toBeVisible();

  // TODO: complete form-fill + file upload + submit when binary fixtures are sourced.
  //
  // Required fixtures (add to tests/e2e/fixtures/):
  //   - tests/e2e/fixtures/headshot.jpg  — small valid JPEG, ~50 KB
  //   - tests/e2e/fixtures/intro.mp4     — valid MP4 with duration ≤ 120s, ~500 KB
  //
  // Once fixtures exist, append the following after the assertions above:
  //
  //   await page.getByLabel('Full name').fill('Test Applicant');
  //   await page.getByLabel('Phone (with country code)').fill('+1 555 0100');
  //   await page.getByLabel('Date of birth').fill('1998-06-15');
  //   await page.getByLabel('Country of residence').fill('United States');
  //   await page.getByLabel('Current city').fill('Brooklyn');
  //   await page.getByLabel('Country of heritage').fill('Ghana');
  //   await page.getByPlaceholder(/Tell us who you are/).fill('A'.repeat(60));
  //   await page.locator('input[type="file"]').first().setInputFiles('tests/e2e/fixtures/headshot.jpg');
  //   await page.locator('input[type="file"]').nth(1).setInputFiles('tests/e2e/fixtures/intro.mp4');
  //   await page.getByRole('button', { name: 'Submit application' }).click();
  //   await expect(page).toHaveURL(/\/apply\/done/);
});
