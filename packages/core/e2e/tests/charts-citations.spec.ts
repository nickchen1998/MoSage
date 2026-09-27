import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import {
  deleteDoc,
  devScratchDir,
  duplicateDoc,
  openDoc,
  refreshDocsModule,
  viewer,
  writeDocSource,
} from './helpers.ts';

const DOC = 'data-and-sources';

const BIB = `@article{chen2024,
  author = {Chen, Da-Wen and Lin, Xiao-Ming},
  title = {Cloud Costs in {Taiwan}},
  journal = {Journal of Taiwan Studies},
  year = 2024, volume = {12}, number = {3}, pages = {45--67}
}
@book{chen2023, author = {陳大文 and 林小明}, title = {雲端架構實務}, publisher = {臺灣出版社}, year = {2023}}
@misc{unused, author = {Nobody, Cited}, title = {Never cited}, year = {2020}}
`;

const SOURCE = `import { Bibliography, Chart, Cite, type DocMeta, flow } from 'mosage';
import refs from './assets/references/refs.bib';

export const meta: DocMeta = { title: 'Data and sources', createdAt: '2026-01-03T00:00:00.000Z' };

const sales = [
  { month: 'Jan', revenue: 1200, cost: 800 },
  { month: 'Feb', revenue: '980', cost: 700 },
  { month: 'Mar', revenue: 1460, cost: 900 },
];

export default [
  flow(
    <>
      <h1>Findings</h1>
      <p>
        Costs grew <Cite id="chen2024" /> and practice agrees <Cite id="chen2023" page="12" />;
        see both <Cite id={['chen2024', 'chen2023']} /> and <Cite id="missing" />.
      </p>
      <Chart type="bar" data={sales} x="month" y="revenue" caption="Revenue" />
      <Chart type="line" data={sales} x="month" y={['revenue', 'cost']} caption="Trend" />
      <Chart type="pie" data={sales} x="month" y="nope" />
      <h2>References</h2>
      <Bibliography sources={refs} />
    </>,
  ),
];
`;

async function report(page: Page) {
  await page.waitForFunction('globalThis.__mosage && globalThis.__mosage.status().ready');
  return (await page.evaluate('globalThis.__mosage.diagnose()')) as {
    findings: Array<{ rule: string; severity: string; message: string }>;
  };
}

test.describe('charts and citations', () => {
  test.beforeAll(async ({ request }) => {
    await duplicateDoc(request, 'alpha', DOC);
    const refs = path.join(devScratchDir, 'docs', DOC, 'assets', 'references');
    await fs.mkdir(refs, { recursive: true });
    await fs.writeFile(path.join(refs, 'refs.bib'), BIB);
    await writeDocSource(DOC, SOURCE);
    await refreshDocsModule(DOC);
  });

  test.afterAll(async ({ request }) => {
    await deleteDoc(request, DOC);
  });

  test('a chart is drawn from rows and numbered as a figure', async ({ page }) => {
    await openDoc(page, DOC);
    const bar = viewer(page).locator('svg[data-od-chart="bar"]');
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveAttribute('aria-label', 'Jan 1,200, Feb 980, Mar 1,460');
    // One column per row, its value printed at the tip — "980" was a string.
    await expect(bar.locator('path')).toHaveCount(3);
    await expect(bar.locator('text', { hasText: /^980$/ })).toHaveCount(1);
    await expect(
      viewer(page).locator('figure', { has: page.locator('svg[data-od-chart="bar"]') }),
    ).toContainText('Figure 1');

    const line = viewer(page).locator('svg[data-od-chart="line"]');
    // Two series: a legend names them.
    await expect(line.locator('text', { hasText: /^revenue$/ })).toHaveCount(1);
    await expect(line.locator('text', { hasText: /^cost$/ })).toHaveCount(1);
    await expect(viewer(page).locator('[data-od-chart-error]')).toHaveText(
      '[? Chart: no column "nope" for y]',
    );
  });

  test('citations resolve against the bibliography imported from a .bib file', async ({ page }) => {
    await openDoc(page, DOC);
    const cites = viewer(page).locator('[data-od-cite]');
    await expect(cites).toHaveText(['[1]', '[2，頁 12]', '[1, 2]', '[?missing]']);

    const entries = viewer(page).locator('[data-od-source]');
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0)).toHaveText(
      '[1] Chen, Da-Wen, & Lin, Xiao-Ming (2024). Cloud Costs in Taiwan. Journal of Taiwan Studies, 12(3), 45–67.',
    );
    await expect(entries.nth(1)).toContainText(
      '陳大文、林小明（2023）。雲端架構實務。臺灣出版社。',
    );
    await expect(entries.nth(0).locator('em').first()).toHaveText('Journal of Taiwan Studies');

    const { findings } = await report(page);
    const rules = findings.map((f) => `${f.rule}:${f.severity}`);
    expect(rules).toContain('unresolved-cite:error');
    expect(rules).toContain('bad-chart:error');
    expect(findings.find((f) => f.rule === 'uncited-source')?.message).toContain('"unused"');
  });

  test('Word gets the charts as pictures and the bibliography as text', async ({ page }) => {
    await openDoc(page, DOC);
    const file = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: 'Download' }).click();
    await page.getByRole('menuitem', { name: 'DOCX' }).click();
    const chunks: Buffer[] = [];
    for await (const chunk of await (await file).createReadStream()) chunks.push(chunk as Buffer);
    const parts = unzipSync(new Uint8Array(Buffer.concat(chunks)));
    const media = Object.keys(parts).filter((name) => name.startsWith('word/media/'));
    expect(media.length).toBeGreaterThanOrEqual(2);
    const body = strFromU8(parts['word/document.xml'] as Uint8Array);
    expect(body).toContain('Journal of Taiwan Studies');
    expect(body).toContain('雲端架構實務');
  });
});
