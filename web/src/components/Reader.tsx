// Reading one chapter: sidebar with the table of contents and this chapter's
// outline, the typeset page, and the toolbar (status, history, source).

import { diffLines } from 'diff';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTER_STATUSES } from '../../../src/shared/config.ts';
import { parseChapter, textOf } from '../../../src/shared/markdown.ts';
import { api, type BookSummary, type ChapterSource, useLive } from '../api.ts';
import { formatNumber, relativeTime, STATUS_LABEL } from '../labels.ts';
import { href } from '../router.ts';
import { toast, toastError } from '../toast.tsx';
import { ChapterDocument, type FocusInfo } from './ChapterDocument.tsx';
import { slug } from './Markdown.tsx';
import { Modal } from './ui.tsx';

/** Publish where the author is to .mosage/current.json (debounced). */
export function usePositionReporter(book: BookSummary, view: string) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const last = useRef('');
  return useCallback(
    (info: FocusInfo) => {
      const chapter = [...book.chapters, ...book.drafts].find((c) => c.id === info.chapter);
      const payload = {
        view,
        book: book.id,
        bookTitle: book.config.title,
        chapter: info.chapter,
        path: `books/${book.id}/chapters/${info.chapter}`,
        chapterTitle: chapter?.title ?? null,
        section: info.section,
        block: info.block,
        selection: info.selection,
      };
      const key = JSON.stringify(payload);
      if (key === last.current) return;
      last.current = key;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void api.current(payload).catch(() => {}), 500);
    },
    [book, view],
  );
}

/** Report the block at the top of the viewport while the author scrolls. */
export function useScrollPosition(
  onFocus: (info: FocusInfo) => void,
  chapterOf: (el: HTMLElement) => string | null,
  parsedFor: (chapter: string) => ReturnType<typeof parseChapter> | null,
) {
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const blocks = document.querySelectorAll<HTMLElement>('[data-block]');
        for (const el of blocks) {
          const rect = el.getBoundingClientRect();
          if (rect.bottom < 90) continue;
          const chapter = chapterOf(el);
          const parsed = chapter ? parsedFor(chapter) : null;
          const block = parsed?.blocks[Number(el.dataset.block)];
          if (!chapter || !parsed || !block) return;
          let section: string | null = null;
          for (const h of parsed.headings) if (h.blockIndex <= block.index) section = h.text;
          onFocus({
            chapter,
            block: {
              index: block.index,
              line: Number(el.dataset.line),
              type: block.node.type,
              text: textOf(block.node).replace(/\s+/g, ' ').trim().slice(0, 120),
            },
            section,
            selection: null,
          });
          return;
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [onFocus, chapterOf, parsedFor]);
}

function HistoryDialog({
  book,
  chapter,
  current,
  onClose,
}: {
  book: string;
  chapter: string;
  current: string;
  onClose: () => void;
}) {
  const [list, setList] = useState<
    { id: string; at: string; words: number; size: number }[] | null
  >(null);
  const [picked, setPicked] = useState<{ id: string; source: string } | null>(null);
  useEffect(() => {
    api.history(book, chapter).then((r) => setList(r.snapshots), toastError);
  }, [book, chapter]);
  const pick = async (id: string) => {
    try {
      const { source } = await api.snapshot(book, chapter, id);
      setPicked({ id, source });
    } catch (err) {
      toastError(err);
    }
  };
  const restore = async () => {
    if (!picked) return;
    try {
      await api.restore(book, chapter, picked.id);
      toast('已還原。目前的版本也已存入版本紀錄。', 'success');
      onClose();
    } catch (err) {
      toastError(err);
    }
  };
  const parts = useMemo(() => (picked ? diffLines(picked.source, current) : []), [picked, current]);
  return (
    <Modal wide title="版本紀錄" onClose={onClose}>
      <p className="muted small">
        每次內容改變前（不論是你、AI 或其他編輯器），MoSage
        都會自動保存上一版，連續修改會合併成一筆。
      </p>
      <div className="history">
        <ul className="history-list">
          {list === null && <li className="muted">載入中…</li>}
          {list?.length === 0 && <li className="muted">還沒有任何版本紀錄。</li>}
          {list?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={picked?.id === s.id ? 'on' : ''}
                onClick={() => void pick(s.id)}
              >
                <strong>{new Date(s.at).toLocaleString('zh-TW')}</strong>
                <span>
                  {relativeTime(s.at)} · {formatNumber(s.words)} 字
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="history-diff">
          {picked ? (
            <>
              <div className="history-legend">
                <del>這個版本有、現在沒有</del> <ins>現在才有</ins>
              </div>
              <pre>
                {parts.map((p, i) =>
                  p.added ? (
                    <ins key={i}>{p.value}</ins>
                  ) : p.removed ? (
                    <del key={i}>{p.value}</del>
                  ) : (
                    <span key={i} className="same">
                      {p.value}
                    </span>
                  ),
                )}
              </pre>
            </>
          ) : (
            <p className="muted">選一個版本，查看它和現在的差異。</p>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          關閉
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!picked}
          onClick={() => void restore()}
        >
          還原成這個版本
        </button>
      </div>
    </Modal>
  );
}

export function ChapterSidebar({
  book,
  active,
  headings,
  idPrefix = '',
}: {
  book: BookSummary;
  active: string | null;
  headings?: { depth: number; text: string }[];
  idPrefix?: string;
}) {
  return (
    <aside className="reader-side">
      <div className="side-section">
        <div className="side-title">目錄</div>
        <ol className="toc">
          {book.chapters.map((c) => (
            <li key={c.id} className={c.id === active ? 'on' : ''}>
              <a href={href({ name: 'read', book: book.id, chapter: c.id })}>
                <span className={`status-dot status-${c.status}`} title={STATUS_LABEL[c.status]} />
                <span className="toc-title">{c.title}</span>
                {c.comments + c.suggestions + c.aiNotes > 0 && (
                  <span className="toc-badge">{c.comments + c.suggestions + c.aiNotes}</span>
                )}
              </a>
              {c.id === active && headings && headings.length > 0 && (
                <ul className="toc-sections">
                  {headings
                    .filter((h) => h.depth >= 2 && h.depth <= 3)
                    .map((h, i) => (
                      <li key={i} className={`depth-${h.depth}`}>
                        <a
                          href={`#${idPrefix}${slug(h.text)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            document
                              .getElementById(`${idPrefix}${slug(h.text)}`)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
        {book.drafts.length > 0 && (
          <>
            <div className="side-title">草稿（未排入）</div>
            <ul className="toc">
              {book.drafts.map((c) => (
                <li key={c.id} className={c.id === active ? 'on' : ''}>
                  <a href={href({ name: 'read', book: book.id, chapter: c.id })}>
                    <span className="toc-title">{c.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

export function Reader({ book, chapterId }: { book: BookSummary; chapterId: string }) {
  const { data, error, reload } = useLive<ChapterSource>(
    () => api.chapter(book.id, chapterId),
    `${book.id}/${chapterId}`,
    (e) => e.type === 'chapter' && e.book === book.id && e.id === chapterId,
  );
  const [showHistory, setShowHistory] = useState(false);
  const [pulse, setPulse] = useState(false);
  const lastVersion = useRef<string | null>(null);
  const summary = [...book.chapters, ...book.drafts].find((c) => c.id === chapterId);
  const parsed = useMemo(() => (data ? parseChapter(data.source) : null), [data]);
  const report = usePositionReporter(book, 'read');

  useEffect(() => {
    if (!data) return;
    if (lastVersion.current && lastVersion.current !== data.version) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1600);
      lastVersion.current = data.version;
      return () => clearTimeout(t);
    }
    lastVersion.current = data.version;
  }, [data]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top per chapter
  useEffect(() => {
    window.scrollTo({ top: 0 });
    lastVersion.current = null;
  }, [chapterId]);

  useEffect(() => {
    document.title = `${summary?.title ?? chapterId} · ${book.config.title || 'MoSage'}`;
  }, [summary?.title, chapterId, book.config.title]);

  const chapterOf = useCallback(() => chapterId, [chapterId]);
  const parsedFor = useCallback(() => parsed, [parsed]);
  useScrollPosition(report, chapterOf, parsedFor);

  const index = book.chapters.findIndex((c) => c.id === chapterId);
  const prev = index > 0 ? book.chapters[index - 1] : null;
  const next = index >= 0 && index < book.chapters.length - 1 ? book.chapters[index + 1] : null;

  const setStatus = async (status: string) => {
    try {
      await api.patchChapter(book.id, chapterId, { status, baseVersion: data?.version });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="reader">
      <ChapterSidebar book={book} active={chapterId} headings={parsed?.headings} />
      <main className="reader-main">
        <div className="reader-toolbar">
          <select
            className={`status status-${summary?.status ?? 'draft'}`}
            value={summary?.status ?? 'draft'}
            onChange={(e) => void setStatus(e.target.value)}
          >
            {CHAPTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="muted small">
            {formatNumber(parsed?.words ?? 0)} 字{summary && !summary.listed && ' · 未排入目錄'}
          </span>
          <span className={`live ${pulse ? 'live-pulse' : ''}`} title="檔案有變動時會自動更新">
            {pulse ? '已更新' : '即時同步'}
          </span>
          <span className="spacer" />
          <span className="muted small hide-narrow">選取文字 → 留言給 AI · 雙擊段落直接修改</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowHistory(true)}
          >
            版本紀錄
          </button>
          <a
            className="btn btn-sm"
            href={href({ name: 'source', book: book.id, chapter: chapterId })}
          >
            原始碼
          </a>
        </div>

        {error && <div className="page-error">{error.message}</div>}
        {!data && !error && <div className="loading">載入中…</div>}
        {data && (
          <article className="page">
            <ChapterDocument
              book={book.id}
              chapter={chapterId}
              source={data.source}
              config={book.config}
              onFocus={report}
              onChanged={() => void reload()}
            />
            {parsed && parsed.blocks.length === 0 && (
              <p className="empty">
                這一章還是空的。對 AI 說「寫這一章」，或按右上角「原始碼」自己寫。
              </p>
            )}
          </article>
        )}

        <nav className="chapter-nav">
          {prev ? (
            <a href={href({ name: 'read', book: book.id, chapter: prev.id })}>← {prev.title}</a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={href({ name: 'read', book: book.id, chapter: next.id })}>{next.title} →</a>
          ) : (
            <span />
          )}
        </nav>
      </main>
      {showHistory && data && (
        <HistoryDialog
          book={book.id}
          chapter={chapterId}
          current={data.source}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
