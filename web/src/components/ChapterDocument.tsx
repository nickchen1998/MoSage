// One chapter, typeset like a book page, where every block can be commented
// on (for the AI), edited in place, and where AI suggestions show as a diff
// with accept / reject.

import type { Root } from 'mdast';
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Annotation } from '../../../src/shared/annotations.ts';
import type { BookConfig } from '../../../src/shared/config.ts';
import { diffText } from '../../../src/shared/diff.ts';
import {
  type Block,
  lineAt,
  type ParsedChapter,
  parseChapter,
  parseMarkdown,
  textOf,
} from '../../../src/shared/markdown.ts';
import { ApiError, api } from '../api.ts';
import { relativeTime } from '../labels.ts';
import { toast, toastError } from '../toast.tsx';
import {
  collectFootnotes,
  Footnotes,
  Node,
  type RenderContext,
  RenderProvider,
} from './Markdown.tsx';

export interface FocusInfo {
  chapter: string;
  block: { index: number; line: number; type: string; text: string } | null;
  section: string | null;
  selection: { text: string; line: number } | null;
}

interface Props {
  book: string;
  chapter: string;
  source: string;
  config: BookConfig;
  /** Preview only: no editing, comments or suggestion buttons. */
  readOnly?: boolean;
  idPrefix?: string;
  onFocus?: (info: FocusInfo) => void;
  onChanged?: () => void;
}

export function bookTypography(config: BookConfig): CSSProperties {
  const e = config.export;
  return {
    '--book-font': `"${e.fonts.latin}", "${e.fonts.body}", var(--serif)`,
    '--book-heading-font': `"${e.fonts.latin}", "${e.fonts.heading}", var(--sans)`,
    '--book-indent': `${e.firstLineIndent}em`,
    '--book-leading': String(Math.max(1.5, Math.min(2.4, 1.2 * e.lineSpacing + 0.1))),
  } as CSSProperties;
}

function sectionAbove(parsed: ParsedChapter, index: number): string | null {
  for (let i = index; i >= 0; i--) {
    const b = parsed.blocks[i];
    if (b.node.type === 'heading') return textOf(b.node).trim();
  }
  return null;
}

function AutoTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize on value change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      className={props.className}
      value={props.value}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={props.onKeyDown}
    />
  );
}

function SuggestionView({
  original,
  suggestion,
  ctx,
}: {
  original: string;
  suggestion: Annotation;
  ctx: RenderContext;
}) {
  const [mode, setMode] = useState<'diff' | 'after'>('diff');
  const parts = useMemo(() => diffText(original, suggestion.body), [original, suggestion.body]);
  const after = useMemo(() => parseMarkdown(suggestion.body), [suggestion.body]);
  return (
    <div className="suggestion">
      <div className="suggestion-tabs">
        <button
          type="button"
          className={mode === 'diff' ? 'on' : ''}
          onClick={() => setMode('diff')}
        >
          新舊對照
        </button>
        <button
          type="button"
          className={mode === 'after' ? 'on' : ''}
          onClick={() => setMode('after')}
        >
          修改後
        </button>
      </div>
      {mode === 'diff' ? (
        <div className="diff">
          {parts.map((p, i) =>
            p.type === 'same' ? (
              <span key={i}>{p.text}</span>
            ) : p.type === 'add' ? (
              <ins key={i}>{p.text}</ins>
            ) : (
              <del key={i}>{p.text}</del>
            ),
          )}
        </div>
      ) : (
        <RenderProvider value={{ ...ctx, highlights: [] }}>
          <div className="suggestion-after">
            <Node node={after} />
          </div>
        </RenderProvider>
      )}
    </div>
  );
}

function NoteCard({
  a,
  busy,
  onRemove,
  onAccept,
  readOnly,
}: {
  a: Annotation;
  busy: boolean;
  onRemove: () => void;
  onAccept?: () => void;
  readOnly?: boolean;
}) {
  const kind = a.kind === 'suggest' ? 'suggest' : a.by === 'ai' ? 'ai' : 'human';
  const label = kind === 'suggest' ? 'AI 修改建議' : kind === 'ai' ? 'AI 留言' : '給 AI 的留言';
  return (
    <div className={`note note-${kind}`}>
      <div className="note-head">
        <span className="note-label">{label}</span>
        {a.at && <span className="note-time">{relativeTime(a.at)}</span>}
      </div>
      {a.quote && kind !== 'suggest' && <div className="note-quote">「{a.quote}」</div>}
      <div className="note-body">{kind === 'suggest' ? a.note || '改寫這一段' : a.body}</div>
      {kind === 'human' && <div className="note-foot">等待 AI 處理 · 對 AI 說「處理留言」</div>}
      {!readOnly && (
        <div className="note-actions">
          {kind === 'suggest' && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={onAccept}
              >
                接受
              </button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={onRemove}>
                拒絕
              </button>
            </>
          )}
          {kind === 'ai' && (
            <button type="button" className="btn btn-sm" disabled={busy} onClick={onRemove}>
              已讀，移除
            </button>
          )}
          {kind === 'human' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={onRemove}
            >
              刪除留言
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ChapterDocument({
  book,
  chapter,
  source,
  config,
  readOnly,
  idPrefix = '',
  onFocus,
  onChanged,
}: Props) {
  const parsed = useMemo(() => parseChapter(source), [source]);
  const footnotes = useMemo(() => collectFootnotes(parsed.tree as Root), [parsed]);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [composer, setComposer] = useState<{ index: number; quote: string; body: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [floating, setFloating] = useState<{
    index: number;
    quote: string;
    x: number;
    y: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const baseCtx: RenderContext = { book, footnotes, highlights: [], idPrefix };

  // Hide stale editors when the underlying source changes under us.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on source change
  useEffect(() => {
    if (editing && !parsed.blocks[editing.index]) setEditing(null);
  }, [parsed]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) toast(success, 'success');
        onChanged?.();
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast('這一章剛被修改過（可能是 AI 正在寫），已重新載入，請再試一次。', 'error');
          onChanged?.();
        } else toastError(err);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const focusBlock = useCallback(
    (block: Block | null, selection: FocusInfo['selection'] = null) => {
      onFocus?.({
        chapter,
        block: block
          ? {
              index: block.index,
              line: lineAt(source, block.start),
              type: block.node.type,
              text: textOf(block.node).replace(/\s+/g, ' ').trim().slice(0, 120),
            }
          : null,
        section: block ? sectionAbove(parsed, block.index) : null,
        selection,
      });
    },
    [chapter, onFocus, parsed, source],
  );

  // Selecting text inside one block offers "留言給 AI".
  useEffect(() => {
    if (readOnly) return;
    const onUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        if (!sel || !text || sel.rangeCount === 0) {
          setFloating(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const startEl = (range.startContainer as Element).parentElement ?? null;
        const endEl = (range.endContainer as Element).parentElement ?? null;
        const a = startEl?.closest<HTMLElement>('[data-block]');
        const b = endEl?.closest<HTMLElement>('[data-block]');
        if (!a || a !== b || !rootRef.current?.contains(a)) {
          setFloating(null);
          return;
        }
        const index = Number(a.dataset.block);
        const rect = range.getBoundingClientRect();
        setFloating({
          index,
          quote: text.slice(0, 200),
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
        const block = parsed.blocks[index];
        if (block)
          focusBlock(block, { text: text.slice(0, 500), line: lineAt(source, block.start) });
      }, 0);
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keyup', onUp);
    return () => {
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keyup', onUp);
    };
  }, [readOnly, parsed, source, focusBlock]);

  useEffect(() => {
    if (!floating) return;
    const hide = () => setFloating(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [floating]);

  const saveEdit = async () => {
    if (!editing) return;
    const block = parsed.blocks[editing.index];
    if (!block) return;
    const expected = source.slice(block.start, block.end);
    if (editing.text === expected) {
      setEditing(null);
      return;
    }
    const ok = await run(() =>
      api.replace(book, chapter, {
        start: block.start,
        end: block.end,
        expected,
        text: editing.text.replace(/\s+$/, ''),
      }),
    );
    if (ok) setEditing(null);
  };

  const sendComment = async () => {
    if (!composer?.body.trim()) return;
    const block = parsed.blocks[composer.index];
    if (!block) return;
    const ok = await run(
      () =>
        api.comment(book, chapter, {
          blockStart: block.start,
          blockText: source.slice(block.start, block.end),
          body: composer.body,
          quote: composer.quote || undefined,
        }),
      '已留言。對 AI 說「處理留言」就會處理。',
    );
    if (ok) {
      setComposer(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const openComposer = (index: number, quote = '') => {
    setFloating(null);
    setEditing(null);
    setComposer({ index, quote, body: '' });
  };

  const orphans = parsed.annotations.filter((a) => a.blockIndex === null);
  const spanned = new Map<number, Annotation>();
  for (const block of parsed.blocks) {
    const s = block.annotations.find((a) => a.kind === 'suggest');
    if (s) for (let i = 1; i < Math.max(1, s.span); i++) spanned.set(block.index + i, s);
  }

  return (
    <div className="chapter-doc" ref={rootRef} style={bookTypography(config)}>
      {parsed.blocks.map((block) => {
        const suggestion = block.annotations.find((a) => a.kind === 'suggest');
        const replacedBy = spanned.get(block.index);
        const notes = block.annotations;
        const highlights = notes
          .filter((a) => a.kind === 'comment' && a.quote)
          .map((a) => a.quote!);
        const isEditing = editing?.index === block.index;
        const isComposing = composer?.index === block.index;
        const type = block.node.type;
        const isHeading = type === 'heading';

        let content: React.ReactNode;
        if (isEditing) {
          content = (
            <div className="inline-editor">
              <AutoTextarea
                className="inline-editor-text"
                value={editing.text}
                autoFocus
                onChange={(text) => setEditing({ index: block.index, text })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null);
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit();
                }}
              />
              <div className="inline-editor-bar">
                <span className="hint">Markdown · ⌘/Ctrl + Enter 儲存 · Esc 取消</span>
                <button type="button" className="btn btn-sm" onClick={() => setEditing(null)}>
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => void saveEdit()}
                >
                  儲存
                </button>
              </div>
            </div>
          );
        } else if (suggestion && suggestion.span > 0) {
          const last =
            parsed.blocks[Math.min(parsed.blocks.length - 1, block.index + suggestion.span - 1)];
          content = (
            <SuggestionView
              original={source.slice(block.start, last.end)}
              suggestion={suggestion}
              ctx={baseCtx}
            />
          );
        } else if (replacedBy) {
          content = null; // shown inside the suggestion above
        } else {
          content = (
            <RenderProvider value={{ ...baseCtx, highlights }}>
              {suggestion && suggestion.span === 0 && (
                <SuggestionView original="" suggestion={suggestion} ctx={baseCtx} />
              )}
              <Node node={block.node} />
            </RenderProvider>
          );
        }
        if (content === null) return null;

        return (
          <div
            key={`${block.index}-${block.start}`}
            className={`block block-${type}${isHeading ? ` block-h${(block.node as { depth: number }).depth}` : ''}${notes.length ? ' has-notes' : ''}${isEditing ? ' is-editing' : ''}`}
            data-block={block.index}
            data-line={lineAt(source, block.start)}
            onClick={() => focusBlock(block)}
            onDoubleClick={(e) => {
              if (readOnly || isEditing || suggestion) return;
              if ((e.target as HTMLElement).closest('a,button,textarea')) return;
              window.getSelection()?.removeAllRanges();
              setComposer(null);
              setEditing({ index: block.index, text: source.slice(block.start, block.end) });
            }}
          >
            {!readOnly && !isEditing && (
              <div className="block-tools">
                <button
                  type="button"
                  title="留言給 AI"
                  onClick={(e) => {
                    e.stopPropagation();
                    openComposer(block.index);
                  }}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 4h12v9H9l-4 3v-3H4z" />
                  </svg>
                </button>
                {!suggestion && (
                  <button
                    type="button"
                    title="直接修改（雙擊段落也可以）"
                    onClick={(e) => {
                      e.stopPropagation();
                      setComposer(null);
                      setEditing({
                        index: block.index,
                        text: source.slice(block.start, block.end),
                      });
                    }}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M4 16l1-4 8-8 3 3-8 8zM12 5l3 3" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <div className="block-content">{content}</div>
            {(notes.length > 0 || isComposing) && (
              <div className="block-notes">
                {notes.map((a) => (
                  <NoteCard
                    key={a.id}
                    a={a}
                    busy={busy}
                    readOnly={readOnly}
                    onRemove={() =>
                      void run(
                        () => api.removeAnnotation(book, chapter, a.id),
                        a.kind === 'suggest' ? '已拒絕這個修改建議' : undefined,
                      )
                    }
                    onAccept={() =>
                      void run(() => api.acceptSuggestion(book, chapter, a.id), '已套用修改')
                    }
                  />
                ))}
                {isComposing && (
                  <div className="note note-compose">
                    <div className="note-head">
                      <span className="note-label">留言給 AI</span>
                    </div>
                    {composer.quote && <div className="note-quote">「{composer.quote}」</div>}
                    <AutoTextarea
                      className="note-input"
                      value={composer.body}
                      autoFocus
                      placeholder="想怎麼改？例如：這段太長，拆成兩段並舉個例子"
                      onChange={(body) => setComposer({ ...composer, body })}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setComposer(null);
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void sendComment();
                      }}
                    />
                    <div className="note-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setComposer(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy || !composer.body.trim()}
                        onClick={() => void sendComment()}
                      >
                        送出
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {orphans.length > 0 && (
        <div className="block block-orphans has-notes">
          <div className="block-content">
            <p className="muted">章末的標記</p>
          </div>
          <div className="block-notes">
            {orphans.map((a) => (
              <NoteCard
                key={a.id}
                a={a}
                busy={busy}
                readOnly={readOnly}
                onRemove={() => void run(() => api.removeAnnotation(book, chapter, a.id))}
                onAccept={() =>
                  void run(() => api.acceptSuggestion(book, chapter, a.id), '已套用修改')
                }
              />
            ))}
          </div>
        </div>
      )}

      <RenderProvider value={baseCtx}>
        <Footnotes tree={parsed.tree as Root} />
      </RenderProvider>

      {floating && !readOnly && (
        <button
          type="button"
          className="floating-comment"
          style={{ left: floating.x, top: floating.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => openComposer(floating.index, floating.quote)}
        >
          留言給 AI
        </button>
      )}
    </div>
  );
}
