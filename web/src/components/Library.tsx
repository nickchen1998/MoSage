// The bookshelf: every book and thesis in the project.

import { useEffect, useState } from 'react';
import { api, type Library as LibraryData, useLive } from '../api.ts';
import { formatNumber, relativeTime, STAGE_LABEL, TYPE_LABEL } from '../labels.ts';
import { href, navigate } from '../router.ts';
import { toastError } from '../toast.tsx';
import { CopyText, Modal } from './ui.tsx';

function NewBookDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('book');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const { id } = await api.createBook({ title: title.trim(), type });
      navigate({ name: 'outline', book: id });
    } catch (err) {
      toastError(err);
      setBusy(false);
    }
  };
  return (
    <Modal title="新增一本書" onClose={onClose}>
      <p className="muted">
        建議直接在 AI 工具裡說「我想寫一本新書」，AI
        會先訪談你再建立。這裡則是先建立空白的書，之後再請 AI 立項。
      </p>
      <label className="field">
        <span>暫定書名</span>
        <input
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：和 AI 一起寫書"
          onKeyDown={(e) => e.key === 'Enter' && title.trim() && void submit()}
        />
      </label>
      <div className="field">
        <span>類型</span>
        <div className="segmented">
          {(['book', 'thesis', 'other'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? 'on' : ''}
              onClick={() => setType(t)}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !title.trim()}
          onClick={() => void submit()}
        >
          建立
        </button>
      </div>
    </Modal>
  );
}

function Onboarding() {
  return (
    <section className="onboarding">
      <h2>開始你的第一本書</h2>
      <p className="muted">
        MoSage 讓你和 AI 一起寫作：AI 負責起草與修訂，你在這裡閱讀、留言、決定。
      </p>
      <ol className="steps">
        <li>
          <strong>在這個專案資料夾開啟 AI 工具</strong>
          <p>另開一個終端機，切換到這個資料夾後執行：</p>
          <div className="copy-row">
            <CopyText text="claude" />
            <span className="muted">或</span>
            <CopyText text="codex" />
          </div>
        </li>
        <li>
          <strong>對 AI 說「開始」</strong>
          <p>
            AI 會問你寫作目的、類型（書／論文）、讀者、風格與篇幅，一次問一兩題。Claude Code
            也可以輸入
            <code>/kickoff</code>。
          </p>
        </li>
        <li>
          <strong>訂書名、排大綱</strong>
          <p>AI 提出書名與章節架構，建立後書會出現在這個書架上，你可以在「大綱」頁拖曳編排。</p>
        </li>
        <li>
          <strong>一章一章寫</strong>
          <p>AI 寫的內容會即時出現在這裡。選取文字就能留言給 AI，最後一鍵匯出 Word。</p>
        </li>
      </ol>
    </section>
  );
}

export function Library() {
  const { data, error } = useLive<LibraryData>(
    () => api.library(),
    'library',
    (e) => e.type === 'library',
  );
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void api.current({ view: 'library', book: null, chapter: null }).catch(() => {});
    document.title = 'MoSage 書架';
  }, []);

  if (error) return <div className="page-error">{error.message}</div>;
  if (!data) return <div className="loading">載入中…</div>;

  return (
    <div className="library">
      <header className="topbar">
        <nav className="crumbs">
          <span className="brand">
            <span className="brand-mark">M</span>
            <span className="brand-name">MoSage</span>
          </span>
          <span className="crumb-sep">/</span>
          <span className="crumb-page">{data.name}</span>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            新增一本書
          </button>
        </div>
      </header>

      <main className="library-main">
        {data.books.length === 0 ? (
          <Onboarding />
        ) : (
          <>
            <h1 className="library-title">書架</h1>
            <div className="shelf">
              {data.books.map((book) => {
                const c = book.config;
                const pct = c.targetWords
                  ? Math.min(100, Math.round((book.totals.words / c.targetWords) * 100))
                  : null;
                const pending = book.totals.comments + book.totals.suggestions;
                return (
                  <a
                    key={book.id}
                    className="book-card"
                    href={href({ name: 'outline', book: book.id })}
                  >
                    <div className={`book-spine spine-${c.type}`}>
                      <span>{(c.title || '未命名').slice(0, 12)}</span>
                    </div>
                    <div className="book-info">
                      <div className="book-card-head">
                        <span className="badge">{TYPE_LABEL[c.type]}</span>
                        <span className={`stage stage-${c.stage}`}>{STAGE_LABEL[c.stage]}</span>
                      </div>
                      <h2>{c.title || '（尚未命名）'}</h2>
                      {c.subtitle && <p className="book-sub">{c.subtitle}</p>}
                      <div className="book-meta">
                        {book.chapters.length} 章 · {formatNumber(book.totals.words)} 字
                        {c.targetWords ? ` / ${formatNumber(c.targetWords)}` : ''}
                      </div>
                      {pct !== null && (
                        <div className="progress" title={`${pct}%`}>
                          <div style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <div className="book-foot">
                        <span className="muted">{relativeTime(book.updatedAt)}更新</span>
                        {pending > 0 && <span className="pill">{pending} 個待處理</span>}
                        {!book.hasBrief && <span className="pill pill-warn">待立項</span>}
                      </div>
                    </div>
                  </a>
                );
              })}
              <button
                type="button"
                className="book-card book-card-new"
                onClick={() => setCreating(true)}
              >
                <span className="plus">＋</span>
                <span>新增一本書</span>
                <span className="muted small">或對 AI 說「我想寫一本新書」</span>
              </button>
            </div>
          </>
        )}
      </main>
      {creating && <NewBookDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
