// Header shared by every page of a book: breadcrumbs, tabs, export.

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api, type BookSummary } from '../api.ts';
import { TYPE_LABEL } from '../labels.ts';
import { href, type Route } from '../router.ts';
import { toast, toastError } from '../toast.tsx';

function filenameFrom(disposition: string | null, fallback: string): string {
  const star = disposition && /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = disposition && /filename="([^"]+)"/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

export function ExportMenu({ book }: { book: BookSummary }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const download = async (format: 'docx' | 'html' | 'md') => {
    setOpen(false);
    setBusy(format);
    try {
      const res = await fetch(api.exportUrl(book.id, format));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `匯出失敗（${res.status}）`);
      }
      const blob = await res.blob();
      const name = filenameFrom(res.headers.get('content-disposition'), `${book.id}.${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast(`已下載 ${name}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  };

  const empty = book.chapters.length === 0;
  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy !== null}
        onClick={() => setOpen(!open)}
        title={empty ? '目錄裡還沒有章節' : undefined}
      >
        {busy ? '匯出中…' : '匯出'}
      </button>
      {open && (
        <div className="menu-pop">
          <button type="button" onClick={() => void download('docx')}>
            <strong>Word（.docx）</strong>
            <span>交稿用：標題樣式、目錄、頁碼、註腳</span>
          </button>
          <button type="button" onClick={() => void download('html')}>
            <strong>HTML</strong>
            <span>單一檔案，可在瀏覽器列印成 PDF</span>
          </button>
          <button type="button" onClick={() => void download('md')}>
            <strong>Markdown</strong>
            <span>合併成一個純文字檔</span>
          </button>
          <p className="menu-note">只會匯出目錄裡的章節，留言與修改建議不會出現在匯出檔。</p>
        </div>
      )}
    </div>
  );
}

export function BookShell({
  book,
  route,
  children,
  title,
}: {
  book: BookSummary;
  route: Route;
  children: ReactNode;
  title?: ReactNode;
}) {
  const c = book.config;
  const tabs: { name: Route['name']; label: string; to: Route }[] = [
    { name: 'outline', label: '大綱', to: { name: 'outline', book: book.id } },
    {
      name: 'read',
      label: '閱讀',
      to: book.chapters[0]
        ? { name: 'read', book: book.id, chapter: book.chapters[0].id }
        : { name: 'outline', book: book.id },
    },
    { name: 'all', label: '全書預覽', to: { name: 'all', book: book.id } },
    { name: 'files', label: '素材', to: { name: 'files', book: book.id } },
  ];
  const active = route.name === 'source' ? 'read' : route.name;
  const pending = book.totals.comments + book.totals.suggestions + book.totals.aiNotes;

  return (
    <div className="book-shell">
      <header className="topbar">
        <nav className="crumbs">
          <a href={href({ name: 'library' })} className="brand" title="書架">
            <span className="brand-mark">M</span>
          </a>
          <span className="crumb-sep">/</span>
          <a href={href({ name: 'outline', book: book.id })} className="crumb-book">
            {c.title || '未命名'}
          </a>
          <span className="badge">{TYPE_LABEL[c.type]}</span>
          {title && (
            <>
              <span className="crumb-sep">/</span>
              <span className="crumb-page">{title}</span>
            </>
          )}
        </nav>
        <nav className="tabs">
          {tabs.map((t) => (
            <a key={t.name} href={href(t.to)} className={active === t.name ? 'tab on' : 'tab'}>
              {t.label}
              {t.name === 'outline' && pending > 0 && (
                <span className="dot" title="有待處理的標記" />
              )}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <ExportMenu book={book} />
        </div>
      </header>
      {children}
    </div>
  );
}
