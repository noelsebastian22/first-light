import { expect, test } from '@playwright/test';

test('mobile uses a bottom bar and a More sheet', async ({ page }) => {
  await page.goto('/demo/today');
  const bar = page.getByRole('navigation', { name: 'Tabs' });
  await expect(bar).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Main menu' })).toBeHidden();
  await bar.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Reduce motion')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await bar.getByRole('link', { name: 'News' }).click();
  await page.getByRole('button', { name: /Labour Force figures due Thursday/ }).click();
  await expect(page).toHaveURL(/\/demo\/news\/demo-\d+$/);
  await expect(page.getByRole('heading', { level: 2, name: /Labour Force/ })).toBeVisible();
});
