import { expect, test } from '@playwright/test';
import { deleteDoc, duplicateDoc, openDoc, refreshDocsModule, writeDocSource } from './helpers.ts';

type Finding = { page: number; rule: string; severity: string; message: string; loc?: string };
type Report = { pageCount: number; findings: Finding[] };

const FAULTY = `import { type DocMeta, type DocPage, Ref } from 'mosage';

export const meta: DocMeta = { title: 'Layout faults', createdAt: '2026-01-03T00:00:00.000Z' };

const sheet = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box' as const,
  padding: 76,
  background: '#ffffff',
  color: '#16181d',
  fontSize: 14,
};

const Overflowing: DocPage = () => (
  <div style={sheet}>
    {Array.from({ length: 70 }, (_, i) => (
      <p key={i}>Line {i + 1} of a page nobody measured.</p>
    ))}
  </div>
);

const Blank: DocPage = () => <div style={sheet} />;

const Small: DocPage = () => (
  <div style={sheet}>
    <p style={{ fontSize: 5 }}>Unreadable in print.</p>
    <p>
      See <Ref to="nothing-declares-this" />.
    </p>
  </div>
);

export default [Overflowing, Blank, Small] satisfies DocPage[];
`;

const CHINESE = `import type { DocMeta, DocPage } from 'mosage';

export const meta: DocMeta = { title: '中文排版', createdAt: '2026-01-03T00:00:00.000Z' };

const Page: DocPage = () => (
  <div style={{ padding: 76, fontSize: 14, color: '#16181d', background: '#ffffff', height: '100%' }}>
    <h1>第一章 概述</h1>
    <p>我們今天開會,討論了"預算"問題。</p>
    <p>臺北、臺中與臺灣，還有一處寫成台南。</p>
    <p>會議 10:30 開始，預算共 1,000 元，詳見 v2.0 版。</p>
    <pre>const pair = (1, 2); // 程式碼,不檢查</pre>
  </div>
);

export default [Page] satisfies DocPage[];
`;

const READY = 'globalThis.__mosage ? globalThis.__mosage.status().ready : false';

/**
 * The bridge `mosage export` and `mosage check` drive. Other specs write
 * to the shared fixture, and the reload that broadcasts tears down the context
 * mid-call — so wait for the bridge to come back and ask again.
 */
async function diagnose(page: import('@playwright/test').Page): Promise<Report> {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.waitForFunction(READY, undefined, { timeout: 15_000 });
      return (await page.evaluate('globalThis.__mosage.diagnose()')) as Report;
    } catch (err) {
      if (attempt >= 2) throw err;
    }
  }
}

test.describe('layout diagnostics', () => {
  test('a well-formed document reports nothing', async ({ page }) => {
    await openDoc(page, 'alpha');
    const report = await diagnose(page);
    expect(report.pageCount).toBe(3);
    expect(report.findings).toEqual([]);
  });

  test('the bridge only reports ready once the flow packer has run', async ({ page }) => {
    await openDoc(page, 'flow-report');
    await page.waitForFunction(READY, undefined, { timeout: 15_000 });
    const status = await page.evaluate('globalThis.__mosage.status()');
    // A flow section that had not been measured would come back as one page.
    expect((status as { ready: boolean; pageCount: number }).ready).toBe(true);
    expect((status as { pageCount: number }).pageCount).toBeGreaterThan(1);
  });

  test('clipped content, a blank sheet, and unreadable type are all caught', async ({
    page,
    request,
  }) => {
    await duplicateDoc(request, 'alpha', 'layout-faults');
    await writeDocSource('layout-faults', FAULTY);
    await refreshDocsModule('layout-faults');

    try {
      await openDoc(page, 'layout-faults');
      const report = await diagnose(page);
      const rules = report.findings.map((finding) => finding.rule);

      expect(rules).toContain('page-overflow');
      expect(rules).toContain('blank-page');
      expect(rules).toContain('tiny-text');
      expect(rules).toContain('unresolved-ref');

      const overflow = report.findings.find((finding) => finding.rule === 'page-overflow');
      expect(overflow?.page).toBe(1);
      expect(overflow?.severity).toBe('error');
      // The inspector's source tag is what makes a finding actionable.
      expect(overflow?.loc).toMatch(/^\d+:\d+$/);
    } finally {
      await deleteDoc(request, 'layout-faults');
    }
  });

  test('Chinese typography is flagged as warnings, leaving code and numbers alone', async ({
    page,
    request,
  }) => {
    await duplicateDoc(request, 'alpha', 'chinese-type');
    await writeDocSource('chinese-type', CHINESE);
    await refreshDocsModule('chinese-type');

    try {
      await openDoc(page, 'chinese-type');
      const { findings } = await diagnose(page);
      expect(findings.every((finding) => finding.severity === 'warn')).toBe(true);

      const messages = findings.map((finding) => `${finding.rule}: ${finding.message}`);
      expect(messages).toEqual([
        expect.stringMatching(
          /^cjk-punctuation: Half-width , beside Chinese — use the full-width ，: .*開會,討論/,
        ),
        expect.stringMatching(/^cjk-quotes: English quotation mark " beside Chinese — use 「/),
        expect.stringMatching(/^cjk-quotes: English quotation mark " beside Chinese — use 」/),
        expect.stringMatching(/^mixed-variants: Both 台 \(1×\) and 臺 \(3×\)/),
      ]);
      expect(findings.every((finding) => /^\d+:\d+$/.test(finding.loc ?? ''))).toBe(true);
    } finally {
      await deleteDoc(request, 'chinese-type');
    }
  });
});
