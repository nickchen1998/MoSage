import { fileLink, printedLink, type RemoteInfo } from './code-remote';

/**
 * What `import src from '../../code/etl/transform.py?code'` gives a document:
 * the file as it is on disk and — when `code/` is a repository with a GitHub or
 * GitLab origin — the version origin has, so an excerpt can link to it and tell
 * whether what it prints is what the link opens.
 */
export type CodeSource = {
  /** Path inside `code/`, with forward slashes. */
  path: string;
  lines: string[];
  remote: RemoteInfo | null;
  /** The pushed commit, or null when the branch was never pushed. */
  pushed: {
    sha: string;
    /** ISO date of the commit. */
    at: string | null;
    /** The file is unchanged since that commit. */
    same: boolean;
    /** The file at that commit when it differs; null when the commit lacks it. */
    lines: string[] | null;
  } | null;
};

/**
 * - `pushed` — the link opens exactly these lines.
 * - `changed` — the pushed file shows something else here; the link opens the old version.
 * - `new` — origin has no such file yet; there is nothing to link to.
 * - `local` — `code/` has no GitHub or GitLab origin; the excerpt prints without a link.
 */
export type ExcerptStatus = 'pushed' | 'changed' | 'new' | 'local';

export type LineRange = { start: number; end: number };

/** `"12-38"`, `"12–38"` or `"7"`; null for anything else. */
export function parseRange(text: string): LineRange | null {
  const m = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$/.exec(text);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] === undefined ? start : Number(m[2]);
  return start >= 1 && end >= start ? { start, end } : null;
}

/** Comma-separated ranges, sorted and with overlaps merged; null if any part does not parse. */
export function parseRanges(text: string): LineRange[] | null {
  const parts = text.split(/[,，]/).filter((part) => part.trim() !== '');
  const ranges = parts.map(parseRange);
  if (!ranges.every((range): range is LineRange => range !== null)) return null;
  const merged: LineRange[] = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function formatRange({ start, end }: LineRange): string {
  return start === end ? String(start) : `${start}–${end}`;
}

export function excerptStatus(src: CodeSource, range: LineRange): ExcerptStatus {
  if (!src.remote) return 'local';
  if (!src.pushed) return 'new';
  if (src.pushed.same) return 'pushed';
  if (!src.pushed.lines) return 'new';
  const before = src.pushed.lines.slice(range.start - 1, range.end);
  const now = src.lines.slice(range.start - 1, range.end);
  return before.length === now.length && before.every((line, i) => line === now[i])
    ? 'pushed'
    : 'changed';
}

export type ExcerptLink = { href: string; printed: string; sha: string };

/** Where an excerpt points, when origin has the file at all. */
export function excerptLink(src: CodeSource, range: LineRange | null): ExcerptLink | null {
  if (!src.remote || !src.pushed) return null;
  if (!src.pushed.same && !src.pushed.lines) return null;
  const { sha } = src.pushed;
  return {
    href: fileLink(src.remote, sha, src.path, range?.start, range?.end),
    printed: printedLink(src.remote, sha, src.path, range?.start, range?.end),
    sha,
  };
}
