import { ArrowLeft, Palette } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Markdown } from '../components/themes/markdown';
import { ThemePreview } from '../components/themes/theme-preview';
import { docsByTheme } from '../lib/docs';
import { findTheme, themes } from '../lib/themes';

const GALLERY_WIDTH = 200;
const DETAIL_WIDTH = 260;

export function ThemesGalleryPage() {
  return (
    <div>
      <header className="border-border border-b px-8 py-6">
        <h1 className="font-medium text-lg tracking-tight">Themes</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every <code className="font-mono">.md</code> file under{' '}
          <code className="font-mono">themes/</code>. A theme is documentation — palette, type
          scale, and paste-ready components a document copies from.
        </p>
      </header>

      {themes.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <Palette className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium text-sm">No themes yet</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Ask your agent for the <code className="font-mono">create-theme</code> skill, or add{' '}
            <code className="font-mono">themes/&lt;id&gt;.md</code>.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 px-8 py-8 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {themes.map((theme) => (
            <Link key={theme.id} to={`/themes/${theme.id}`} className="group flex flex-col gap-3">
              <div className="transition-shadow group-hover:shadow-lg">
                <ThemePreview theme={theme} width={GALLERY_WIDTH} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{theme.name}</p>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs">
                  {theme.description || theme.id}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThemeDetailPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const theme = findTheme(themeId);

  if (!theme) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="font-medium text-sm">Theme “{themeId}” not found.</p>
        <Link to="/themes" className="mt-3 inline-block text-muted-foreground text-xs underline">
          Back to themes
        </Link>
      </div>
    );
  }

  const usedBy = docsByTheme(theme.id);
  const chips = [theme.pageSize, theme.mode].filter(Boolean);

  return (
    <div className="px-8 py-6">
      <Link
        to="/themes"
        className="inline-flex items-center gap-1.5 text-muted-foreground text-xs hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Themes
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <h1 className="font-medium text-lg tracking-tight">{theme.name}</h1>
        <code className="font-mono text-muted-foreground text-xs">{theme.id}</code>
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
      {theme.description && (
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm">{theme.description}</p>
      )}

      <div className="mt-6">
        <ThemePreview theme={theme} width={DETAIL_WIDTH} all />
      </div>

      {usedBy.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Used by</span>
          {usedBy.map((docId) => (
            <Link
              key={docId}
              to={`/d/${docId}`}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] transition-colors hover:bg-accent"
            >
              {docId}
            </Link>
          ))}
        </div>
      )}

      <article className="mt-8 max-w-3xl border-border border-t pt-6">
        <Markdown source={theme.body} />
      </article>
    </div>
  );
}
