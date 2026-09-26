// One book (or thesis) inside a project:
//
//   books/<id>/
//     book.yaml       settings + chapter order (overrides the project's mosage.yaml)
//     brief.md        寫作企劃 — purpose, readers, promise; written at kickoff
//     STYLE.md        voice and conventions the AI follows
//     chapters/*.md   one Markdown file per chapter
//     assets/         images
//     notes/          research and material — read by the AI, never exported

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { type Document, isMap, parseDocument } from 'yaml';
import {
  type BookConfig,
  CHAPTER_STATUSES,
  type ChapterStatus,
  mergeConfig,
  resolveConfig,
} from '../shared/config.ts';
import { setFrontmatter, setTitle } from '../shared/edits.ts';
import { parseChapter } from '../shared/markdown.ts';
import type { History } from './history.ts';
import type { Project } from './project.ts';

export const BOOK_FILE = 'book.yaml';

export class ProjectError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ProjectError';
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
  id: string;
  config: BookConfig;
  chapters: ChapterSummary[];
  /** Files in chapters/ that are not in the chapter order. */
  drafts: ChapterSummary[];
  /** Entries of the chapter order whose file is missing. */
  missing: string[];
  totals: { words: number; comments: number; aiNotes: number; suggestions: number };
  /** Whether brief.md has been written (kickoff done). */
  hasBrief: boolean;
  updatedAt: string;
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
      parsed.title || (typeof fm.title === 'string' ? fm.title : '') || id.replace(/\.md$/i, ''),
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

export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const BRIEF_PLACEHOLDER = '（尚未進行立項訪談）';

export type FileFolder = 'assets' | 'notes';

export interface FileEntry {
  /** Path inside the folder, `/`-separated (e.g. `imported/fig-1.png`). */
  name: string;
  /** Path from the book root, for Markdown links: `assets/…` or `notes/…`. */
  path: string;
  size: number;
  updatedAt: string;
  /** Assets only: referenced by some chapter. */
  used?: boolean;
}

/** Keep uploaded file names readable (CJK is fine) but safe on every OS. */
export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const clean = [...base.normalize('NFC')]
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return clean || 'file';
}

export class Book {
  constructor(
    readonly project: Project,
    readonly id: string,
  ) {}

  get root() {
    return join(this.project.booksDir, this.id);
  }
  get configPath() {
    return join(this.root, BOOK_FILE);
  }
  get chaptersDir() {
    return join(this.root, 'chapters');
  }
  get outputDir() {
    return join(this.project.root, 'output', this.id);
  }
  get history(): History {
    return this.project.historyFor(this.id);
  }

  exists(): boolean {
    return existsSync(this.configPath);
  }

  chapterPath(id: string): string {
    if (!isChapterId(id)) throw new ProjectError(`不合法的章節檔名：${id}`);
    return join(this.chaptersDir, id);
  }

  async readConfigDocument(): Promise<Document> {
    const text = existsSync(this.configPath) ? await readFile(this.configPath, 'utf8') : '';
    return parseDocument(text);
  }

  async loadConfig(): Promise<BookConfig> {
    const [defaults, own] = await Promise.all([
      this.project.loadDefaults(),
      this.readConfigDocument(),
    ]);
    return resolveConfig(mergeConfig(defaults, own.toJS()));
  }

  /** Edit book.yaml in place, keeping the author's comments and layout. */
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
    if (!existsSync(path)) throw new ProjectError(`找不到章節：${id}`, 404);
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
      throw new ProjectError(
        '這一章在你載入後被修改過了（可能是 AI 正在改）。請重新整理後再試。',
        409,
      );
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
      throw new ProjectError(
        '這一章在你載入後被修改過了（可能是 AI 正在改）。請重新整理後再試。',
        409,
      );
    }
    return this.writeChapter(id, transform(source), version);
  }

  async hasBrief(): Promise<boolean> {
    const path = join(this.root, 'brief.md');
    if (!existsSync(path)) return false;
    return !(await readFile(path, 'utf8')).includes(BRIEF_PLACEHOLDER);
  }

  async summarize(): Promise<BookSummary> {
    const config = await this.loadConfig();
    const files = await this.listChapterFiles();
    const fileSet = new Set(files);
    const listedSet = new Set(config.chapters);
    const summaries = new Map<string, ChapterSummary>();
    let updated = existsSync(this.configPath) ? (await stat(this.configPath)).mtime : new Date(0);
    await Promise.all(
      files.map(async (id) => {
        const path = this.chapterPath(id);
        const [source, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
        if (info.mtime > updated) updated = info.mtime;
        summaries.set(id, summarizeChapter(id, source, listedSet.has(id), info.mtime));
      }),
    );
    const chapters = config.chapters
      .filter((id) => fileSet.has(id))
      .map((id) => summaries.get(id)!);
    const drafts = files.filter((id) => !listedSet.has(id)).map((id) => summaries.get(id)!);
    const totals = { words: 0, comments: 0, aiNotes: 0, suggestions: 0 };
    for (const c of [...chapters, ...drafts]) {
      totals.words += c.listed ? c.words : 0;
      totals.comments += c.comments;
      totals.aiNotes += c.aiNotes;
      totals.suggestions += c.suggestions;
    }
    return {
      id: this.id,
      config,
      chapters,
      drafts,
      missing: config.chapters.filter((id) => !fileSet.has(id)),
      totals,
      hasBrief: await this.hasBrief(),
      updatedAt: updated.toISOString(),
    };
  }

  /** The listed chapters with their sources, in reading order — export input. */
  async loadManuscript(): Promise<{
    config: BookConfig;
    chapters: { id: string; source: string }[];
  }> {
    const config = await this.loadConfig();
    const files = new Set(await this.listChapterFiles());
    const ids = config.chapters.filter((id) => files.has(id));
    const chapters = await Promise.all(
      ids.map(async (id) => ({ id, source: await readFile(this.chapterPath(id), 'utf8') })),
    );
    return { config, chapters };
  }

  async setChapterOrder(ids: string[]): Promise<void> {
    for (const id of ids) if (!isChapterId(id)) throw new ProjectError(`不合法的章節檔名：${id}`);
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
    const next = String(numbers.length ? Math.max(...numbers) + 1 : 1).padStart(2, '0');
    const slug = slugify(title) || 'chapter';
    let id = `${next}-${slug}.md`;
    for (let n = 2; files.includes(id); n++) id = `${next}-${slug}-${n}.md`;

    const body = opts.body?.trim() ? `${opts.body.trim()}\n` : '';
    let source = `# ${title.trim() || '未命名章節'}\n\n${body}`;
    source = setFrontmatter(source, 'status', opts.status ?? 'idea');
    if (opts.summary) source = setFrontmatter(source, 'summary', opts.summary);
    await this.writeChapter(id, source);
    if (opts.listed !== false) await this.addToOrder(id);
    return id;
  }

  folderPath(folder: FileFolder): string {
    if (folder !== 'assets' && folder !== 'notes')
      throw new ProjectError(`不合法的資料夾：${folder}`);
    return join(this.root, folder);
  }

  /** Everything under assets/ and notes/ — images and reference material. */
  async listFiles(): Promise<Record<FileFolder, FileEntry[]>> {
    const chapterSources = await Promise.all(
      (await this.listChapterFiles()).map((id) => readFile(this.chapterPath(id), 'utf8')),
    );
    const everything = chapterSources.join('\n');
    const walk = async (folder: FileFolder): Promise<FileEntry[]> => {
      const base = this.folderPath(folder);
      if (!existsSync(base)) return [];
      const entries = await readdir(base, { recursive: true, withFileTypes: true });
      const files: FileEntry[] = [];
      for (const e of entries) {
        if (!e.isFile() || e.name.startsWith('.')) continue;
        const full = join(e.parentPath, e.name);
        const name = relative(base, full).split(sep).join('/');
        if (name.split('/').some((seg) => seg.startsWith('.'))) continue;
        const info = await stat(full);
        files.push({
          name,
          path: `${folder}/${name}`,
          size: info.size,
          updatedAt: info.mtime.toISOString(),
          used:
            folder === 'assets'
              ? everything.includes(name) || everything.includes(encodeURI(name))
              : undefined,
        });
      }
      return files.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    };
    return { assets: await walk('assets'), notes: await walk('notes') };
  }

  /** Copy a file into assets/ or notes/, never overwriting. Returns its name. */
  async saveFile(folder: FileFolder, name: string, data: Buffer): Promise<string> {
    const dir = this.folderPath(folder);
    await mkdir(dir, { recursive: true });
    const clean = safeFileName(name);
    const ext = extname(clean);
    const stem = clean.slice(0, clean.length - ext.length);
    let final = clean;
    for (let n = 2; existsSync(join(dir, final)); n++) final = `${stem}-${n}${ext}`;
    await writeFile(join(dir, final), data);
    return final;
  }

  /** Move a file to .mosage/trash instead of deleting it. */
  async trashFile(folder: FileFolder, name: string): Promise<void> {
    const base = this.folderPath(folder);
    const path = join(base, ...name.split('/'));
    const inside = relative(base, path);
    if (!inside || inside.startsWith('..') || !existsSync(path)) {
      throw new ProjectError(`找不到檔案：${folder}/${name}`, 404);
    }
    const trash = join(this.project.stateDir, 'trash', this.id, folder);
    await mkdir(trash, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await rename(path, join(trash, `${stamp}-${safeFileName(name)}`));
  }

  async setChapterStatus(id: string, status: ChapterStatus, baseVersion?: string) {
    if (!CHAPTER_STATUSES.includes(status)) throw new ProjectError(`不合法的狀態：${status}`);
    return this.transformChapter(id, (s) => setFrontmatter(s, 'status', status), baseVersion);
  }

  async setChapterSummary(id: string, summary: string, baseVersion?: string) {
    return this.transformChapter(
      id,
      (s) => setFrontmatter(s, 'summary', summary.trim()),
      baseVersion,
    );
  }

  async setChapterTitle(id: string, title: string, baseVersion?: string) {
    if (!title.trim()) throw new ProjectError('章節標題不能是空的');
    return this.transformChapter(id, (s) => setTitle(s, title), baseVersion);
  }
}
