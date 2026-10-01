import { expect, type Page, test } from '@playwright/test';
import { openDoc, pages, viewer } from './helpers.ts';

/** The boxes of alpha's three sheets, in page order. */
async function sheetBoxes(page: Page) {
  const boxes = await Promise.all([0, 1, 2].map((index) => pages(page).nth(index).boundingBox()));
  const [one, two, three] = boxes;
  if (!one || !two || !three) throw new Error('page frame has no bounding box');
  return [one, two, three] as const;
}

async function chooseViewMode(page: Page, name: string) {
  await page.getByRole('button', { name: 'View mode' }).click();
  await page.getByRole('menuitemradio', { name }).click();
}

async function expectViewMode(page: Page, name: string) {
  await page.getByRole('button', { name: 'View mode' }).click();
  await expect(page.getByRole('menuitemradio', { name, checked: true })).toBeVisible();
  await page.keyboard.press('Escape');
}

test.describe('document viewer', () => {
  test('renders one sheet per fixed page', async ({ page }) => {
    await openDoc(page, 'alpha');
    await expect(pages(page)).toHaveCount(3);
    await expect(viewer(page).getByText('Alpha page one')).toBeVisible();
    await expect(viewer(page).getByText('Alpha page three')).toBeVisible();
  });

  test('the header shows the title and the page counter', async ({ page }) => {
    await openDoc(page, 'alpha');
    await expect(page.getByRole('heading', { name: 'Alpha Report' })).toBeVisible();
    /* The counter is a field you can type a page into, so it is read by its
       accessible name and its value rather than as loose text. */
    await expect(page.getByLabel('Page number, 3 pages')).toBeVisible();
  });

  test('the title sits at the centre of the header, not of the leftover space', async ({
    page,
  }) => {
    // Wide enough for the whole control cluster at the default text size; any
    // narrower and the title slides aside by design rather than being overlapped.
    await page.setViewportSize({ width: 1920, height: 900 });
    await openDoc(page, 'alpha');

    const header = await page.locator('header').boundingBox();
    const title = await page.locator('header h1').boundingBox();
    if (!header || !title) throw new Error('header or title not rendered');

    expect(Math.abs(title.x + title.width / 2 - (header.x + header.width / 2))).toBeLessThan(2);
  });

  test('a sheet is a real A4 box at 96dpi', async ({ page }) => {
    await openDoc(page, 'alpha');
    const box = await pages(page).first().boundingBox();
    if (!box) throw new Error('page frame has no bounding box');
    // Scaled to fit the viewport, so compare the aspect ratio rather than px.
    expect(box.width / box.height).toBeCloseTo(794 / 1123, 2);
  });

  test('zoom controls change the rendered scale', async ({ page }) => {
    await openDoc(page, 'alpha');
    const readout = page.getByRole('button', { name: /%$/ });
    const before = await pages(page).first().boundingBox();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect
      .poll(async () => (await pages(page).first().boundingBox())?.width ?? 0)
      .toBeGreaterThan(before?.width ?? 0);

    await readout.click(); // actual size — 100%
    await expect(readout).toHaveText('100%');
    const actual = await pages(page).first().boundingBox();
    expect(actual?.width).toBeCloseTo(794, 0);
  });

  test('two-up opens on a right-hand page and pairs the rest side by side', async ({ page }) => {
    await openDoc(page, 'alpha');
    await chooseViewMode(page, 'Two-up');
    await expectViewMode(page, 'Two-up');

    const [one, two, three] = await sheetBoxes(page);
    expect(two.y).toBeCloseTo(three.y, 0);
    expect(two.x).toBeLessThan(three.x);
    // Page 1 stands alone in the right-hand column, above the first spread.
    expect(one.x).toBeCloseTo(three.x, 0);
    expect(one.y).toBeLessThan(two.y);
  });

  test('grid zooms out and wraps the sheets into rows', async ({ page }) => {
    await openDoc(page, 'alpha');
    const single = await pages(page).first().boundingBox();
    await chooseViewMode(page, 'Grid');

    await expect
      .poll(async () => (await pages(page).first().boundingBox())?.width ?? 0)
      .toBeLessThan((single?.width ?? 0) / 2);
    const [one, two, three] = await sheetBoxes(page);
    expect(two.y).toBeCloseTo(one.y, 0);
    expect(three.y).toBeCloseTo(one.y, 0);
    expect(one.x).toBeLessThan(two.x);
    expect(two.x).toBeLessThan(three.x);
  });

  /* Pages 2 and 3 share a row in two-up. Reading the counter off the row alone
     would answer 2 for a jump to 3. */
  test('a jump in two-up lands on the page asked for, not its neighbour', async ({ page }) => {
    await openDoc(page, 'alpha');
    await chooseViewMode(page, 'Two-up');
    await page.locator('[data-thumb-page="3"]').click();
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');
  });

  test('switching layouts keeps the page being read', async ({ page }) => {
    await openDoc(page, 'alpha');
    await page.locator('[data-thumb-page="3"]').click();
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');

    await chooseViewMode(page, 'Grid');
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');

    // The grid is one short row, so a scroll offset carried back unchanged
    // would land on page 1.
    await chooseViewMode(page, 'Continuous');
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');
    await expect(pages(page).nth(2)).toBeInViewport();
  });

  test('the view mode is remembered per document', async ({ page }) => {
    await openDoc(page, 'alpha');
    await chooseViewMode(page, 'Grid');

    await page.reload();
    await expect(pages(page).first()).toBeVisible();
    await expectViewMode(page, 'Grid');

    await openDoc(page, 'edit-target');
    await expectViewMode(page, 'Continuous');
  });

  test('the thumbnail rail jumps to a page', async ({ page }) => {
    await openDoc(page, 'alpha');
    await page.locator('[data-thumb-page="3"]').click();
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');
  });

  test('the outline lists headings with their page numbers', async ({ page }) => {
    await openDoc(page, 'alpha');
    await page.getByRole('button', { name: 'Outline', exact: true }).click();
    const outline = page.getByRole('navigation');
    await expect(outline.getByText('Alpha page one')).toBeVisible();
    await expect(outline.getByText('Alpha page two')).toBeVisible();

    await outline.getByText('Alpha page three').click();
    await expect(page.getByLabel('Page number, 3 pages')).toHaveValue('3');
  });

  test('the back link returns to the browser', async ({ page }) => {
    await openDoc(page, 'alpha');
    await page.getByRole('link', { name: 'Back to documents' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('the header in a Chinese browser', () => {
  test.use({ locale: 'zh-TW' });

  /* A CJK label may break between any two characters, so a tight header would
     stack 檢查 into a column rather than make room for it. */
  test('keeps every label on one line when space runs short', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await openDoc(page, 'alpha');
    await expect(page.getByRole('button', { name: '下載' })).toBeVisible();

    const labels = await page.locator('header button').evaluateAll((buttons) =>
      buttons.flatMap((button) =>
        Array.from(button.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
          .map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            return { label: node.textContent, lines: range.getClientRects().length };
          }),
      ),
    );
    expect(labels.map(({ label }) => label)).toEqual(
      expect.arrayContaining(['檢查', '設計', '下載']),
    );
    expect(labels).toEqual(labels.map(({ label }) => ({ label, lines: 1 })));
  });
});
