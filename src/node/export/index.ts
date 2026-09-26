// Export entry points for the CLI (`mosage export`) and the web server.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { sanitizeFileName } from './common.ts';
import { buildDocx } from './docx.ts';
import { buildHtml } from './html.ts';
import { buildMarkdown } from './markdown.ts';
import type { ManuscriptInput, ManuscriptSource } from './types.ts';

export type { ManuscriptInput, ManuscriptSource } from './types.ts';
export { buildDocx, buildHtml, buildMarkdown };

export type ExportFormat = 'docx' | 'html' | 'md';

export const EXPORT_FORMATS: ExportFormat[] = ['docx', 'html', 'md'];

const CONTENT_TYPES: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  html: 'text/html; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
};

async function render(
  book: ManuscriptSource,
  format: ExportFormat,
  outputDir: string,
): Promise<{ data: Buffer; fileName: string; contentType: string }> {
  if (!EXPORT_FORMATS.includes(format)) throw new Error(`不支援的匯出格式：${format}`);
  const { config, chapters } = await book.loadManuscript();
  const input: ManuscriptInput = { config, chapters, root: book.root, outputDir };
  let data: Buffer;
  if (format === 'docx') data = await buildDocx(input);
  else if (format === 'html') data = Buffer.from(await buildHtml(input), 'utf8');
  else data = Buffer.from(buildMarkdown(input), 'utf8');
  return {
    data,
    fileName: `${sanitizeFileName(config.export.fileName || config.title)}.${format}`,
    contentType: CONTENT_TYPES[format],
  };
}

/** The exported file in memory — for downloads from the web UI. */
export async function renderManuscript(
  book: ManuscriptSource,
  format: ExportFormat,
): Promise<{ data: Buffer; fileName: string; contentType: string }> {
  return render(book, format, book.outputDir);
}

/**
 * Write the export to `outFile`, or to `<outputDir>/<export.fileName>.<ext>`.
 * Returns the absolute path and the size in bytes.
 */
export async function exportManuscript(
  book: ManuscriptSource,
  format: ExportFormat,
  outFile?: string,
): Promise<{ path: string; bytes: number }> {
  const target = outFile ? resolve(outFile) : null;
  const file = await render(book, format, target ? dirname(target) : book.outputDir);
  const path = target ?? join(book.outputDir, file.fileName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.data);
  return { path, bytes: file.data.length };
}
