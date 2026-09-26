import { expect, test } from '@playwright/test';
import { openDoc, readDocSource, writeDocSource } from './helpers.ts';

test.describe('design panel', () => {
  let original = '';

  test.beforeEach(async () => {
    original = await readDocSource('edit-target');
  });

  test.afterEach(async () => {
    await writeDocSource('edit-target', original);
  });

  test('a margin change writes back into the document source', async ({ page }) => {
    await openDoc(page, 'edit-target');
    await page.getByRole('button', { name: 'Design' }).click();

    const panel = page.locator('aside').filter({ hasText: 'Design' }).last();
    const margin = panel.locator(String.raw`div:has(> span:text-is("Margin")) input[type=range]`);
    await margin.fill('120');

    const saved = page.waitForResponse(
      (res) => res.url().includes('/__design') && res.request().method() === 'PUT',
    );
    await panel.getByRole('button', { name: 'Save to source' }).click();
    expect((await saved).status()).toBe(200);

    await expect
      .poll(async () => await readDocSource('edit-target'), { timeout: 10_000 })
      .toContain('margin: 120');
  });

  test('discard leaves the source untouched', async ({ page }) => {
    await openDoc(page, 'edit-target');
    await page.getByRole('button', { name: 'Design' }).click();

    const panel = page.locator('aside').filter({ hasText: 'Design' }).last();
    await panel
      .locator(String.raw`div:has(> span:text-is("Margin")) input[type=range]`)
      .fill('132');
    await panel.getByRole('button', { name: 'Discard' }).click();

    expect(await readDocSource('edit-target')).toBe(original);
  });

  test('the dev API reports the document design', async ({ request }) => {
    const res = await request.get('/__design?docId=edit-target');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { design?: { margin?: number } };
    expect(body.design?.margin).toBe(76);
  });
});
