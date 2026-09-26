import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIRequestContext, expect, type Locator, type Page } from '@playwright/test';
import { DEV_SERVER_PORT } from '../../playwright.config.ts';

export { fixtureDir, prepareScratchProject } from '../scratch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export const devServerUrl = `http://127.0.0.1:${DEV_SERVER_PORT}`;

export const coreRoot = path.resolve(here, '..', '..');
export const coreBin = path.join(coreRoot, 'bin.js');
export const devScratchDir = path.join(coreRoot, 'e2e', '.scratch', 'dev');

export function docSourcePath(docId: string, projectDir = devScratchDir): string {
  return path.join(projectDir, 'docs', docId, 'index.tsx');
}

export function readDocSource(docId: string, projectDir = devScratchDir): Promise<string> {
  return fs.readFile(docSourcePath(docId, projectDir), 'utf8');
}

export function writeDocSource(
  docId: string,
  source: string,
  projectDir = devScratchDir,
): Promise<void> {
  return fs.writeFile(docSourcePath(docId, projectDir), source, 'utf8');
}

/** The scrolling pane that holds the real sheets — not the thumbnail rail. */
export function viewer(page: Page): Locator {
  return page.locator('[data-od-viewer]');
}

/** The rendered sheets in the viewer. Thumbnails are page frames too, so
 * anything counting or reading pages must scope to the viewer pane. */
export function pages(page: Page): Locator {
  return viewer(page).locator('[data-od-page]');
}

// The first visit per page load waits on fonts and the flow measurement pass,
// and a document created moments earlier can 404 until the docs virtual module
// refreshes (watcher debounce) — so retry with a reload.
export async function openDoc(page: Page, docId: string, query = ''): Promise<void> {
  await page.goto(`/d/${docId}${query}`);
  for (let attempt = 0; ; attempt++) {
    try {
      await expect(pages(page).first()).toBeVisible({ timeout: 15_000 });
      return;
    } catch (err) {
      if (attempt >= 2) throw err;
      await page.reload();
    }
  }
}

// The dev server's file watcher does not pick up newly created document
// directories on Linux, so the docs virtual module stays stale after one is
// created on disk. Touching a watched file forces the module to regenerate.
export async function refreshDocsModule(expectedDocId: string): Promise<void> {
  const watched = docSourcePath('edit-target');
  await fs.writeFile(watched, await fs.readFile(watched, 'utf8'));
  await expect
    .poll(
      async () => {
        const res = await fetch(`${devServerUrl}/@id/__x00__virtual:open-doc/docs`);
        return res.ok ? await res.text() : '';
      },
      { timeout: 15_000 },
    )
    .toContain(`"${expectedDocId}"`);
}

// Deleting first makes the call retry-safe: a CI retry that runs after a
// half-completed attempt would otherwise hit 409 "document already exists".
export async function duplicateDoc(
  request: APIRequestContext,
  sourceId: string,
  newId: string,
): Promise<void> {
  await deleteDoc(request, newId);
  const res = await request.post(`/__docs/${sourceId}/duplicate`, { data: { newId } });
  expect(res.ok(), `duplicate ${sourceId} -> ${res.status()}`).toBe(true);
  await refreshDocsModule(newId);
}

export async function deleteDoc(request: APIRequestContext, docId: string): Promise<void> {
  const res = await request.delete(`/__docs/${docId}`);
  expect(res.ok() || res.status() === 404, `delete ${docId} -> ${res.status()}`).toBe(true);
}

export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(args: string[], cwd: string, timeoutMs = 180_000): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [coreBin, ...args], {
      cwd,
      env: { ...process.env, OPEN_DOC_SKIP_SKILLS_CHECK: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`open-doc ${args.join(' ')} timed out after ${timeoutMs}ms\n${stderr}`));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

export function startCliServer(args: string[], cwd: string): ChildProcess {
  return spawn(process.execPath, [coreBin, ...args], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, OPEN_DOC_SKIP_SKILLS_CHECK: '1' },
  });
}

export async function waitForHttpOk(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server at ${url} never became ready: ${String(lastError)}`);
}

export async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) return;
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
  });
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, 5_000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
