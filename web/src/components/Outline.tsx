// A book's home: stage, brief, and the chapter outline the author arranges —
// drag to reorder, edit titles and summaries, add or shelve chapters.

import { useEffect, useMemo, useState } from 'react';
import { CHAPTER_STATUSES, STAGES, type Stage } from '../../../src/shared/config.ts';
import { parseMarkdown } from '../../../src/shared/markdown.ts';
import { api, type BookSummary, type ChapterSummary } from '../api.ts';
import { formatNumber, STAGE_HINT, STAGE_LABEL, STATUS_LABEL } from '../labels.ts';
import { href } from '../router.ts';
import { toastError } from '../toast.tsx';
import { Node, RenderProvider } from './Markdown.tsx';
import { CopyText, EditableText, Modal } from './ui.tsx';

function StageStepper({ book }: { book: BookSummary }) {
  const stage = book.config.stage;
  const current = STAGES.indexOf(stage);
  const setStage = async (s: Stage) => {
    try {
      await api.updateBook(book.id, { stage: s });
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <div className="stepper">
      {STAGES.map((s, i) => (
        <button
          key={s}
          type="button"
          className={`step ${i < current ? 'done' : ''} ${i === current ? 'on' : ''}`}
          onClick={() => void setStage(s)}
          title="點一下切換階段（AI 也會自動更新）"
        >
          <span className="step-no">{i + 1}</span>
          {STAGE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function DocDialog({
  book,
  name,
  onClose,
}: {
  book: string;
  name: 'brief' | 'style';
  onClose: () => void;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    api.doc(book, name).then((d) => setSource(d.source), toastError);
  }, [book, name]);
  const tree = useMemo(() => parseMarkdown(source ?? ''), [source]);
  const save = async () => {
    try {
      await api.saveDoc(book, name, source ?? '');
      setEditing(false);
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Modal
      wide
      title={name === 'brief' ? '寫作企劃（brief.md）' : '風格指南（STYLE.md）'}
      onClose={onClose}
    >
      {source === null ? (
        <div className="loading">載入中…</div>
      ) : editing ? (
        <textarea
          className="doc-editor"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      ) : (
        <div className="prose doc-preview">
          <RenderProvider value={{ book, footnotes: new Map(), highlights: [], idPrefix: 'doc-' }}>
            <Node node={tree} />
          </RenderProvider>
        </div>
      )}
      <div className="modal-actions">
        <span className="muted small">AI 每次動筆前都會讀這份文件。</span>
        {editing ? (
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            儲存
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            編輯
          </button>
        )}
      </div>
    </Modal>
  );
}

function ChapterRow({
  book,
  chapter,
  index,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  book: BookSummary;
  chapter: ChapterSummary;
  index: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const patch = async (p: Record<string, unknown>) => {
    try {
      await api.patchChapter(book.id, chapter.id, { ...p, baseVersion: chapter.version });
    } catch (err) {
      toastError(err);
    }
  };
  const notes = chapter.comments + chapter.suggestions + chapter.aiNotes;
  return (
    <li
      className={`chapter-row ${dragging ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', chapter.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="drag-handle" title="拖曳排序">
        ⋮⋮
      </div>
      <div className="chapter-no">{String(index + 1).padStart(2, '0')}</div>
      <div className="chapter-main">
        <EditableText
          className="chapter-title"
          value={chapter.title}
          onSave={(title) => patch({ title })}
        />
        <EditableText
          className="chapter-summary"
          value={chapter.summary}
          placeholder="加上一兩句摘要：這一章要讓讀者……"
          multiline
          onSave={(summary) => patch({ summary })}
        />
        {chapter.sections.length > 0 && (
          <ul className="sections">
            {chapter.sections.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="chapter-side">
        <select
          className={`status status-${chapter.status}`}
          value={chapter.status}
          onChange={(e) => void patch({ status: e.target.value })}
        >
          {CHAPTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="chapter-words">{formatNumber(chapter.words)} 字</div>
        {notes > 0 && (
          <div className="chapter-notes">
            {chapter.comments > 0 && (
              <span className="pill pill-human">{chapter.comments} 則給 AI</span>
            )}
            {chapter.suggestions > 0 && (
              <span className="pill pill-suggest">{chapter.suggestions} 個建議</span>
            )}
            {chapter.aiNotes > 0 && (
              <span className="pill pill-ai">{chapter.aiNotes} 則 AI 留言</span>
            )}
          </div>
        )}
        <div className="chapter-actions">
          <a
            className="btn btn-sm"
            href={href({ name: 'read', book: book.id, chapter: chapter.id })}
          >
            閱讀
          </a>
          <a
            className="btn btn-ghost btn-sm"
            href={href({ name: 'source', book: book.id, chapter: chapter.id })}
          >
            原始碼
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title="從目錄移除（檔案保留為草稿）"
            onClick={() => void api.unlistChapter(book.id, chapter.id).catch(toastError)}
          >
            移出
          </button>
        </div>
      </div>
    </li>
  );
}

export function Outline({ book }: { book: BookSummary }) {
  const [order, setOrder] = useState(book.chapters);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [doc, setDoc] = useState<'brief' | 'style' | null>(null);
  const c = book.config;

  useEffect(() => {
    if (!dragId) setOrder(book.chapters);
  }, [book.chapters, dragId]);

  useEffect(() => {
    void api
      .current({ view: 'outline', book: book.id, bookTitle: c.title, chapter: null })
      .catch(() => {});
  }, [book.id, c.title]);

  const moveOver = (overId: string) => {
    if (!dragId || dragId === overId) return;
    const from = order.findIndex((x) => x.id === dragId);
    const to = order.findIndex((x) => x.id === overId);
    if (from === -1 || to === -1) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  const commitOrder = async () => {
    const ids = order.map((x) => x.id);
    setDragId(null);
    if (ids.join('\n') === book.chapters.map((x) => x.id).join('\n')) return;
    try {
      await api.orderChapters(book.id, ids);
    } catch (err) {
      toastError(err);
    }
  };

  const addChapter = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await api.createChapter(book.id, title);
      setNewTitle('');
    } catch (err) {
      toastError(err);
    }
  };

  const hint = STAGE_HINT[c.stage];
  const pct = c.targetWords
    ? Math.min(100, Math.round((book.totals.words / c.targetWords) * 100))
    : null;

  return (
    <main className="outline-page">
      <section className="book-head">
        <div className="book-head-main">
          <EditableText
            className="book-title"
            value={c.title}
            placeholder="（尚未命名）"
            onSave={(title) => api.updateBook(book.id, { title }).then(() => {}, toastError)}
          />
          <EditableText
            className="book-subtitle"
            value={c.subtitle}
            placeholder="副標題"
            onSave={(subtitle) => api.updateBook(book.id, { subtitle }).then(() => {}, toastError)}
          />
          <div className="book-byline">
            {c.author && <span>{c.author}</span>}
            <span>
              {formatNumber(book.totals.words)} 字
              {c.targetWords ? ` / ${formatNumber(c.targetWords)}` : ''}
            </span>
            <span>{book.chapters.length} 章</span>
            <span className="muted">books/{book.id}/</span>
          </div>
          {pct !== null && (
            <div className="progress progress-lg">
              <div style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div className="book-docs">
          <button type="button" className="doc-link" onClick={() => setDoc('brief')}>
            <strong>寫作企劃</strong>
            <span>{book.hasBrief ? '目的、讀者、核心主張' : '尚未立項'}</span>
          </button>
          <button type="button" className="doc-link" onClick={() => setDoc('style')}>
            <strong>風格指南</strong>
            <span>語氣、用語、標點</span>
          </button>
        </div>
      </section>

      <StageStepper book={book} />

      <section className={`ai-hint ${!book.hasBrief ? 'ai-hint-strong' : ''}`}>
        <div>
          <strong>下一步：</strong>
          {!book.hasBrief
            ? '這本書還沒有立項。在專案資料夾開啟 Claude Code 或 Codex，對 AI 說：'
            : `${hint.text} 對 AI 說：`}
        </div>
        <CopyText text={!book.hasBrief ? `開始立項「${c.title || book.id}」` : hint.say} />
      </section>

      {book.missing.length > 0 && (
        <div className="warning">book.yaml 列出了找不到的檔案：{book.missing.join('、')}</div>
      )}

      <section className="outline-list">
        <div className="section-head">
          <h2>目錄</h2>
          <span className="muted small">拖曳排序 · 點章名或摘要直接修改</span>
        </div>
        {order.length === 0 ? (
          <div className="empty">還沒有章節。對 AI 說「幫我訂書名和大綱」，或在下方自己新增。</div>
        ) : (
          <ol className="chapters">
            {order.map((chapter, i) => (
              <ChapterRow
                key={chapter.id}
                book={book}
                chapter={chapter}
                index={i}
                dragging={dragId === chapter.id}
                onDragStart={() => setDragId(chapter.id)}
                onDragOver={() => moveOver(chapter.id)}
                onDrop={() => void commitOrder()}
                onDragEnd={() => void commitOrder()}
              />
            ))}
          </ol>
        )}
        <div className="add-chapter">
          <input
            value={newTitle}
            placeholder="新增章節：輸入章名後按 Enter"
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addChapter()}
          />
          <button
            type="button"
            className="btn"
            disabled={!newTitle.trim()}
            onClick={() => void addChapter()}
          >
            新增
          </button>
        </div>
      </section>

      {book.drafts.length > 0 && (
        <section className="drafts">
          <div className="section-head">
            <h2>未排入目錄的草稿</h2>
            <span className="muted small">不會匯出</span>
          </div>
          <ul>
            {book.drafts.map((d) => (
              <li key={d.id}>
                <a href={href({ name: 'read', book: book.id, chapter: d.id })}>{d.title}</a>
                <span className="muted small">
                  {d.id} · {formatNumber(d.words)} 字
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => void api.listChapter(book.id, d.id).catch(toastError)}
                >
                  加入目錄
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc && <DocDialog book={book.id} name={doc} onClose={() => setDoc(null)} />}
    </main>
  );
}
