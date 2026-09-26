import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Per-person data that must never land in a project folder, where it could be
 * committed: the OpenAI key and the record of what it has been spent on.
 * `MOSAGE_HOME` moves it, which is how tests keep away from the real one.
 */
export function mosageHome(): string {
  return process.env.MOSAGE_HOME || path.join(os.homedir(), '.mosage');
}

const credentialsFile = () => path.join(mosageHome(), 'credentials.json');

export type OpenAiKey = { key: string; source: 'saved' | 'env' };

export function validateOpenAiKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const key = v.trim();
  return /^sk-[A-Za-z0-9_-]{16,}$/.test(key) ? key : null;
}

/** Enough to recognise a key, never enough to use it. */
export function maskKey(key: string): string {
  return `sk-…${key.slice(-4)}`;
}

async function readCredentials(): Promise<{ openaiApiKey?: string }> {
  try {
    const parsed = JSON.parse(await fs.readFile(credentialsFile(), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCredentials(data: { openaiApiKey?: string }): Promise<void> {
  const file = credentialsFile();
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
  await fs.chmod(file, 0o600);
}

/** The key saved from the settings page wins; `OPENAI_API_KEY` is the fallback. */
export async function readOpenAiKey(): Promise<OpenAiKey | null> {
  const saved = validateOpenAiKey((await readCredentials()).openaiApiKey);
  if (saved) return { key: saved, source: 'saved' };
  const env = validateOpenAiKey(process.env.OPENAI_API_KEY);
  return env ? { key: env, source: 'env' } : null;
}

export async function saveOpenAiKey(key: string): Promise<void> {
  await writeCredentials({ ...(await readCredentials()), openaiApiKey: key });
}

export async function removeOpenAiKey(): Promise<void> {
  const { openaiApiKey: _removed, ...rest } = await readCredentials();
  await writeCredentials(rest);
}
