import { expect, test } from '@playwright/test';

test('is installable and works offline after the first visit', async ({ page, context }) => {
  await page.goto('/demo/today');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('First Light');
  expect(manifest.display).toBe('standalone');

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 40_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good morning.' })).toBeVisible();
  await context.setOffline(false);
});
