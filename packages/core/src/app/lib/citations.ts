import { useSyncExternalStore } from 'react';
import { PAGE_ATTR } from './outline';

export type CitationFormat = 'numeric' | 'author-date';

export type SourceType = 'article' | 'book' | 'chapter' | 'report' | 'thesis' | 'web' | 'other';

/** One work a document cites — written inline, or read from a `.bib` file. */
export type Source = {
  /** What `<Cite id>` names it by. */
  id: string;
  type?: SourceType | string;
  /** People as `Family, Given`; an organisation or a Chinese name as written. */
  author?: string | string[];
  editor?: string[];
  title?: string;
  year?: string | number;
  /** The journal, book, or site the work appears in. */
  container?: string;
  volume?: string | number;
  issue?: string | number;
  pages?: string;
  publisher?: string;
  url?: string;
  doi?: string;
};

export const CITE_ATTR = 'data-od-cite';
export const CITE_UNRESOLVED_ATTR = 'data-od-cite-unresolved';
export const BIBLIOGRAPHY_ATTR = 'data-od-bibliography';
export const SOURCE_ATTR = 'data-od-source';

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF]/;

export function authorsOf(source: Source): string[] {
  if (!source.author) return [];
  return Array.isArray(source.author) ? source.author : [source.author];
}

/** Chinese-language sources are cited the way Taiwanese APA writes them: full names, full-width marks. */
export function isChinese(source: Source): boolean {
  return CJK.test(authorsOf(source)[0] ?? '') || CJK.test(source.title ?? '');
}

/** What an in-text citation calls an author: a Chinese name whole, a person by family name. */
export function citedName(name: string): string {
  if (CJK.test(name)) return name;
  const comma = name.indexOf(',');
  return comma > 0 ? name.slice(0, comma).trim() : name.trim();
}

function yearOf(source: Source, zh: boolean): string {
  if (source.year !== undefined && String(source.year).trim() !== '') return String(source.year);
  return zh ? '無日期' : 'n.d.';
}

function locator(page: string, zh: boolean): string {
  if (zh) return `頁 ${page}`;
  return /[-–,]/.test(page) ? `pp. ${page}` : `p. ${page}`;
}

/** `1, 2, 3, 5` → `1–3, 5`. */
export function compressNumbers(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i] as number;
    while (i + 1 < sorted.length && sorted[i + 1] === (sorted[i] as number) + 1) i++;
    const end = sorted[i] as number;
    runs.push(
      end - start >= 2 ? `${start}–${end}` : end === start ? `${start}` : `${start}, ${end}`,
    );
  }
  return runs.join(', ');
}

function authorDate(source: Source, narrative: boolean, page?: string): string {
  const zh = isChinese(source);
  const names = authorsOf(source).map(citedName);
  const who =
    names.length === 0
      ? (source.title ?? source.id)
      : names.length === 1
        ? names[0]
        : names.length === 2
          ? zh
            ? `${names[0]}、${names[1]}`
            : `${names[0]} & ${names[1]}`
          : zh
            ? `${names[0]}等人`
            : `${names[0]} et al.`;
  const year = yearOf(source, zh);
  const where = page ? (zh ? `，${locator(page, zh)}` : `, ${locator(page, zh)}`) : '';
  if (narrative) return zh ? `${who}（${year}${where}）` : `${who} (${year}${where})`;
  return zh ? `${who}，${year}${where}` : `${who}, ${year}${where}`;
}

/**
 * The in-text citation for one or more sources: `[3]`, `[1–3, 5]`, `(Chen, 2024)`,
 * `（陳大文，2024）`. Numbers are each source's place in the bibliography.
 */
export function citeText(
  cited: Source[],
  format: CitationFormat,
  numberOf: (id: string) => number,
  opts: { page?: string; narrative?: boolean } = {},
): string {
  const zh = cited.length > 0 && cited.every(isChinese);
  if (format === 'numeric') {
    const list = compressNumbers(cited.map((s) => numberOf(s.id)));
    const where = opts.page
      ? zh
        ? `，${locator(opts.page, zh)}`
        : `, ${locator(opts.page, zh)}`
      : '';
    return `[${list}${where}]`;
  }
  if (opts.narrative) {
    return cited
      .map((s, i) => authorDate(s, true, i === cited.length - 1 ? opts.page : undefined))
      .join(zh ? '、' : ', ');
  }
  const parts = cited.map((s, i) =>
    authorDate(s, false, i === cited.length - 1 ? opts.page : undefined),
  );
  return zh ? `（${parts.join('；')}）` : `(${parts.join('; ')})`;
}

export type Run = { text: string; emphasis?: boolean };

function joinAuthors(names: string[], zh: boolean): string {
  if (zh) return names.join('、');
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

/**
 * One bibliography entry, APA-shaped: author, year, title, where it appeared,
 * who published it, and where to find it. The title of a whole work — a book,
 * a report — or the journal a paper is in is set off, in italics for Latin
 * text and bold for Chinese, which has no italic.
 */
export function entryRuns(source: Source): Run[] {
  const zh = isChinese(source);
  const stop = zh ? '。' : '. ';
  const comma = zh ? '，' : ', ';
  const runs: Run[] = [];
  const push = (text: string, emphasis = false) => {
    if (text) runs.push(emphasis ? { text, emphasis } : { text });
  };

  const names = authorsOf(source);
  const year = yearOf(source, zh);
  if (names.length > 0)
    push(
      zh
        ? `${joinAuthors(names, zh)}（${year}）${stop}`
        : `${joinAuthors(names, zh)} (${year})${stop}`,
    );

  const whole =
    !source.container || ['book', 'report', 'thesis', 'web'].includes(String(source.type));
  if (source.title) push(source.title, whole && !source.container);
  if (source.title) push(stop);
  if (names.length === 0) push(zh ? `（${year}）${stop}` : `(${year})${stop}`);

  if (source.container) {
    push(source.container, true);
    if (source.volume !== undefined) {
      push(comma);
      push(String(source.volume), !zh);
    }
    if (source.issue !== undefined) push(zh ? `（${source.issue}）` : `(${source.issue})`);
    if (source.pages) push(`${comma}${source.pages}`);
    push(stop);
  }
  if (source.publisher && source.publisher !== source.container) push(`${source.publisher}${stop}`);
  const link = source.doi
    ? `https://doi.org/${source.doi.replace(/^https?:\/\/doi\.org\//, '')}`
    : source.url;
  if (link) push(link);
  const last = runs[runs.length - 1];
  if (last && !last.emphasis) last.text = last.text.replace(/\s+$/, '');
  return runs;
}

const collator = new Intl.Collator(['zh-Hant-TW', 'en'], { sensitivity: 'base', numeric: true });

/** Numeric bibliographies keep the author's order — it is the numbering; author–date ones sort by author, then year. */
export function orderSources(sources: Source[], format: CitationFormat): Source[] {
  if (format === 'numeric') return sources;
  const key = (s: Source) => citedName(authorsOf(s)[0] ?? s.title ?? s.id);
  return [...sources].sort(
    (a, b) =>
      collator.compare(key(a), key(b)) ||
      collator.compare(String(a.year ?? ''), String(b.year ?? '')) ||
      collator.compare(a.title ?? '', b.title ?? ''),
  );
}

export type CitationSnapshot = { format: CitationFormat; sources: Source[] };

const EMPTY: CitationSnapshot = { format: 'numeric', sources: [] };

/** Reads the bibliography a document declares, from its rendered pages. */
export function collectCitations(root: ParentNode): CitationSnapshot {
  const declared = root.querySelector(`[${PAGE_ATTR}] [${BIBLIOGRAPHY_ATTR}]`);
  const raw = declared?.getAttribute(BIBLIOGRAPHY_ATTR);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as CitationSnapshot;
    return { format: parsed.format, sources: orderSources(parsed.sources, parsed.format) };
  } catch {
    return EMPTY;
  }
}

// On globalThis, like the outline and label stores: the viewer scans with its
// own copy of this module while a document's `<Cite>` reads the published one.
const GLOBAL_KEY = '__mosage_citations_store__';
type Store = { snapshot: CitationSnapshot; listeners: Set<() => void> };
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: Store };
const g = globalThis as GlobalWithStore;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { snapshot: EMPTY, listeners: new Set() };
const store = g[GLOBAL_KEY];

export function setCitations(next: CitationSnapshot): void {
  const current = store.snapshot;
  if (
    current.format === next.format &&
    JSON.stringify(current.sources) === JSON.stringify(next.sources)
  ) {
    return;
  }
  store.snapshot = next;
  for (const listener of store.listeners) listener();
}

export function getCitations(): CitationSnapshot {
  return store.snapshot;
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

/** The document's bibliography, once the scan has run. Empty on the first render pass. */
export function useCitations(): CitationSnapshot {
  return useSyncExternalStore(subscribe, getCitations, getCitations);
}
