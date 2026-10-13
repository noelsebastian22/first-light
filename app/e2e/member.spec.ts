import { expect, test } from '@playwright/test';

test('a signed-out visitor to /today is sent to sign in', async ({ page }) => {
  await page.route(/neonauth\./, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await page.goto('/today');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('the demo never calls Neon', async ({ page }) => {
  const neon: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('neon.tech')) neon.push(r.url());
  });
  await page.goto('/demo/today');
  await page.getByRole('link', { name: 'News', exact: true }).first().click();
  expect(neon).toEqual([]);
});
