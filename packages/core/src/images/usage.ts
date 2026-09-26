import fs from 'node:fs/promises';
import path from 'node:path';
import { mosageHome } from '../files/user-data.ts';
import type { ImageModel, ImageTokenUsage } from './pricing.ts';

/** One call to the Images API, as recorded after it succeeded. */
export type UsageEntry = ImageTokenUsage & {
  ts: string;
  /** Absolute project folder, so one log can answer for every project on the machine. */
  project: string;
  docId: string;
  imageId: string;
  model: ImageModel;
  size: string;
  quality: string;
  costUsd: number;
};

export type UsageTotals = {
  images: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

const usageFile = () => path.join(mosageHome(), 'openai-usage.jsonl');

export async function appendUsage(entry: UsageEntry): Promise<void> {
  const file = usageFile();
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
}

/** Every recorded call, oldest first. A line that no longer parses is skipped, not fatal. */
export async function readUsage(): Promise<UsageEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(usageFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const out: UsageEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as UsageEntry;
      if (typeof entry.costUsd === 'number' && typeof entry.outputTokens === 'number') {
        out.push(entry);
      }
    } catch {
      // A half-written line from an interrupted append.
    }
  }
  return out;
}

export function totalsOf(entries: UsageEntry[]): UsageTotals {
  return entries.reduce<UsageTotals>(
    (sum, e) => ({
      images: sum.images + 1,
      inputTokens: sum.inputTokens + e.inputTokens,
      outputTokens: sum.outputTokens + e.outputTokens,
      costUsd: sum.costUsd + e.costUsd,
    }),
    { images: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  );
}
