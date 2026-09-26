import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendUsage, readUsage, totalsOf } from '../images/usage.ts';
import {
  maskKey,
  readOpenAiKey,
  removeOpenAiKey,
  saveOpenAiKey,
  validateOpenAiKey,
} from './user-data.ts';

const KEY = 'sk-test-0123456789abcdefWXYZ';
let home: string;
const saved = { home: process.env.MOSAGE_HOME, key: process.env.OPENAI_API_KEY };

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'mosage-home-'));
  process.env.MOSAGE_HOME = home;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  process.env.MOSAGE_HOME = saved.home;
  if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved.key;
});

describe('OpenAI key', () => {
  it('validates and masks', () => {
    expect(validateOpenAiKey(`  ${KEY} `)).toBe(KEY);
    expect(validateOpenAiKey('not-a-key')).toBeNull();
    expect(validateOpenAiKey('sk-short')).toBeNull();
    expect(maskKey(KEY)).toBe('sk-…WXYZ');
  });

  it('is saved outside the project, readable only by its owner, and removable', async () => {
    expect(await readOpenAiKey()).toBeNull();
    await saveOpenAiKey(KEY);
    expect(await readOpenAiKey()).toEqual({ key: KEY, source: 'saved' });
    const stat = await fs.stat(path.join(home, 'credentials.json'));
    if (process.platform !== 'win32') expect(stat.mode & 0o777).toBe(0o600);
    await removeOpenAiKey();
    expect(await readOpenAiKey()).toBeNull();
  });

  it('falls back to OPENAI_API_KEY, and a saved key wins over it', async () => {
    process.env.OPENAI_API_KEY = 'sk-env-0123456789abcdefghij';
    expect(await readOpenAiKey()).toMatchObject({ source: 'env' });
    await saveOpenAiKey(KEY);
    expect(await readOpenAiKey()).toMatchObject({ source: 'saved', key: KEY });
  });
});

describe('usage log', () => {
  it('appends entries and totals them, skipping a broken line', async () => {
    const entry = {
      ts: '2026-09-26T00:00:00.000Z',
      project: '/p',
      docId: 'a',
      imageId: 'x',
      model: 'gpt-image-2' as const,
      size: '1024x1024',
      quality: 'medium',
      inputTokens: 30,
      textInputTokens: 30,
      imageInputTokens: 0,
      outputTokens: 1000,
      costUsd: 0.03,
    };
    await appendUsage(entry);
    await fs.appendFile(path.join(home, 'openai-usage.jsonl'), '{"half":\n');
    await appendUsage({ ...entry, imageId: 'y', costUsd: 0.05 });
    const entries = await readUsage();
    expect(entries.map((e) => e.imageId)).toEqual(['x', 'y']);
    expect(totalsOf(entries)).toEqual({
      images: 2,
      inputTokens: 60,
      outputTokens: 2000,
      costUsd: 0.08,
    });
  });
});
