import { expect, test } from '@playwright/test';
import { openDoc, pages, viewer } from './helpers.ts';

test.describe('flow pagination', () => {
  test('a flow section expands into several sheets behind the fixed cover', async ({ page }) => {
    await openDoc(page, 'flow-report');
    // 1 fixed cover + however many sheets the packer needs for 40 paragraphs.
    await expect.poll(async () => await pages(page).count()).toBeGreaterThan(2);
    await expect(page.getByText('Flow Report', { exact: false }).first()).toBeVisible();
  });

  test('every paragraph lands on exactly one sheet', async ({ page }) => {
    await openDoc(page, 'flow-report');
    for (const n of [1, 20, 40]) {
      await expect(viewer(page).getByText(`Flow paragraph ${n}.`, { exact: false })).toHaveCount(1);
    }
  });

  test('no flow block overflows the sheet it was packed onto', async ({ page }) => {
    await openDoc(page, 'flow-report');
    await expect(page.locator('[data-od-flow-block]').first()).toBeVisible();

    const overflowing = await page.evaluate(() => {
      const sheets = Array.from(document.querySelectorAll('[data-od-viewer] [data-od-page]'));
      let bad = 0;
      for (const sheet of sheets) {
        const bounds = sheet.getBoundingClientRect();
        for (const block of Array.from(sheet.querySelectorAll('[data-od-flow-block]'))) {
          // 1px of tolerance for sub-pixel rounding at the current zoom.
          if (block.getBoundingClientRect().bottom > bounds.bottom + 1) bad++;
        }
      }
      return bad;
    });
    expect(overflowing).toBe(0);
  });

  test('the running footer numbers every flow page', async ({ page }) => {
    await openDoc(page, 'flow-report');
    const total = await pages(page).count();
    // The cover has no footer, so the footer count is the flow page count.
    await expect(viewer(page).getByText(/^Flow Report — page \d+ of \d+$/)).toHaveCount(total - 1);
    await expect(viewer(page).getByText(`Flow Report — page 2 of ${total}`)).toBeVisible();
  });

  test('the outline picks up the flow heading', async ({ page }) => {
    await openDoc(page, 'flow-report');
    await page.getByRole('button', { name: 'outline', exact: true }).click();
    await expect(page.getByRole('navigation').getByText('Measured body')).toBeVisible();
  });
});
