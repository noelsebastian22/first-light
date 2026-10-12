import { expect, test } from '@playwright/test';

test('a visitor explores the demo from the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your morning, already read.');
  await page.getByRole('link', { name: 'Explore the demo edition' }).click();

  await expect(page).toHaveURL(/\/demo\/today$/);
  await expect(page.getByRole('heading', { name: 'Good morning.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Three things to know' })).toBeVisible();

  await page.getByRole('link', { name: 'News', exact: true }).first().click();
  await page.getByRole('button', { name: /^AI \d+$/ }).click();
  await page.getByRole('button', { name: /Google AI Mode passes a billion/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Google AI Mode passes a billion/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save for later' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Archive', exact: true }).first().click();
  await page.getByLabel('Search stories').fill('angular');
  await expect(page.getByText('Angular v20 leaves long-term support in November').first()).toBeVisible();
  await page.getByLabel('Saved only').check();
  await page.getByLabel('Search stories').fill('');
  await expect(page.getByText(/Google AI Mode passes a billion/)).toBeVisible();
});

test('the Morning Machine pauses for reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#machine').scrollIntoViewIfNeeded();
  await expect(page.locator('app-morning-machine')).toHaveClass(/paused/);
  await context.close();
});
