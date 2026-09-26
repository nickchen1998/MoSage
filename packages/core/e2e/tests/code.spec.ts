import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { CODE_REMOTE_DIR, CODE_REMOTE_URL } from '../../playwright.config.ts';
import { devScratchDir, openDoc, runCli, viewer } from './helpers.ts';

const codeDir = path.join(devScratchDir, 'code');
const transform = path.join(codeDir, 'etl', 'transform.py');

const statuses = (page: Page) =>
  viewer(page)
    .locator('[data-od-code]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-od-code-status')).join(','));

test.describe.configure({ mode: 'serial' });

test.describe('code excerpts', () => {
  let original = '';

  test.beforeAll(async () => {
    original = await fs.readFile(transform, 'utf8');
    await fs.rm(CODE_REMOTE_DIR, { recursive: true, force: true });
    execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', CODE_REMOTE_DIR]);
  });

  test.afterAll(async () => {
    await fs.writeFile(transform, original);
    await fs.rm(path.join(codeDir, '.git'), { recursive: true, force: true });
  });

  test('an excerpt prints the file’s own line numbers and is numbered like a figure', async ({
    page,
  }) => {
    await openDoc(page, 'code-listing');
    const first = viewer(page).locator('[data-od-code="etl/transform.py"]');
    await expect(first).toContainText('第 4–16 行');
    await expect(first).toContainText('def clean_orders(df, rates):');
    await expect(first).toContainText('省略第 8–12 行');
    // Omitted lines are gone; the lines around them keep their numbers.
    await expect(first).not.toContainText('Convert at the rate');
    await expect(first.locator('p').filter({ hasText: 'return df' })).toContainText('16');
    await expect(viewer(page).locator('span[data-od-ref="clean"]')).toHaveText('程式 1');
    // Not connected: no link is printed.
    expect(await statuses(page)).toBe('local,local');
    await expect(first.locator('figcaption a')).toHaveCount(0);
  });

  test('connecting and pushing from the panel links every excerpt to that commit', async ({
    page,
  }) => {
    await openDoc(page, 'code-listing');
    await page.getByRole('button', { name: /程式碼/ }).click();
    const panel = page.getByRole('complementary', { name: 'Code' });
    await panel.getByLabel(/Repository address/).fill(CODE_REMOTE_URL);
    await panel.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect.poll(() => statuses(page), { timeout: 20_000 }).toBe('new,new');
    await expect(panel.getByText('acme/q3-code')).toBeVisible();

    await panel.getByRole('button', { name: 'Push 2 files to GitHub' }).click();
    await expect.poll(() => statuses(page), { timeout: 20_000 }).toBe('pushed,pushed');

    const sha = execFileSync('git', ['-C', CODE_REMOTE_DIR, 'rev-parse', 'main'], {
      encoding: 'utf8',
    }).trim();
    const link = viewer(page).locator('[data-od-code="etl/transform.py"] figcaption a');
    await expect(link).toHaveAttribute(
      'href',
      `https://github.com/acme/q3-code/blob/${sha}/etl/transform.py#L4-L16`,
    );
    await expect(link).toHaveText(
      `github.com/acme/q3-code/blob/${sha.slice(0, 12)}/etl/transform.py#L4-L16`,
    );
    // The panel stays open: the documents reload in place, not the page.
    await expect(panel).toBeVisible();
  });

  test('an edit inside the excerpt is flagged, and the download asks first', async ({ page }) => {
    await openDoc(page, 'code-listing');
    await fs.writeFile(
      transform,
      original.replace('keeps only its latest update', 'keeps the last'),
    );
    await expect.poll(() => statuses(page), { timeout: 20_000 }).toBe('changed,pushed');
    await expect(page.getByRole('status', { name: '1 not pushed' })).toBeVisible();

    await page.getByRole('button', { name: 'Download' }).click();
    await page.getByRole('menuitem', { name: /DOCX/ }).click();
    const dialog = page.getByRole('dialog', { name: /isn't on GitHub yet/ });
    await expect(dialog).toContainText('etl/transform.py');
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export anyway' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.docx$/);
  });

  test('check reports what the printed links would not show', async ({ page }) => {
    await openDoc(page, 'code-listing');
    await expect.poll(() => statuses(page), { timeout: 20_000 }).toBe('changed,pushed');
    const report = await page.evaluate(async () => {
      const bridge = (
        window as unknown as {
          __mosage: { diagnose(): Promise<{ findings: Array<{ rule: string; message: string }> }> };
        }
      ).__mosage;
      return bridge.diagnose();
    });
    const finding = report.findings.find((f) => f.rule === 'unpushed-code');
    expect(finding?.message).toContain('etl/transform.py changed since it was pushed');
  });

  test('Assets → 程式碼 shows the repository tree against what is pushed', async ({ page }) => {
    await page.goto('/assets');
    const nav = page.getByRole('navigation', { name: 'Asset folders' });
    await nav.getByRole('button', { name: '程式碼', exact: true }).click();
    const tree = page.getByRole('list', { name: 'Files in code/' });
    await expect(tree.getByRole('button', { name: /etl/ })).toBeVisible();
    await expect(tree.getByRole('button', { name: /transform\.py/ })).toContainText('Changed');
    await expect(tree.getByRole('button', { name: /monthly_revenue\.sql/ })).not.toContainText(
      'Changed',
    );

    await tree.getByRole('button', { name: /transform\.py/ }).click();
    const preview = page.getByRole('dialog', { name: 'etl/transform.py' });
    await expect(preview).toContainText('TEST_ACCOUNTS');
    await expect(preview.getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute(
      'href',
      /github\.com\/acme\/q3-code\/blob\/[0-9a-f]{40}\/etl\/transform\.py$/,
    );
  });

  test('mosage code reports and pushes from the command line', async () => {
    const status = await runCli(['code', '--json'], devScratchDir);
    expect(status.code, status.stderr).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      isRepo: true,
      remote: { host: 'github', slug: 'acme/q3-code' },
      changes: [{ path: 'etl/transform.py', state: 'modified' }],
    });

    const pushed = await runCli(['code', 'push', '-m', 'From the CLI'], devScratchDir);
    expect(pushed.code, pushed.stderr).toBe(0);
    expect(
      execFileSync('git', ['-C', CODE_REMOTE_DIR, 'log', '-1', '--format=%s', 'main'], {
        encoding: 'utf8',
      }).trim(),
    ).toBe('From the CLI');

    const refused = await runCli(
      ['code', 'connect', 'https://bitbucket.org/acme/x.git'],
      devScratchDir,
    );
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain('not a GitHub or GitLab repository address');
  });
});
