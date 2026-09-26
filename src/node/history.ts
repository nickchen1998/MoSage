// Automatic snapshots — the safety net for writing with an AI. Before a
// chapter changes (from the UI, the AI, or any editor) its previous content is
// saved to .mosage/history/<chapter>/<time>.md. A burst of edits within
// QUIET_MS keeps only the state from before the burst.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { countWords } from '../shared/wordcount.ts';

const QUIET_MS = 90_000;
const KEEP = 100;

export interface Snapshot {
  id: string;
  at: string;
  words: number;
  size: number;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function parseStamp(name: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(name);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z` : name;
}

export class History {
  private known = new Map<string, string>();
  private lastSnapshot = new Map<string, number>();

  constructor(readonly dir: string) {}

  private chapterDir(id: string) {
    return join(this.dir, id.replace(/\.md$/i, ''));
  }

  /** Record the content we last saw on disk, without snapshotting. */
  remember(id: string, content: string) {
    this.known.set(id, content);
  }

  /** A watcher saw the file change: snapshot what it was before. */
  async observe(id: string, content: string): Promise<boolean> {
    const before = this.known.get(id);
    this.known.set(id, content);
    if (before === undefined || before === content) return false;
    await this.snapshot(id, before);
    return true;
  }

  async snapshot(id: string, content: string, force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - (this.lastSnapshot.get(id) ?? 0) < QUIET_MS) return;
    this.lastSnapshot.set(id, now);
    const dir = this.chapterDir(id);
    await mkdir(dir, { recursive: true });
    const names = (await readdir(dir)).filter((n) => n.endsWith('.md')).sort();
    const latest = names.at(-1);
    if (latest && (await readFile(join(dir, latest), 'utf8')) === content) return;
    await writeFile(join(dir, `${stamp(new Date(now))}.md`), content);
    for (const old of names.slice(0, Math.max(0, names.length + 1 - KEEP))) {
      await rm(join(dir, old), { force: true });
    }
  }

  async list(id: string): Promise<Snapshot[]> {
    const dir = this.chapterDir(id);
    if (!existsSync(dir)) return [];
    const names = (await readdir(dir))
      .filter((n) => n.endsWith('.md'))
      .sort()
      .reverse();
    return Promise.all(
      names.map(async (name) => {
        const content = await readFile(join(dir, name), 'utf8');
        return {
          id: name.replace(/\.md$/, ''),
          at: parseStamp(name),
          words: countWords(content),
          size: content.length,
        };
      }),
    );
  }

  async read(id: string, snapshotId: string): Promise<string> {
    if (!/^[\w-]+$/.test(snapshotId)) throw new Error('invalid snapshot id');
    return readFile(join(this.chapterDir(id), `${snapshotId}.md`), 'utf8');
  }
}
