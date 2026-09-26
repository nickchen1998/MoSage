import { useEffect, useState } from 'react';
import { api, type BookSummary, useConnection, useLive } from './api.ts';
import { BookShell } from './components/BookShell.tsx';
import { Files } from './components/Files.tsx';
import { Library } from './components/Library.tsx';
import { Outline } from './components/Outline.tsx';
import { Reader } from './components/Reader.tsx';
import { SourceEditor } from './components/SourceEditor.tsx';
import { WholeBook } from './components/WholeBook.tsx';
import { href, type Route, useRoute } from './router.ts';
import { Toaster } from './toast.tsx';

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('mosage-theme') ?? 'auto';
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('mosage-theme', theme);
    } catch {}
  }, [theme]);
  return [theme, setTheme] as const;
}

function BookRoute({ route }: { route: Exclude<Route, { name: 'library' }> }) {
  const { data: book, error } = useLive<BookSummary>(
    () => api.book(route.book),
    route.book,
    (e) => (e.type === 'book' && e.book === route.book) || e.type === 'library',
  );
  if (error) {
    return (
      <div className="page-error">
        <p>{error.message}</p>
        <a href={href({ name: 'library' })}>回到書架</a>
      </div>
    );
  }
  if (!book) return <div className="loading">載入中…</div>;

  const chapterTitle =
    'chapter' in route
      ? [...book.chapters, ...book.drafts].find((c) => c.id === route.chapter)?.title
      : undefined;
  const titles: Record<Route['name'], string | undefined> = {
    library: undefined,
    outline: undefined,
    read: chapterTitle,
    source: chapterTitle ? `${chapterTitle}（原始碼）` : undefined,
    all: '全書預覽',
    files: '素材',
  };

  return (
    <BookShell book={book} route={route} title={titles[route.name]}>
      {route.name === 'outline' && <Outline book={book} />}
      {route.name === 'read' && <Reader book={book} chapterId={route.chapter} />}
      {route.name === 'source' && <SourceEditor book={book} chapterId={route.chapter} />}
      {route.name === 'all' && <WholeBook book={book} />}
      {route.name === 'files' && <Files book={book} />}
    </BookShell>
  );
}

export function App() {
  const route = useRoute();
  const online = useConnection();
  const [theme, setTheme] = useTheme();
  const nextTheme = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';

  return (
    <>
      {route.name === 'library' ? <Library /> : <BookRoute route={route} />}
      {!online && (
        <div className="offline">
          和 MoSage 伺服器的連線中斷了 —— 請確認終端機裡的 <code>npm run dev</code> 還在執行。
        </div>
      )}
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme(nextTheme)}
        title={`外觀：${theme === 'auto' ? '跟隨系統' : theme === 'light' ? '淺色' : '深色'}`}
      >
        {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}
      </button>
      <Toaster />
    </>
  );
}
