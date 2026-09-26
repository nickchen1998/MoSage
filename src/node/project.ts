// A MoSage project — the folder `npx mosage init` creates. It holds any
// number of books and theses:
//
//   mosage.yaml     project-wide defaults (author, AI edit mode, export style)
//   books/<id>/     one folder per book — see book.ts
//   notes/          material shared by every book (author profile, research)
//   .mosage/        local state: current.json, history snapshots (gitignored)
//   output/<id>/    exported files

import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { type Document, isMap, parseDocument } from 'yaml';
import type { ProjectType } from '../shared/config.ts';
import { BOOK_FILE, Book, type BookSummary, ProjectError, slugify } from './book.ts';
import { History } from './history.ts';

export const PROJECT_FILE = 'mosage.yaml';

export function isBookId(id: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(id) && id.length <= 80;
}

/** A folder name for a new book, from its title. */
export function bookIdFrom(title: string): string {
  return slugify(title) || 'book';
}

export class Project {
  private histories = new Map<string, History>();

  constructor(readonly root: string) {}

  /** Walk up from `start` to the folder holding mosage.yaml. */
  static find(start = process.cwd()): Project {
    let dir = resolve(start);
    for (;;) {
      if (existsSync(join(dir, PROJECT_FILE))) return new Project(dir);
      const parent = dirname(dir);
      if (parent === dir) {
        throw new ProjectError(
          `找不到 ${PROJECT_FILE}。請在 MoSage 專案資料夾裡執行，或先用 \`npx mosage init <資料夾>\` 建立專案。`,
          404,
        );
      }
      dir = parent;
    }
  }

  get configPath() {
    return join(this.root, PROJECT_FILE);
  }
  get booksDir() {
    return join(this.root, 'books');
  }
  get stateDir() {
    return join(this.root, '.mosage');
  }

  historyFor(bookId: string): History {
    let history = this.histories.get(bookId);
    if (!history) {
      history = new History(join(this.stateDir, 'history', bookId));
      this.histories.set(bookId, history);
    }
    return history;
  }

  async readConfigDocument(): Promise<Document> {
    const text = existsSync(this.configPath) ? await readFile(this.configPath, 'utf8') : '';
    return parseDocument(text);
  }

  /** mosage.yaml as plain data — the defaults every book inherits. */
  async loadDefaults(): Promise<Record<string, unknown>> {
    const data = (await this.readConfigDocument()).toJS();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  async updateConfig(mutate: (doc: Document) => void): Promise<void> {
    const doc = await this.readConfigDocument();
    if (!isMap(doc.contents)) doc.contents = doc.createNode({}) as typeof doc.contents;
    mutate(doc);
    await writeFile(this.configPath, doc.toString({ lineWidth: 0 }));
  }

  book(id: string): Book {
    if (!isBookId(id)) throw new ProjectError(`不合法的書籍代號：${id}`);
    const book = new Book(this, id);
    if (!book.exists()) throw new ProjectError(`找不到這本書：books/${id}/${BOOK_FILE}`, 404);
    return book;
  }

  /** Book folders, in the order of `books:` in mosage.yaml, then by name. */
  async listBookIds(): Promise<string[]> {
    if (!existsSync(this.booksDir)) return [];
    const entries = await readdir(this.booksDir, { withFileTypes: true });
    const ids = entries
      .filter((e) => e.isDirectory() && isBookId(e.name))
      .filter((e) => existsSync(join(this.booksDir, e.name, BOOK_FILE)))
      .map((e) => e.name);
    const defaults = await this.loadDefaults();
    const order = Array.isArray(defaults.books) ? defaults.books.map(String) : [];
    const rank = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return ids.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }));
  }

  async listBooks(): Promise<BookSummary[]> {
    const ids = await this.listBookIds();
    return Promise.all(ids.map((id) => new Book(this, id).summarize()));
  }

  async setBookOrder(ids: string[]): Promise<void> {
    for (const id of ids) if (!isBookId(id)) throw new ProjectError(`不合法的書籍代號：${id}`);
    await this.updateConfig((doc) => doc.set('books', doc.createNode([...new Set(ids)])));
  }

  /**
   * Resolve which book a command means: an explicit id, the book folder the
   * shell is in, or the only book there is.
   */
  async resolveBook(explicit?: string, cwd = process.cwd()): Promise<Book> {
    if (explicit) return this.book(explicit);
    const rel = relative(this.booksDir, resolve(cwd));
    if (rel && !rel.startsWith('..')) return this.book(rel.split(sep)[0]);
    const ids = await this.listBookIds();
    if (ids.length === 1) return this.book(ids[0]);
    if (ids.length === 0) {
      throw new ProjectError(
        '這個專案還沒有任何書。用 `npx mosage new <代號>` 建立，或請 AI 帶你立項。',
      );
    }
    throw new ProjectError(`有 ${ids.length} 本書，請指定是哪一本：${ids.join('、')}`);
  }

  /** Scaffold books/<id>/ from the bundled template. */
  async createBook(
    templateDir: string,
    opts: { id?: string; title?: string; type?: ProjectType; author?: string } = {},
  ): Promise<Book> {
    let id = opts.id?.trim() || bookIdFrom(opts.title ?? '');
    if (!isBookId(id)) throw new ProjectError(`不合法的書籍代號：${id}（請用英文、數字與 -）`);
    const base = id;
    for (let n = 2; existsSync(join(this.booksDir, id)); n++) {
      if (opts.id) throw new ProjectError(`books/${id} 已經存在`);
      id = `${base}-${n}`;
    }
    const book = new Book(this, id);
    await mkdir(this.booksDir, { recursive: true });
    await cp(templateDir, book.root, { recursive: true });
    await book.updateConfig((doc) => {
      if (opts.type) doc.set('type', opts.type);
      if (opts.title) doc.set('title', opts.title.trim());
      if (opts.author) doc.set('author', opts.author.trim());
    });
    const ids = await this.listBookIds();
    await this.setBookOrder(ids.includes(id) ? ids : [...ids, id]);
    return book;
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
