// mosage.yaml — the one settings file of a writing project.
// This module is browser-safe: the web UI uses the resolved typography to
// make the preview look like the exported Word file.

export type ProjectType = 'book' | 'thesis' | 'other';
export type Stage = 'kickoff' | 'outline' | 'writing' | 'revising' | 'done';
export type ChapterStatus = 'idea' | 'draft' | 'revising' | 'done';
export type EditMode = 'suggest' | 'direct';

export const STAGES: Stage[] = ['kickoff', 'outline', 'writing', 'revising', 'done'];
export const CHAPTER_STATUSES: ChapterStatus[] = ['idea', 'draft', 'revising', 'done'];

export type PageSizeName = 'A4' | 'A5' | 'B5' | 'Letter';

/** Page size in millimetres. */
export const PAGE_SIZES: Record<PageSizeName, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  // JIS B5, the size Taiwanese and Japanese printers mean by "B5".
  B5: { width: 182, height: 257 },
  Letter: { width: 216, height: 279 },
};

export interface ExportConfig {
  /** Output file name without extension. Defaults to the project title. */
  fileName: string;
  pageSize: PageSizeName | { width: number; height: number };
  /** Millimetres. */
  margins: { top: number; bottom: number; left: number; right: number };
  fonts: {
    /** East Asian (CJK) body font. */
    body: string;
    /** Latin body font. */
    latin: string;
    /** East Asian heading font. */
    heading: string;
    /** Monospace font for code. */
    code: string;
  };
  /** Body size in points. */
  fontSize: number;
  /** Line spacing as a multiple (1.5 = 1.5 lines). */
  lineSpacing: number;
  /** First-line indent in characters (0 = none). Chinese prose uses 2. */
  firstLineIndent: number;
  /** Space after each paragraph, in points. */
  paragraphSpacing: number;
  titlePage: boolean;
  toc: boolean;
  /** Start every chapter on a new page. */
  chapterPageBreak: boolean;
  pageNumbers: boolean;
  /** Running header: nothing, the project title, or the current chapter title. */
  header: 'none' | 'title' | 'chapter';
  /** What a `---` (scene break) becomes in the exported file. */
  sceneBreak: string;
}

export interface BookConfig {
  type: ProjectType;
  stage: Stage;
  title: string;
  subtitle: string;
  author: string;
  language: string;
  /** Target length in 字 (CJK characters + Latin words). 0 = no target. */
  targetWords: number;
  /** Chapter file names inside chapters/, in reading order. */
  chapters: string[];
  ai: { editMode: EditMode };
  export: ExportConfig;
}

const BOOK_EXPORT: ExportConfig = {
  fileName: '',
  pageSize: 'A4',
  margins: { top: 25, bottom: 25, left: 25, right: 25 },
  fonts: {
    body: '新細明體',
    latin: 'Times New Roman',
    heading: '微軟正黑體',
    code: 'Consolas',
  },
  fontSize: 12,
  lineSpacing: 1.5,
  firstLineIndent: 2,
  paragraphSpacing: 6,
  titlePage: true,
  toc: true,
  chapterPageBreak: true,
  pageNumbers: true,
  header: 'title',
  sceneBreak: '＊　＊　＊',
};

// Common Taiwanese university thesis layout: 標楷體 + Times New Roman 12pt,
// 1.5 line spacing, wider binding margin on the left.
const THESIS_EXPORT: ExportConfig = {
  ...BOOK_EXPORT,
  margins: { top: 25, bottom: 25, left: 30, right: 25 },
  fonts: {
    body: '標楷體',
    latin: 'Times New Roman',
    heading: '標楷體',
    code: 'Consolas',
  },
  paragraphSpacing: 0,
  header: 'none',
};

export function defaultExport(type: ProjectType): ExportConfig {
  return structuredClone(type === 'thesis' ? THESIS_EXPORT : BOOK_EXPORT);
}

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function resolvePageSize(value: unknown, fallback: ExportConfig['pageSize']) {
  if (typeof value === 'string') {
    const name = Object.keys(PAGE_SIZES).find((k) => k.toLowerCase() === value.toLowerCase());
    if (name) return name as PageSizeName;
  }
  if (isObject(value)) {
    const width = num(value.width, 0);
    const height = num(value.height, 0);
    if (width > 0 && height > 0) return { width, height };
  }
  return fallback;
}

/**
 * Layer a book's book.yaml over the project-wide defaults in mosage.yaml.
 * Nested objects merge; arrays and scalars from the book win.
 */
export function mergeConfig(base: unknown, override: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isObject(base) ? { ...base } : {};
  if (!isObject(override)) return out;
  for (const [key, value] of Object.entries(override)) {
    // An empty value in book.yaml means "not set here", not "blank it out".
    if (value === null || value === undefined || value === '') continue;
    out[key] = isObject(value) && isObject(out[key]) ? mergeConfig(out[key], value) : value;
  }
  return out;
}

/** Fill every missing field of a book's settings with its default. */
export function resolveConfig(raw: unknown): BookConfig {
  const r = isObject(raw) ? raw : {};
  const type = oneOf(r.type, ['book', 'thesis', 'other'] as const, 'book');
  const title = str(r.title, '').trim();
  const d = defaultExport(type);
  const e = isObject(r.export) ? r.export : {};
  const margins = isObject(e.margins) ? e.margins : {};
  const fonts = isObject(e.fonts) ? e.fonts : {};
  const ai = isObject(r.ai) ? r.ai : {};

  return {
    type,
    stage: oneOf(r.stage, STAGES, 'kickoff'),
    title,
    subtitle: str(r.subtitle, ''),
    author: str(r.author, ''),
    language: str(r.language, 'zh-TW'),
    targetWords: Math.max(0, num(r.targetWords, 0)),
    chapters: Array.isArray(r.chapters)
      ? r.chapters.filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      : [],
    ai: { editMode: oneOf(ai.editMode, ['suggest', 'direct'] as const, 'suggest') },
    export: {
      fileName: str(e.fileName, '') || title || 'manuscript',
      pageSize: resolvePageSize(e.pageSize, d.pageSize),
      margins: {
        top: num(margins.top, d.margins.top),
        bottom: num(margins.bottom, d.margins.bottom),
        left: num(margins.left, d.margins.left),
        right: num(margins.right, d.margins.right),
      },
      fonts: {
        body: str(fonts.body, d.fonts.body),
        latin: str(fonts.latin, d.fonts.latin),
        heading: str(fonts.heading, d.fonts.heading),
        code: str(fonts.code, d.fonts.code),
      },
      fontSize: num(e.fontSize, d.fontSize),
      lineSpacing: num(e.lineSpacing, d.lineSpacing),
      firstLineIndent: num(e.firstLineIndent, d.firstLineIndent),
      paragraphSpacing: num(e.paragraphSpacing, d.paragraphSpacing),
      titlePage: bool(e.titlePage, d.titlePage),
      toc: bool(e.toc, d.toc),
      chapterPageBreak: bool(e.chapterPageBreak, d.chapterPageBreak),
      pageNumbers: bool(e.pageNumbers, d.pageNumbers),
      header: oneOf(e.header, ['none', 'title', 'chapter'] as const, d.header),
      sceneBreak: str(e.sceneBreak, d.sceneBreak),
    },
  };
}

export function pageSizeMm(size: ExportConfig['pageSize']): { width: number; height: number } {
  return typeof size === 'string' ? PAGE_SIZES[size] : size;
}
