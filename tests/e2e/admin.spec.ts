import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@missdiasporagh.org';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'test-admin-password';

test('admin login + list view', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/admin/applications', { timeout: 5000 });
  await expect(page.locator('h1')).toContainText('Applications');
});

test('admin login fails with wrong password', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill('definitely-wrong');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('#login-err')).toContainText('Invalid email or password');
});

test('unauthenticated access to /admin/applications redirects to login', async ({ page }) => {
  await page.goto('/admin/applications');
  await expect(page).toHaveURL(/\/admin\/login/);
});
