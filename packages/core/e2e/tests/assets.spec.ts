import { expect, test } from '@playwright/test';
import { TINY_PNG } from './helpers.ts';

const IMAGE = 'images/e2e-panel-pixel.png';
const CSV = 'references/e2e-panel.csv';
const url = (scope: string, p: string) =>
  `/__assets/${scope}/${p.split('/').map(encodeURIComponent).join('/')}`;

test.describe('assets', () => {
  test.afterEach(async ({ request }) => {
    await request.delete(url('@global', IMAGE));
    await request.delete(url('alpha', CSV));
  });

  test('an uploaded image lands in 圖片, marked unused', async ({ page, request }) => {
    const uploaded = await request.post(url('@global', IMAGE), {
      data: TINY_PNG,
      headers: { 'content-type': 'image/png' },
    });
    expect(uploaded.ok()).toBe(true);

    await page.goto('/assets');
    await expect(page.getByRole('heading', { name: 'Assets' })).toBeVisible();
    const tree = page.getByRole('navigation', { name: 'Asset folders' });
    await tree.getByRole('button', { name: '圖片' }).first().click();
    await expect(page.getByText('e2e-panel-pixel.png')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    // Nothing imports it, which is exactly what the badge is for.
    await expect(page.getByText('unused').first()).toBeVisible();
  });

  test('every document has its own images and references in the tree', async ({ page }) => {
    await page.goto('/assets');
    const tree = page.getByRole('navigation', { name: 'Asset folders' });
    await expect(tree.getByRole('button', { name: 'Project (shared)', exact: true })).toBeVisible();
    await tree.getByRole('button', { name: 'Alpha Report', exact: true }).click();
    await expect(tree.getByRole('button', { name: '參考文獻' })).toHaveCount(2);
  });

  test('a reference opens in a preview', async ({ page, request }) => {
    await request.post(url('alpha', CSV), {
      data: 'region,revenue\nNorth,120\nSouth,"98,5"\n',
      headers: { 'content-type': 'text/csv' },
    });
    await page.goto('/assets');
    const tree = page.getByRole('navigation', { name: 'Asset folders' });
    await tree.getByRole('button', { name: 'Alpha Report', exact: true }).click();
    await tree.getByRole('button', { name: '參考文獻' }).nth(1).click();
    await page.getByRole('button', { name: 'Preview e2e-panel.csv' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'e2e-panel.csv' });
    await expect(dialog.getByRole('cell', { name: '98,5' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
