import { expect, type Page, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import {
  deleteDoc,
  duplicateDoc,
  openDoc,
  pages,
  readDocSource,
  refreshDocsModule,
  writeDocSource,
} from './helpers.ts';

async function downloadDocx(page: Page): Promise<Record<string, string>> {
  const file = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Download' }).click();
  await page.getByRole('menuitem', { name: 'DOCX' }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of await (await file).createReadStream()) chunks.push(chunk as Buffer);
  const parts: Record<string, string> = {};
  for (const [name, data] of Object.entries(unzipSync(new Uint8Array(Buffer.concat(chunks))))) {
    parts[name] = name.startsWith('word/media/') ? '' : strFromU8(data);
  }
  return parts;
}

test.describe('watermark', () => {
  test.beforeEach(async ({ request }) => {
    await duplicateDoc(request, 'alpha', 'draft-memo');
    const source = await readDocSource('draft-memo');
    await writeDocSource(
      'draft-memo',
      source.replace(
        'export const meta: DocMeta = {',
        "export const meta: DocMeta = {\n  watermark: '草稿',",
      ),
    );
    await refreshDocsModule('draft-memo');
  });

  test.afterEach(async ({ request }) => {
    await deleteDoc(request, 'draft-memo');
  });

  test('meta.watermark is drawn across every sheet, outside the page text', async ({ page }) => {
    await openDoc(page, 'draft-memo');
    const sheets = pages(page);
    await expect(sheets.first()).toHaveAttribute('data-od-watermark', '草稿');
    const drawn = await sheets.first().evaluate((el) => {
      const after = getComputedStyle(el, '::after');
      return { content: after.content, transform: after.transform };
    });
    expect(drawn.content).toBe('"草稿"');
    expect(drawn.transform).not.toBe('none');
    // Not part of the text the outline, search, and the checker read.
    expect(await sheets.first().textContent()).not.toContain('草稿');
    await expect(page.locator('[data-od-watermark="草稿"]')).toHaveCount(
      (await sheets.count()) * 2,
    );
  });

  test('the Word export carries it as Word’s own watermark', async ({ page }) => {
    await openDoc(page, 'draft-memo');
    const parts = await downloadDocx(page);
    const headers = Object.keys(parts).filter((name) => /^word\/header\d+\.xml$/.test(name));
    expect(headers.length).toBeGreaterThan(0);
    for (const name of headers) expect(parts[name]).toContain('string="草稿"');
    expect(parts['word/document.xml']).not.toContain('草稿');
  });
});
