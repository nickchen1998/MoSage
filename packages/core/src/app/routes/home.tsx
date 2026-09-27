import {
  Copy,
  FileText,
  FolderInput,
  MoreHorizontal,
  Palette,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { PageFrame } from '../components/page-frame';
import { DOC_DND_MIME } from '../components/sidebar/folder-item';
import { ALL_DOCS_ID, DRAFT_ID } from '../components/sidebar/sidebar';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/menu';
import { coverContent, pageCountLabel } from '../lib/doc-preview';
import { docCreatedAt, docIds, docThemes } from '../lib/docs';
import { useT } from '../lib/i18n';
import { resolvePageGeometry } from '../lib/sdk';
import { findTheme } from '../lib/themes';
import { useDocModule } from '../lib/use-doc-module';
import type { HomeOutletContext } from './home-shell';

const THUMB_WIDTH = 190;

export function Home() {
  const t = useT();
  const ctx = useOutletContext<HomeOutletContext>();
  const [error, setError] = useState<string | null>(null);

  const folder = ctx.manifest.folders.find((f) => f.id === ctx.selectedId);
  const visibleIds = useMemo(() => {
    const source =
      ctx.selectedId === ALL_DOCS_ID
        ? [...docIds]
        : ctx.selectedId === DRAFT_ID
          ? [...ctx.draftDocs]
          : [...(ctx.docsByFolder[ctx.selectedId] ?? [])];
    return source.sort((a, b) => {
      const at = docCreatedAt[a] ?? 0;
      const bt = docCreatedAt[b] ?? 0;
      if (at !== bt) return bt - at;
      return a.localeCompare(b);
    });
  }, [ctx.selectedId, ctx.draftDocs, ctx.docsByFolder]);

  const heading =
    ctx.selectedId === ALL_DOCS_ID
      ? t('Documents')
      : ctx.selectedId === DRAFT_ID
        ? t('Unfiled')
        : (folder?.name ?? t('Documents'));

  return (
    <div>
      <h1 className="sr-only">{heading}</h1>
      {error && (
        <p className="mb-6 rounded-md border border-border bg-background px-3 py-2 text-xs">
          {error}
        </p>
      )}

      {visibleIds.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium text-sm">{t('Nothing here yet')}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {ctx.selectedId === ALL_DOCS_ID
              ? t.rich('Create {file} and it appears here.', {
                  file: <code className="font-mono">docs/&lt;id&gt;/index.tsx</code>,
                })
              : t('Drag a document onto this folder in the sidebar to file it here.')}
          </p>
        </div>
      ) : (
        <div className="grid gap-7 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          {visibleIds.map((id) => (
            <DocCard key={id} docId={id} ctx={ctx} onError={setError} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocCard({
  docId,
  ctx,
  onError,
}: {
  docId: string;
  ctx: HomeOutletContext;
  onError: (message: string | null) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const state = useDocModule(docId);
  const doc = state.doc;
  const geometry = resolvePageGeometry(doc?.meta);
  const scale = THUMB_WIDTH / geometry.width;
  const cover = coverContent(doc);
  const theme = findTheme(docThemes[docId]);
  const title = doc?.meta?.title ?? docId;
  const currentFolder = ctx.manifest.assignments[docId];

  const run = async (action: () => Promise<unknown>) => {
    onError(null);
    try {
      await action();
    } catch (err) {
      onError(String((err as Error).message));
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging files a document — the card menu's "Move to" is the keyboard path
    <div
      className="group flex flex-col gap-2.5"
      draggable={import.meta.env.DEV}
      onDragStart={(e) => {
        if (!import.meta.env.DEV) return;
        e.dataTransfer.setData(DOC_DND_MIME, docId);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <Link to={`/d/${docId}`}>
        <div
          className="overflow-hidden rounded-md ring-1 ring-border transition-shadow group-hover:shadow-lg"
          style={{ width: THUMB_WIDTH, height: geometry.height * scale }}
        >
          {cover ? (
            <PageFrame
              index={0}
              total={doc?.default?.length ?? 1}
              geometry={geometry}
              scale={scale}
              design={doc?.design}
              watermark={doc?.meta?.watermark}
              flat
            >
              {cover}
            </PageFrame>
          ) : (
            <div className="size-full bg-muted" />
          )}
        </div>
      </Link>

      <div className="flex min-w-0 items-start gap-1">
        <div className="min-w-0 flex-1">
          <Link to={`/d/${docId}`} className="block truncate font-medium text-sm hover:underline">
            {title}
          </Link>
          <p className="mt-0.5 truncate text-muted-foreground text-xs">
            {pageCountLabel(doc, t)} · {doc?.meta?.pageSize ?? 'A4'}
          </p>
          {theme && (
            <Link
              to={`/themes/${theme.id}`}
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[0.625rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Palette className="size-2.5" />
              {theme.name}
            </Link>
          )}
        </div>

        {import.meta.env.DEV && (
          <Menu
            trigger={(props) => (
              <button
                type="button"
                aria-label={t('{name} options', { name: title })}
                className="flex size-6 flex-none items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100"
                {...props}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    close();
                    const next = window.prompt(t('Document title'), title);
                    if (next && next !== title) void run(() => ctx.renameDoc(docId, next));
                  }}
                >
                  <PencilLine className="size-3.5" />
                  {t('Rename')}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    close();
                    void run(async () => {
                      const newId = await ctx.duplicateDoc(docId);
                      navigate(`/d/${newId}`);
                    });
                  }}
                >
                  <Copy className="size-3.5" />
                  {t('Duplicate')}
                </MenuItem>

                <MenuSeparator />
                <p className="px-2 py-1 text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                  {t('Move to')}
                </p>
                <MenuItem
                  active={!currentFolder}
                  onClick={() => {
                    close();
                    void run(() => ctx.assign(docId, null));
                  }}
                >
                  <FolderInput className="size-3.5" />
                  {t('Unfiled')}
                </MenuItem>
                {ctx.manifest.folders.map((folder) => (
                  <MenuItem
                    key={folder.id}
                    active={currentFolder === folder.id}
                    onClick={() => {
                      close();
                      void run(() => ctx.assign(docId, folder.id));
                    }}
                  >
                    <FolderInput className="size-3.5" />
                    {folder.name}
                  </MenuItem>
                ))}

                <MenuSeparator />
                <MenuItem
                  destructive
                  onClick={() => {
                    close();
                    const question = t('Delete “{title}”? This removes {path} from disk.', {
                      title,
                      path: `docs/${docId}/`,
                    });
                    if (!window.confirm(question)) return;
                    void run(() => ctx.deleteDoc(docId));
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {t('Delete document')}
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  );
}
