// A writing project on disk:
//
//   mosage.yaml     settings + chapter order
//   chapters/*.md   one Markdown file per chapter
//   assets/         images
//   notes/          brief, research, material — read by the AI, never exported
//   STYLE.md        voice and conventions the AI follows
//   .mosage/        local state: current.json, history snapshots (gitignored)
//   output/         exported files

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { type Document, isMap, parseDocument } from 'yaml';
import {
  type BookConfig,
  CHAPTER_STATUSES,
  type ChapterStatus,
  resolveConfig,
} from '../shared/config.ts';
import { setFrontmatter, setTitle } from '../shared/edits.ts';
import { parseChapter } from '../shared/markdown.ts';
import { History } from './history.ts';

export const CONFIG_FILE = 'mosage.yaml';

export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export interface ChapterSummary {
  id: string;
  title: string;
  status: ChapterStatus;
  summary: string;
  words: number;
  /** `##` headings — the chapter's sections, for the outline view. */
  sections: string[];
  /** Open notes from the author, waiting for the AI. */
  comments: number;
  /** Notes the AI left for the author. */
  aiNotes: number;
  /** AI rewrites waiting for accept / reject. */
  suggestions: number;
  listed: boolean;
  version: string;
  updatedAt: string;
}

export interface BookSummary {
  name: string;
  config: BookConfig;
  chapters: ChapterSummary[];
  /** Files in chapters/ that are not in the chapter order. */
  drafts: ChapterSummary[];
  /** Entries of the chapter order whose file is missing. */
  missing: string[];
  totals: { words: number; comments: number; aiNotes: number; suggestions: number };
  /** True for a freshly created project the AI has not set up yet. */
  fresh: boolean;
}

export function versionOf(source: string): string {
  return createHash('sha1').update(source).digest('hex').slice(0, 12);
}

export function isChapterId(id: string): boolean {
  return /^[^/\\]+\.md$/i.test(id) && !id.startsWith('.') && !id.includes('..');
}

function statusOf(value: unknown): ChapterStatus {
  return CHAPTER_STATUSES.includes(value as ChapterStatus) ? (value as ChapterStatus) : 'draft';
}

export function summarizeChapter(
  id: string,
  source: string,
  listed: boolean,
  updatedAt: Date,
): ChapterSummary {
  const parsed = parseChapter(source);
  let comments = 0;
  let aiNotes = 0;
  let suggestions = 0;
  for (const a of parsed.annotations) {
    if (a.kind === 'suggest') suggestions++;
    else if (a.by === 'ai') aiNotes++;
    else comments++;
  }
  const fm = parsed.frontmatter;
  return {
    id,
    title:
      parsed.title ||
      (typeof fm.title === 'string' ? fm.title : '') ||
      id.replace(/\.md$/i, ''),
    status: statusOf(fm.status),
    summary: typeof fm.summary === 'string' ? fm.summary : '',
    words: parsed.words,
    sections: parsed.headings.filter((h) => h.depth === 2).map((h) => h.text),
    comments,
    aiNotes,
    suggestions,
    listed,
    version: versionOf(source),
    updatedAt: updatedAt.toISOString(),
  };
}

function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export class Workspace {
  readonly history: History;

  constructor(readonly root: string) {
    this.history = new History(join(root, '.mosage', 'history'));
  }

  /** Walk up from `start` to the folder holding mosage.yaml. */
  static find(start = process.cwd()): Workspace {
    let dir = resolve(start);
    for (;;) {
      if (existsSync(join(dir, CONFIG_FILE))) return new Workspace(dir);
      const parent = dirname(dir);
      if (parent === dir) {
        throw new WorkspaceError(
          `找不到 ${CONFIG_FILE}。請在寫作專案資料夾裡執行，或先用 \`npx mosage init <資料夾>\` 建立專案。`,
          404,
        );
      }
      dir = parent;
    }
  }

  get configPath() {
    return join(this.root, CONFIG_FILE);
  }
  get chaptersDir() {
    return join(this.root, 'chapters');
  }
  get stateDir() {
    return join(this.root, '.mosage');
  }
  get outputDir() {
    return join(this.root, 'output');
  }

  chapterPath(id: string): string {
    if (!isChapterId(id)) throw new WorkspaceError(`不合法的章節檔名：${id}`);
    return join(this.chaptersDir, id);
  }

  async readConfigDocument(): Promise<Document> {
    const text = existsSync(this.configPath) ? await readFile(this.configPath, 'utf8') : '';
    return parseDocument(text);
  }

  async loadConfig(): Promise<BookConfig> {
    const doc = await this.readConfigDocument();
    return resolveConfig(doc.toJS());
  }

  /** Edit mosage.yaml in place, keeping the author's comments and layout. */
  async updateConfig(mutate: (doc: Document) => void): Promise<void> {
    const doc = await this.readConfigDocument();
    if (!isMap(doc.contents)) doc.contents = doc.createNode({}) as typeof doc.contents;
    mutate(doc);
    await writeFile(this.configPath, doc.toString({ lineWidth: 0 }));
  }

  async listChapterFiles(): Promise<string[]> {
    if (!existsSync(this.chaptersDir)) return [];
    const entries = await readdir(this.chaptersDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && isChapterId(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }

  async readChapter(id: string): Promise<{ id: string; source: string; version: string }> {
    const path = this.chapterPath(id);
    if (!existsSync(path)) throw new WorkspaceError(`找不到章節：${id}`, 404);
    const source = await readFile(path, 'utf8');
    return { id, source, version: versionOf(source) };
  }

  /**
   * Write a chapter. With `baseVersion`, refuse when the file changed since
   * the caller read it. The previous content goes to history first.
   */
  async writeChapter(id: string, source: string, baseVersion?: string): Promise<string> {
    const path = this.chapterPath(id);
    const previous = existsSync(path) ? await readFile(path, 'utf8') : null;
    if (baseVersion && previous !== null && versionOf(previous) !== baseVersion) {
      throw new WorkspaceError('這一章在你載入後被修改過了（可能是 AI 正在改）。請重新整理後再試。', 409);
    }
    if (previous === source) return versionOf(source);
    if (previous !== null) await this.history.snapshot(id, previous);
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.mosage-tmp`;
    await writeFile(tmp, source);
    await rename(tmp, path);
    this.history.remember(id, source);
    return versionOf(source);
  }

  /** Read–transform–write with a version check against what the client saw. */
  async transformChapter(
    id: string,
    transform: (source: string) => string,
    baseVersion?: string,
  ): Promise<string> {
    const { source, version } = await this.readChapter(id);
    if (baseVersion && baseVersion !== version) {
      throw new WorkspaceError('這一章在你載入後被修改過了（可能是 AI 正在改）。請重新整理後再試。', 409);
    }
    return this.writeChapter(id, transform(source), version);
  }

  async loadBook(): Promise<BookSummary> {
    const config = await this.loadConfig();
    const files = await this.listChapterFiles();
    const fileSet = new Set(files);
    const summaries = new Map<string, ChapterSummary>();
    const listedSet = new Set(config.chapters);
    await Promise.all(
      files.map(async (id) => {
        const path = this.chapterPath(id);
        const [source, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
        summaries.set(id, summarizeChapter(id, source, listedSet.has(id), info.mtime));
      }),
    );
    const chapters = config.chapters.filter((id) => fileSet.has(id)).map((id) => summaries.get(id)!);
    const drafts = files.filter((id) => !listedSet.has(id)).map((id) => summaries.get(id)!);
    const missing = config.chapters.filter((id) => !fileSet.has(id));
    const totals = { words: 0, comments: 0, aiNotes: 0, suggestions: 0 };
    for (const c of [...chapters, ...drafts]) {
      totals.words += c.listed ? c.words : 0;
      totals.comments += c.comments;
      totals.aiNotes += c.aiNotes;
      totals.suggestions += c.suggestions;
    }
    return {
      name: basename(this.root),
      config,
      chapters,
      drafts,
      missing,
      totals,
      fresh: config.stage === 'kickoff' && files.length === 0,
    };
  }

  /** The listed chapters with their sources, in reading order — export input. */
  async loadManuscript(): Promise<{ config: BookConfig; chapters: { id: string; source: string }[] }> {
    const config = await this.loadConfig();
    const files = new Set(await this.listChapterFiles());
    const ids = config.chapters.filter((id) => files.has(id));
    const chapters = await Promise.all(
      ids.map(async (id) => ({ id, source: await readFile(this.chapterPath(id), 'utf8') })),
    );
    return { config, chapters };
  }

  async setChapterOrder(ids: string[]): Promise<void> {
    for (const id of ids) if (!isChapterId(id)) throw new WorkspaceError(`不合法的章節檔名：${id}`);
    const unique = [...new Set(ids)];
    await this.updateConfig((doc) => {
      doc.set('chapters', doc.createNode(unique));
    });
  }

  async addToOrder(id: string, position?: number): Promise<void> {
    const config = await this.loadConfig();
    const order = config.chapters.filter((c) => c !== id);
    order.splice(position ?? order.length, 0, id);
    await this.setChapterOrder(order);
  }

  async removeFromOrder(id: string): Promise<void> {
    const config = await this.loadConfig();
    await this.setChapterOrder(config.chapters.filter((c) => c !== id));
  }

  /** Create `chapters/NN-slug.md` and append it to the chapter order. */
  async createChapter(
    title: string,
    opts: { summary?: string; status?: ChapterStatus; body?: string; listed?: boolean } = {},
  ): Promise<string> {
    const files = await this.listChapterFiles();
    const numbers = files.map((f) => Number.parseInt(f, 10)).filter(Number.isFinite);
    const next = numbers.length ? Math.max(...numbers) + 1 : 1;
    const slug = slugify(title) || 'chapter';
    let id = `${String(next).padStart(2, '0')}-${slug}.md`;
    for (let n = 2; files.includes(id); n++) id = `${String(next).padStart(2, '0')}-${slug}-${n}.md`;

    let source = `# ${title.trim() || '未命名章節'}\n\n${opts.body?.trim() ? `${opts.body.trim()}\n` : ''}`;
    source = setFrontmatter(source, 'status', opts.status ?? 'idea');
    if (opts.summary) source = setFrontmatter(source, 'summary', opts.summary);
    await this.writeChapter(id, source);
    if (opts.listed !== false) await this.addToOrder(id);
    return id;
  }

  async setChapterStatus(id: string, status: ChapterStatus, baseVersion?: string) {
    if (!CHAPTER_STATUSES.includes(status)) throw new WorkspaceError(`不合法的狀態：${status}`);
    return this.transformChapter(id, (s) => setFrontmatter(s, 'status', status), baseVersion);
  }

  async setChapterSummary(id: string, summary: string, baseVersion?: string) {
    return this.transformChapter(id, (s) => setFrontmatter(s, 'summary', summary.trim()), baseVersion);
  }

  async setChapterTitle(id: string, title: string, baseVersion?: string) {
    if (!title.trim()) throw new WorkspaceError('章節標題不能是空的');
    return this.transformChapter(id, (s) => setTitle(s, title), baseVersion);
  }

  /** Where the author is reading — for the `current-position` skill. */
  async writeCurrent(position: Record<string, unknown>): Promise<void> {
    await mkdir(this.stateDir, { recursive: true });
    await writeFile(
      join(this.stateDir, 'current.json'),
      `${JSON.stringify({ ...position, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    );
  }
}

