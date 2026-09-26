import type { BookConfig, ChapterStatus } from '../../shared/config.ts';

/** Everything an exporter needs: the settings, the chapters in reading order, and where they live. */
export interface ManuscriptInput {
  config: BookConfig;
  chapters: { id: string; source: string }[];
  /** The book folder: chapters are in `<root>/chapters`, images usually in `<root>/assets`. */
  root: string;
  /**
   * Where the exported file will be written. Only the Markdown exporter uses it,
   * to rewrite relative image links. Defaults to `<root>/output`.
   */
  outputDir?: string;
}

/** The part of a book the exporters read (satisfied by `Book`). */
export interface ManuscriptSource {
  readonly root: string;
  readonly outputDir: string;
  loadManuscript(): Promise<{ config: BookConfig; chapters: { id: string; source: string }[] }>;
}

/** The part of a book the importer writes to (satisfied by `Book`). */
export interface ImportTarget {
  readonly root: string;
  readonly chaptersDir: string;
  loadConfig(): Promise<BookConfig>;
  createChapter(
    title: string,
    opts?: { summary?: string; status?: ChapterStatus; body?: string; listed?: boolean },
  ): Promise<string>;
}
