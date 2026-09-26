// Markdown source with a live preview next to it. Saves with ⌘/Ctrl+S and
// never silently overwrites a change the AI made in the meantime.

import { markdown } from '@codemirror/lang-markdown';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseChapter } from '../../../src/shared/markdown.ts';
import { ApiError, api, type BookSummary, type ChapterSource, useLive } from '../api.ts';
import { formatNumber } from '../labels.ts';
import { href } from '../router.ts';
import { toast, toastError } from '../toast.tsx';
import { ChapterDocument } from './ChapterDocument.tsx';

// Prose-friendly highlighting: no underlined headings, quiet syntax marks,
// MoSage markers (HTML comments) dimmed so the text stays in front.
const proseHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--accent)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: 'var(--muted)' },
  { tag: [tags.link, tags.url], color: 'var(--ai-ink)' },
  { tag: tags.monospace, fontFamily: 'var(--mono)', color: 'var(--ink-soft)' },
  { tag: [tags.comment, tags.blockComment], color: 'var(--suggest-ink)', opacity: '0.75' },
  { tag: tags.quote, color: 'var(--ink-soft)' },
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: 'var(--muted)' },
  { tag: [tags.string, tags.content], color: 'var(--ink)' },
]);

export function SourceEditor({ book, chapterId }: { book: BookSummary; chapterId: string }) {
  const { data, reload } = useLive<ChapterSource>(
    () => api.chapter(book.id, chapterId),
    `${book.id}/${chapterId}`,
    (e) => e.type === 'chapter' && e.book === book.id && e.id === chapterId,
  );
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [text, setText] = useState('');
  const [base, setBase] = useState<ChapterSource | null>(null);
  const [conflict, setConflict] = useState<ChapterSource | null>(null);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<() => void>(() => {});
  const dirty = base !== null && text !== base.source;
  const words = useMemo(() => parseChapter(text).words, [text]);

  // Create the editor once per chapter.
  // biome-ignore lint/correctness/useExhaustiveDependencies: per chapter
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      doc: '',
      extensions: [
        basicSetup,
        yamlFrontmatter({ content: markdown() }),
        syntaxHighlighting(proseHighlight),
        EditorView.lineWrapping,
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              saveRef.current();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) setText(u.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    setBase(null);
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [chapterId]);

  const replaceDoc = (source: string) => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: source } });
    setText(source);
  };

  // Load from disk; an external change only replaces a clean buffer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: react to new data only
  useEffect(() => {
    if (!data) return;
    if (base === null || !dirty) {
      if (data.source !== text || base === null) replaceDoc(data.source);
      setBase(data);
      setConflict(null);
    } else if (data.version !== base.version) {
      setConflict(data);
    }
  }, [data]);

  const save = async () => {
    if (!base || saving) return;
    setSaving(true);
    try {
      const { version } = await api.saveChapter(book.id, chapterId, text, base.version);
      setBase({ id: chapterId, source: text, version });
      setConflict(null);
      toast('已儲存', 'success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast('檔案在你編輯時被修改了（可能是 AI）。請選擇要保留哪個版本。', 'error');
        void reload();
      } else toastError(err);
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = () => void save();

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const summary = [...book.chapters, ...book.drafts].find((c) => c.id === chapterId);

  return (
    <main className="source-page">
      <div className="reader-toolbar">
        <strong className="small">{summary?.title ?? chapterId}</strong>
        <span className="muted small">
          books/{book.id}/chapters/{chapterId} · {formatNumber(words)} 字
        </span>
        <span className="spacer" />
        {dirty && <span className="unsaved">未儲存</span>}
        <a
          className="btn btn-ghost btn-sm"
          href={href({ name: 'read', book: book.id, chapter: chapterId })}
        >
          回到閱讀
        </a>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!dirty || saving}
          onClick={() => void save()}
        >
          {saving ? '儲存中…' : '儲存（⌘/Ctrl+S）'}
        </button>
      </div>
      {conflict && (
        <div className="warning conflict">
          這個檔案在你編輯時被修改了（可能是 AI 正在寫）。
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              replaceDoc(conflict.source);
              setBase(conflict);
              setConflict(null);
            }}
          >
            載入新版本（放棄我的修改）
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setBase(conflict);
              setConflict(null);
            }}
          >
            保留我的版本（儲存時覆蓋）
          </button>
        </div>
      )}
      <div className="split">
        <div className="editor-pane" ref={host} />
        <div className="preview-pane">
          <article className="page">
            <ChapterDocument
              book={book.id}
              chapter={chapterId}
              source={text}
              config={book.config}
              readOnly
              idPrefix="preview-"
            />
          </article>
        </div>
      </div>
    </main>
  );
}
