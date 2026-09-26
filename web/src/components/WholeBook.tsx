// The whole manuscript on one page — what the export will contain, in order.

import { useCallback, useEffect, useMemo } from 'react';
import { parseChapter } from '../../../src/shared/markdown.ts';
import { api, type BookSummary, type ChapterSource, useLive } from '../api.ts';
import { formatNumber } from '../labels.ts';
import { bookTypography, ChapterDocument } from './ChapterDocument.tsx';
import { usePositionReporter, useScrollPosition } from './Reader.tsx';

export function WholeBook({ book }: { book: BookSummary }) {
  const ids = book.chapters.map((c) => c.id);
  const key = ids.join('\n');
  const { data, reload } = useLive<ChapterSource[]>(
    () => Promise.all(ids.map((id) => api.chapter(book.id, id))),
    `${book.id}\n${key}`,
    (e) => e.type === 'chapter' && e.book === book.id && ids.includes(e.id),
  );
  const parsed = useMemo(
    () => new Map((data ?? []).map((c) => [c.id, parseChapter(c.source)])),
    [data],
  );
  const report = usePositionReporter(book, 'book');
  const chapterOf = useCallback(
    (el: HTMLElement) => el.closest<HTMLElement>('[data-chapter]')?.dataset.chapter ?? null,
    [],
  );
  const parsedFor = useCallback((id: string) => parsed.get(id) ?? null, [parsed]);
  useScrollPosition(report, chapterOf, parsedFor);

  useEffect(() => {
    document.title = `全書預覽 · ${book.config.title || 'MoSage'}`;
  }, [book.config.title]);

  const c = book.config;
  return (
    <main className="whole-book">
      <div className="reader-toolbar">
        <span className="muted small">
          全書 {book.chapters.length} 章 · {formatNumber(book.totals.words)} 字 ·
          只顯示目錄中的章節（和匯出內容一致）
        </span>
        <span className="spacer" />
        <button type="button" className="btn btn-sm" onClick={() => window.print()}>
          列印
        </button>
      </div>
      <article className="page title-page" style={bookTypography(c)}>
        <h1>{c.title || '（尚未命名）'}</h1>
        {c.subtitle && <p className="subtitle">{c.subtitle}</p>}
        {c.author && <p className="author">{c.author}</p>}
      </article>
      {c.export.toc && book.chapters.length > 0 && (
        <article className="page toc-page" style={bookTypography(c)}>
          <h2>目錄</h2>
          <ol>
            {book.chapters.map((ch) => (
              <li key={ch.id}>
                <a href={`#ch-${ch.id}`}>{ch.title}</a>
                {ch.sections.length > 0 && (
                  <ul>
                    {ch.sections.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </article>
      )}
      {!data && <div className="loading">載入中…</div>}
      {data?.map((chapter) => (
        <article
          key={chapter.id}
          className="page"
          id={`ch-${chapter.id}`}
          data-chapter={chapter.id}
        >
          <ChapterDocument
            book={book.id}
            chapter={chapter.id}
            source={chapter.source}
            config={c}
            idPrefix={`${chapter.id}-`}
            onFocus={report}
            onChanged={() => void reload()}
          />
        </article>
      ))}
      {data && data.length === 0 && <p className="empty">目錄裡還沒有章節。</p>}
    </main>
  );
}
