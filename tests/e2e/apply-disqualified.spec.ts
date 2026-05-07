import { test, expect } from '@playwright/test';

test('disqualified branch shows soft re-engagement card', async ({ page }) => {
  await page.goto('/apply');

  // Pick "Under 18" age band → triggers disqualified state
  await page.getByRole('button', { name: 'Under 18' }).click();

  // Expect disqualified card to appear
  await expect(page.locator('#disqualified-card')).toBeVisible();
  await expect(page.locator('#disqualified-card')).toContainText("isn't a fit");

  // Subscribe to notifications
  await page.locator('#dq-email').fill('test-disqualified@example.com');
  await page.locator('#dq-subscribe').click();

  // Expect success message
  await expect(page.locator('#dq-msg')).toContainText("we'll be in touch", { timeout: 5000 });
});
