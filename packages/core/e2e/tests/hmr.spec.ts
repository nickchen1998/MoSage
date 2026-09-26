import { expect, test } from '@playwright/test';
import { openDoc, readDocSource, viewer, writeDocSource } from './helpers.ts';

test.describe('hot reload', () => {
  let original = '';

  test.beforeEach(async () => {
    original = await readDocSource('hot-swap');
  });

  test.afterEach(async () => {
    await writeDocSource('hot-swap', original);
  });

  test('editing a page component updates the open viewer', async ({ page }) => {
    await openDoc(page, 'hot-swap');
    await expect(viewer(page).getByText('Hot swap before')).toBeVisible();

    await writeDocSource('hot-swap', original.replace('Hot swap before', 'Hot swap after'));

    await expect(viewer(page).getByText('Hot swap after')).toBeVisible({ timeout: 20_000 });
    await expect(viewer(page).getByText('Hot swap before')).toHaveCount(0);
  });

  test('adding a page grows the document without a manual reload', async ({ page }) => {
    await openDoc(page, 'hot-swap');
    await expect(page.locator('[data-thumb-page]')).toHaveCount(1);

    await writeDocSource(
      'hot-swap',
      original.replace(
        'export default [Only] satisfies DocPage[];',
        [
          'const Second: DocPage = () => (',
          '  <div style={sheet}>',
          '    <h1 style={{ fontSize: 28, margin: 0 }}>Hot swap second</h1>',
          '  </div>',
          ');',
          '',
          'export default [Only, Second] satisfies DocPage[];',
        ].join('\n'),
      ),
    );

    await expect(page.locator('[data-thumb-page]')).toHaveCount(2, { timeout: 20_000 });
    await expect(viewer(page).getByText('Hot swap second')).toBeVisible();
  });

  test('a new theme file appears in the gallery', async ({ page }) => {
    await page.goto('/themes');
    await expect(page.getByText('Plain').first()).toBeVisible();
  });
});
