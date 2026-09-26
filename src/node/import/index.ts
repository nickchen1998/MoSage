// `mosage import`: bring an existing manuscript (Word or Markdown) into a book,
// one chapter per top-level heading.

import { existsSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { isEnglish } from '../export/common.ts';
import type { ImportTarget } from '../export/types.ts';
import { readDocxFile } from './docx.ts';
import { type ImportLog, readMarkdownFile } from './markdown.ts';
import { splitManuscript } from './split.ts';

export type { ImportTarget } from '../export/types.ts';
export { htmlToMarkdown } from './docx.ts';
export { splitManuscript } from './split.ts';

export interface ImportOptions {
  /** One chapter per top-level heading (default true). */
  split?: boolean;
  /** Add the new chapters to the chapter order (default true). */
  listed?: boolean;
}

export interface ImportResult {
  /** Ids of the chapter files created, in order. */
  created: string[];
  /** Images saved, relative to the book folder. */
  assets: string[];
  warnings: string[];
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

export async function importFile(
  book: ImportTarget,
  file: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const path = resolve(file);
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`找不到檔案：${file}`);
  const ext = extname(path).toLowerCase();
  if (ext !== '.docx' && !MARKDOWN_EXTENSIONS.has(ext)) {
    throw new Error(
      `不支援的檔案格式：${ext || '（沒有副檔名）'}。可以匯入 .docx、.md、.markdown 或 .txt；.doc 請先在 Word 另存成 .docx。`,
    );
  }

  const config = await book.loadConfig();
  const log: ImportLog = { assets: [], warnings: [] };
  const markdown =
    ext === '.docx' ? await readDocxFile(path, book, log) : await readMarkdownFile(path, book, log);

  if (!markdown.trim()) {
    log.warnings.push(`「${basename(path)}」沒有內容，沒有建立任何章節。`);
    return { created: [], assets: log.assets, warnings: log.warnings };
  }

  const split = opts.split !== false;
  const name = basename(path, extname(path)).trim() || '匯入的稿件';
  const { chapters, noHeadings } = splitManuscript(markdown, {
    split,
    fallbackTitle: name,
    frontMatterTitle: isEnglish(config.language) ? 'Front matter' : '前言素材',
  });
  if (noHeadings) {
    log.warnings.push(
      `「${basename(path)}」裡沒有偵測到標題樣式（Word 的「標題 1／標題 2」或 Markdown 的 # 標題），所以整份匯入成一章「${name}」。可以請 AI 依內容幫你切分成章節。`,
    );
  }

  const created: string[] = [];
  for (const chapter of chapters) {
    created.push(
      await book.createChapter(chapter.title.slice(0, 200), {
        body: chapter.body,
        status: 'draft',
        listed: opts.listed !== false,
      }),
    );
  }
  return { created, assets: log.assets, warnings: log.warnings };
}
