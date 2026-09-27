import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  devScratchDir,
  MOCK_OPENAI_KEY,
  openDoc,
  readDocSource,
  runCli,
  TINY_PNG,
  viewer,
  writeDocSource,
} from './helpers.ts';

function withPrompt(source: string, id: string): string {
  return source
    .replace(
      "import type { DocMeta, DocPage } from 'mosage';",
      "import { type DocMeta, type DocPage, ImagePrompt } from 'mosage';",
    )
    .replace(
      '<p>Opening content</p>',
      `<p>Opening content</p>
    <ImagePrompt id="${id}" prompt="A calm harbour at dawn, no text" alt="Harbour" width={642} height={300} />`,
    );
}

test.describe.configure({ mode: 'serial' });

test.describe('generated images', () => {
  let original = '';

  test.beforeAll(async ({ request }) => {
    original = await readDocSource('alpha');
    await request.put('/__settings/openai-key', { data: { key: MOCK_OPENAI_KEY } });
  });

  test.afterEach(async ({ request }) => {
    await writeDocSource('alpha', original);
    await fs.rm(path.join(devScratchDir, 'docs', 'alpha', 'assets', 'images'), {
      recursive: true,
      force: true,
    });
    await request.patch('/__settings', {
      data: { imageGeneration: { mode: 'off', documents: { alpha: true } } },
    });
  });

  test.afterAll(async ({ request }) => {
    await request.delete('/__settings/openai-key');
  });

  test('OpenAI mode: Generate draws the prompt, saves it under images/, and swaps it in', async ({
    page,
    request,
  }) => {
    await request.patch('/__settings', { data: { imageGeneration: { mode: 'openai' } } });
    await writeDocSource('alpha', withPrompt(original, 'harbour'));
    const before = (await (await request.get('/__settings/usage')).json()).totals.images;

    await openDoc(page, 'alpha');
    // The prompt holds the image's real size on the page before it exists.
    const box = viewer(page).locator('[data-od-image-prompt="harbour"]');
    await expect(box).toBeVisible();
    expect(await box.evaluate((el) => (el as HTMLElement).style.height)).toBe('300px');

    await page.getByRole('button', { name: 'Assets', exact: true }).click();
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(page.getByText(/harbour: done · about \$/)).toBeVisible({ timeout: 20_000 });

    const source = await readDocSource('alpha');
    expect(source).toContain("import imgHarbour from './assets/images/harbour.png';");
    expect(source).toContain('<img src={imgHarbour}');
    expect(source).not.toContain('ImagePrompt');
    await fs.access(path.join(devScratchDir, 'docs', 'alpha', 'assets', 'images', 'harbour.png'));
    await expect(viewer(page).locator('img[alt="Harbour"]')).toBeVisible();

    const usage = await (await request.get('/__settings/usage')).json();
    expect(usage.totals.images).toBe(before + 1);
    expect(usage.recent[0]).toMatchObject({
      project: path.basename(devScratchDir),
      docId: 'alpha',
      imageId: 'harbour',
      model: 'gpt-image-2',
    });
    expect(usage.recent[0].outputTokens).toBeGreaterThan(0);
    expect(usage.recent[0].costUsd).toBeGreaterThan(0);
  });

  test('a key OpenAI rejects is reported, and nothing is written', async ({ request }) => {
    await request.patch('/__settings', { data: { imageGeneration: { mode: 'openai' } } });
    await request.put('/__settings/openai-key', { data: { key: 'sk-wrong-0123456789abcdefghij' } });
    await writeDocSource('alpha', withPrompt(original, 'harbour'));

    const res = await request.post('/__images/generate', {
      data: { docId: 'alpha', id: 'harbour' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toContain('rejected the API key');
    expect(await readDocSource('alpha')).toContain('<ImagePrompt id="harbour"');

    await request.put('/__settings/openai-key', { data: { key: MOCK_OPENAI_KEY } });
  });

  test('a document switched off is not drawn', async ({ request }) => {
    await request.patch('/__settings', {
      data: { imageGeneration: { mode: 'openai', documents: { alpha: false } } },
    });
    await writeDocSource('alpha', withPrompt(original, 'harbour'));
    const res = await request.post('/__images/generate', {
      data: { docId: 'alpha', id: 'harbour' },
    });
    expect(res.status()).toBe(409);
  });

  test('Codex mode: the CLI lists the prompt, and places the image once it is drawn', async ({
    request,
  }) => {
    await request.patch('/__settings', { data: { imageGeneration: { mode: 'codex' } } });
    await writeDocSource('alpha', withPrompt(original, 'harbour'));

    const listed = await runCli(['images', '--json', '--doc', 'alpha'], devScratchDir);
    expect(listed.code, listed.stderr).toBe(0);
    const report = JSON.parse(listed.stdout);
    expect(report.mode).toBe('codex');
    expect(report.documents).toEqual({ alpha: true });
    const [prompt] = report.prompts;
    expect(prompt).toMatchObject({
      id: 'harbour',
      file: 'docs/alpha/assets/images/harbour.png',
      ready: false,
    });

    // What Codex does: draw the image and save it at `file`.
    const file = path.join(devScratchDir, prompt.file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, TINY_PNG);

    const placed = await runCli(['images', 'place', 'alpha'], devScratchDir);
    expect(placed.code, placed.stderr).toBe(0);
    const source = await readDocSource('alpha');
    expect(source).toContain("'./assets/images/harbour.png'");
    expect(source).not.toContain('ImagePrompt');
  });
});
