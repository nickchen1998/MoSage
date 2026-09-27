import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { devScratchDir, E2E_ENV, MOCK_OPENAI_KEY, openDoc, pages } from './helpers.ts';

const settingsFile = path.join(devScratchDir, '.mosage', 'settings.json');

test.describe.configure({ mode: 'serial' });

test.describe('settings', () => {
  test.afterAll(async ({ request }) => {
    await request.patch('/__settings', {
      data: { imageGeneration: { mode: 'off', documents: { alpha: true } } },
    });
    await request.delete('/__settings/openai-key');
  });

  test('text size scales the app, never the page', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /^Larger/ }).click();
    const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await expect.poll(rootSize).toBe('20px');

    // The choice survives a reload and follows into the document view…
    await openDoc(page, 'alpha');
    expect(await rootSize()).toBe('20px');
    // …where the sheet keeps its real width.
    const width = await pages(page)
      .first()
      .evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe('794px');

    await page.goto('/settings');
    await page.getByRole('button', { name: /^Default/ }).click();
    await expect.poll(rootSize).toBe('16px');
  });

  test('the interface speaks Traditional Chinese, and the pages stay as written', async ({
    page,
  }) => {
    await openDoc(page, 'alpha');
    const sheets = await pages(page).count();
    const text = await pages(page).first().innerText();

    await page.goto('/settings');
    await page.getByRole('button', { name: '繁體中文' }).click();
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();
    await expect(page.getByRole('button', { name: '跟隨瀏覽器' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Kept for the next visit, and the document is what it was: same sheets, same words.
    await openDoc(page, 'alpha');
    await expect(page.getByRole('button', { name: '下載' })).toBeVisible();
    await expect(page.getByRole('button', { name: '大綱', exact: true })).toBeVisible();
    expect(await pages(page).count()).toBe(sheets);
    expect(await pages(page).first().innerText()).toBe(text);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('the image mode and per-document switches are saved with the project', async ({ page }) => {
    await page.goto('/settings');
    await page.getByText('Leave prompts for Codex').click();
    await expect
      .poll(async () => JSON.parse(await fs.readFile(settingsFile, 'utf8')).imageGeneration.mode)
      .toBe('codex');

    await page.getByRole('switch', { name: 'Generated images in alpha' }).click();
    await expect
      .poll(
        async () => JSON.parse(await fs.readFile(settingsFile, 'utf8')).imageGeneration.documents,
      )
      .toMatchObject({ alpha: false });
  });

  test('an API key is kept on this machine, and only its last characters come back', async ({
    page,
    request,
  }) => {
    await page.goto('/settings');
    await page.getByText('OpenAI API', { exact: true }).click();
    await page.getByLabel('OpenAI API key').fill(MOCK_OPENAI_KEY);
    await page.getByRole('button', { name: 'Save key' }).click();
    await expect(page.getByText(`sk-…${MOCK_OPENAI_KEY.slice(-4)}`)).toBeVisible();

    const body = await (await request.get('/__settings')).text();
    expect(body).not.toContain(MOCK_OPENAI_KEY);
    const stored = await fs.readFile(path.join(E2E_ENV.MOSAGE_HOME, 'credentials.json'), 'utf8');
    expect(stored).toContain(MOCK_OPENAI_KEY);
    // Never in the project, where it could be committed.
    expect(await fs.readFile(settingsFile, 'utf8')).not.toContain(MOCK_OPENAI_KEY);
  });

  test('a malformed key is refused', async ({ request }) => {
    const res = await request.put('/__settings/openai-key', { data: { key: 'hello' } });
    expect(res.status()).toBe(400);
  });
});

test.describe('a Chinese browser', () => {
  test.use({ locale: 'zh-TW' });

  test('gets the Chinese interface until another language is chosen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '未歸檔' })).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: '跟隨瀏覽器' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
