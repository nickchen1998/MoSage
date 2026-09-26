import { expect, test } from '@playwright/test';

test.describe('themes', () => {
  test('the gallery lists the fixture theme with its description', async ({ page }) => {
    await page.goto('/themes');
    await expect(page.getByRole('heading', { name: 'Themes' })).toBeVisible();
    await expect(page.getByText('Minimal fixture theme for e2e tests.')).toBeVisible();
  });

  test('the detail page renders the theme body and its demo', async ({ page }) => {
    await page.goto('/themes/plain');
    await expect(page.getByRole('heading', { name: 'Plain', exact: true })).toBeVisible();
    await expect(
      page.getByText('A minimal theme used only by the e2e fixture project.'),
    ).toBeVisible();
    await expect(page.getByText('Plain theme demo')).toBeVisible();
  });

  test('the detail page links back to the gallery', async ({ page }) => {
    await page.goto('/themes/plain');
    await page.getByRole('link', { name: 'Themes', exact: true }).click();
    await expect(page).toHaveURL(/\/themes$/);
  });

  test('an unknown theme does not crash the gallery', async ({ page }) => {
    await page.goto('/themes/no-such-theme');
    await expect(page.getByText(/not found|Nothing here/i).first()).toBeVisible();
  });
});
