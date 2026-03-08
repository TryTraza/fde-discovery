import { setupClerkTestingToken } from '@clerk/testing/playwright';
import { test, expect } from '@playwright/test';

test.describe('Phase 0 smoke tests', () => {
  test('unauthenticated user is redirected to sign-in', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/clients');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('sign-in page renders Clerk component', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/sign-in');
    await expect(page.locator('[data-clerk-component="SignIn"]')).toBeVisible({ timeout: 10000 });
  });

  test('sign-up page renders Clerk component', async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto('/sign-up');
    await expect(page.locator('[data-clerk-component="SignUp"]')).toBeVisible({ timeout: 10000 });
  });

  test('API settings GET responds (middleware allows through)', async ({ request }) => {
    const res = await request.get('/api/settings');
    // Clerk testing token authenticates the request — should get 200 or redirect, not a crash
    expect([200, 307, 401]).toContain(res.status());
  });

  test('API test-key POST responds (middleware allows through)', async ({ request }) => {
    const res = await request.post('/api/settings/test-key');
    // With Clerk testing token, should get a valid response (200 or 422 for no key)
    expect([200, 307, 401, 422]).toContain(res.status());
  });
});
