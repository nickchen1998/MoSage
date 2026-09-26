// Thin client for the `mosage dev` JSON API, plus the live-update event bus.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookSummary, FileEntry, FileFolder } from '../../src/node/book.ts';
import type { Snapshot } from '../../src/node/history.ts';

export type { BookSummary, ChapterSummary, FileEntry, FileFolder } from '../../src/node/book.ts';

export interface Library {
  name: string;
  author: string;
  books: BookSummary[];
}

export interface ChapterSource {
  id: string;
  source: string;
  version: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

const b = (book: string) => `/books/${encodeURIComponent(book)}`;
const c = (book: string, chapter: string) => `${b(book)}/chapters/${encodeURIComponent(chapter)}`;

export const api = {
  library: () => request<Library>('GET', '/library'),
  createBook: (input: { title: string; type: string; id?: string }) =>
    request<{ id: string }>('POST', '/books', input),
  orderBooks: (books: string[]) => request('POST', '/books/order', { books }),

  book: (book: string) => request<BookSummary>('GET', b(book)),
  updateBook: (book: string, patch: Record<string, unknown>) =>
    request<BookSummary>('POST', `${b(book)}/config`, patch),
  orderChapters: (book: string, chapters: string[]) =>
    request<BookSummary>('POST', `${b(book)}/order`, { chapters }),
  createChapter: (book: string, title: string, summary?: string) =>
    request<{ id: string }>('POST', `${b(book)}/chapters`, { title, summary }),
  listChapter: (book: string, id: string) => request('POST', `${c(book, id)}/list`, {}),
  unlistChapter: (book: string, id: string) => request('POST', `${c(book, id)}/unlist`, {}),

  chapter: (book: string, id: string) => request<ChapterSource>('GET', c(book, id)),
  saveChapter: (book: string, id: string, source: string, baseVersion?: string) =>
    request<{ version: string }>('PUT', c(book, id), { source, baseVersion }),
  patchChapter: (book: string, id: string, patch: Record<string, unknown>) =>
    request<{ version: string }>('PATCH', c(book, id), patch),
  replace: (
    book: string,
    id: string,
    edit: { start: number; end: number; expected: string; text: string },
  ) => request<{ version: string }>('POST', `${c(book, id)}/replace`, edit),
  comment: (
    book: string,
    id: string,
    note: { blockStart: number; blockText: string; body: string; quote?: string },
  ) => request<{ id: string }>('POST', `${c(book, id)}/comments`, note),
  removeAnnotation: (book: string, id: string, ann: string) =>
    request('DELETE', `${c(book, id)}/annotations/${encodeURIComponent(ann)}`),
  acceptSuggestion: (book: string, id: string, ann: string) =>
    request('POST', `${c(book, id)}/annotations/${encodeURIComponent(ann)}/accept`, {}),

  history: (book: string, id: string) =>
    request<{ snapshots: Snapshot[] }>('GET', `${c(book, id)}/history`),
  snapshot: (book: string, id: string, snap: string) =>
    request<{ source: string }>('GET', `${c(book, id)}/history/${snap}`),
  restore: (book: string, id: string, snap: string) =>
    request('POST', `${c(book, id)}/history/${snap}/restore`, {}),

  doc: (book: string, name: 'brief' | 'style') =>
    request<{ source: string }>('GET', `${b(book)}/doc/${name}`),
  saveDoc: (book: string, name: 'brief' | 'style', source: string) =>
    request('PUT', `${b(book)}/doc/${name}`, { source }),

  files: (book: string) => request<Record<FileFolder, FileEntry[]>>('GET', `${b(book)}/files`),
  upload: (book: string, folder: FileFolder, name: string, data: string) =>
    request<{ name: string; path: string }>('POST', `${b(book)}/files`, { folder, name, data }),
  trashFile: (book: string, folder: FileFolder, name: string) =>
    request('DELETE', `${b(book)}/files?folder=${folder}&name=${encodeURIComponent(name)}`),

  current: (position: Record<string, unknown>) => request('POST', '/current', position),

  exportUrl: (book: string, format: 'docx' | 'html' | 'md') => `/api${b(book)}/export/${format}`,
};

/** URL the browser can load for a file referenced from a chapter. */
export function chapterFileUrl(book: string, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url;
  const base = new URL(`http://x/files/books/${encodeURIComponent(book)}/chapters/`);
  return new URL(url, base).pathname;
}

// ---------------------------------------------------------------------------
// Live updates: one EventSource, many subscribers.

export type ServerEvent =
  | { type: 'library' }
  | { type: 'book'; book: string }
  | { type: 'chapter'; book: string; id: string }
  | { type: 'assets'; book: string };

const listeners = new Set<(e: ServerEvent) => void>();
let source: EventSource | null = null;
let connected = true;
const connectionListeners = new Set<(ok: boolean) => void>();

function ensureSource() {
  if (source || typeof EventSource === 'undefined') return;
  source = new EventSource('/api/events');
  source.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as ServerEvent;
      for (const fn of listeners) fn(event);
    } catch {}
  };
  source.onopen = () => {
    if (!connected) {
      connected = true;
      for (const fn of connectionListeners) fn(true);
      // Something may have changed while we were away.
      for (const fn of listeners) fn({ type: 'library' });
    }
  };
  source.onerror = () => {
    if (connected) {
      connected = false;
      for (const fn of connectionListeners) fn(false);
    }
  };
}

export function useServerEvents(handler: (e: ServerEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    ensureSource();
    const fn = (e: ServerEvent) => ref.current(e);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}

export function useConnection(): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    ensureSource();
    connectionListeners.add(setOk);
    return () => {
      connectionListeners.delete(setOk);
    };
  }, []);
  return ok;
}

/**
 * Fetch something and refetch it whenever `matches` says a server event is
 * relevant. Keeps showing the previous value while reloading.
 */
export function useLive<T>(
  load: () => Promise<T>,
  /** Reload from scratch whenever this changes. */
  key: string,
  matches: (e: ServerEvent) => boolean,
): { data: T | null; error: Error | null; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const value = await loadRef.current();
      if (mine === seq.current) {
        setData(value);
        setError(null);
      }
    } catch (err) {
      if (mine === seq.current) setError(err as Error);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the trigger
  useEffect(() => {
    setData(null);
    setError(null);
    void reload();
  }, [key, reload]);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useServerEvents((e) => {
    if (!matches(e)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), 60);
  });

  return { data, error, reload };
}
