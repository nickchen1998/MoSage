import { expect, test } from '@playwright/test';
import { openDoc, readDocSource, viewer, writeDocSource } from './helpers.ts';

test.describe('inspector', () => {
  let original = '';

  test.beforeEach(async () => {
    original = await readDocSource('edit-target');
  });

  test.afterEach(async ({ request }) => {
    await writeDocSource('edit-target', original);
    const res = await request.get('/__comments?docId=edit-target');
    if (res.ok()) {
      const { comments = [] } = (await res.json()) as { comments?: { id: string }[] };
      for (const c of comments) {
        await request.delete(`/__comments?docId=edit-target&id=${encodeURIComponent(c.id)}`);
      }
    }
  });

  test('editing a heading rewrites the source and hot-reloads the page', async ({ page }) => {
    await openDoc(page, 'edit-target');
    await page.getByRole('button', { name: 'Inspect' }).click();
    await viewer(page).getByText('Editable heading').click();

    const field = page.locator('textarea').first();
    await expect(field).toHaveValue('Editable heading');
    await field.fill('Rewritten heading');
    const saved = page.waitForResponse(
      (res) => res.url().includes('/__edit/text') && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save text' }).click();
    expect((await saved).status()).toBe(200);

    await expect
      .poll(async () => await readDocSource('edit-target'), { timeout: 10_000 })
      .toContain('Rewritten heading');
    await expect(viewer(page).getByText('Rewritten heading')).toBeVisible({ timeout: 15_000 });
  });

  test('a comment is stored as a marker in the source', async ({ page }) => {
    await openDoc(page, 'edit-target');
    await page.getByRole('button', { name: 'Inspect' }).click();
    await viewer(page).getByText('Editable paragraph').click();

    await page.getByPlaceholder('make this bold, shorten to one line…').fill('tighten this');
    await page.getByRole('button', { name: 'Mark comment' }).click();

    await expect
      .poll(async () => await readDocSource('edit-target'), { timeout: 10_000 })
      .toContain('@doc-comment');
  });

  test('a stale edit is refused rather than overwriting the file', async ({ request }) => {
    const res = await request.put('/__edit/text', {
      data: {
        docId: 'edit-target',
        line: 42,
        column: 4,
        text: 'nope',
        expected: 'something that was never on the page',
      },
    });
    expect(res.ok()).toBe(false);
    expect(await readDocSource('edit-target')).toBe(original);
  });
});
