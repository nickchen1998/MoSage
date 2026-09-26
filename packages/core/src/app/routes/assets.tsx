import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Image as ImageIcon,
  Library,
  Loader2,
  PencilLine,
  Trash2,
  Upload,
} from 'lucide-react';
import { type DragEvent, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { AssetPreview } from '../components/asset-preview';
import { ImageCard, ReferenceRow, UNSORTED_LABEL } from '../components/assets/asset-items';
import {
  type Asset,
  type AssetList,
  createChapter,
  deleteChapter,
  GLOBAL_SCOPE,
  KIND_LABEL,
  renameChapter,
  uploadAsset,
  useAssets,
} from '../lib/assets';
import { docIds, useDocTitles } from '../lib/docs';
import { cn } from '../lib/utils';

/** What the right-hand pane shows. `chapter: undefined` is every image in the scope. */
type Selection =
  | { scope: string; collection: 'images'; chapter?: string | null }
  | { scope: string; collection: 'references' };

const sameSelection = (a: Selection, b: Selection) =>
  a.scope === b.scope &&
  a.collection === b.collection &&
  (a.collection === 'references' || (b.collection === 'images' && a.chapter === b.chapter));

export function AssetsPage() {
  const scopes = useMemo(() => [GLOBAL_SCOPE, ...[...docIds].sort()], []);
  const titles = useDocTitles();
  const [selection, setSelection] = useState<Selection>({
    scope: GLOBAL_SCOPE,
    collection: 'images',
  });
  const labelOf = (scope: string) =>
    scope === GLOBAL_SCOPE ? 'Project (shared)' : (titles[scope] ?? scope);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Assets</h1>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Asset folders"
          className="w-64 flex-none overflow-y-auto border-border border-r bg-background px-2 py-3"
        >
          {scopes.map((scope) => (
            <ScopeBranch
              key={scope}
              scope={scope}
              label={labelOf(scope)}
              selection={selection}
              onSelect={setSelection}
              defaultOpen={scope === GLOBAL_SCOPE}
            />
          ))}
        </nav>
        <FolderPane
          key={`${selection.scope}/${selection.collection}`}
          selection={selection}
          scopeLabel={labelOf(selection.scope)}
          onSelect={setSelection}
        />
      </div>
    </div>
  );
}

function TreeRow({
  depth,
  label,
  count,
  icon,
  selected,
  open,
  onToggle,
  onSelect,
}: {
  depth: number;
  label: string;
  count?: number;
  icon?: ReactNode;
  selected?: boolean;
  open?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md pr-2 transition-colors',
        selected ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60',
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      {onToggle ? (
        <button
          type="button"
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          onClick={onToggle}
          className="flex size-5 flex-none items-center justify-center rounded hover:bg-background"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="size-5 flex-none" />
      )}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-sm"
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
      {count !== undefined && (
        <span className="font-mono text-muted-foreground text-xs tabular-nums">{count}</span>
      )}
    </div>
  );
}

function ScopeBranch({
  scope,
  label,
  selection,
  onSelect,
  defaultOpen,
}: {
  scope: string;
  label: string;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  defaultOpen: boolean;
}) {
  const { list } = useAssets(scope);
  const [open, setOpen] = useState(defaultOpen);
  const [imagesOpen, setImagesOpen] = useState(true);
  const images = list?.assets.filter((a) => a.kind === 'image') ?? [];
  const references = list?.assets.filter((a) => a.kind === 'reference') ?? [];
  const isOpen = open || selection.scope === scope;
  const is = (s: Selection) => sameSelection(selection, s);

  return (
    <div className="mb-1">
      <TreeRow
        depth={0}
        label={label}
        count={list?.assets.length}
        open={isOpen}
        onToggle={() => setOpen(!isOpen)}
        onSelect={() => {
          setOpen(true);
          onSelect({ scope, collection: 'images' });
        }}
      />
      {isOpen && (
        <>
          <TreeRow
            depth={1}
            label={KIND_LABEL.image}
            count={images.length}
            icon={<ImageIcon className="size-3.5 flex-none" />}
            open={imagesOpen}
            onToggle={() => setImagesOpen(!imagesOpen)}
            selected={is({ scope, collection: 'images' })}
            onSelect={() => onSelect({ scope, collection: 'images' })}
          />
          {imagesOpen && (
            <>
              {(list?.chapters ?? []).map((chapter) => (
                <TreeRow
                  key={chapter}
                  depth={2}
                  label={chapter}
                  count={images.filter((a) => a.chapter === chapter).length}
                  selected={is({ scope, collection: 'images', chapter })}
                  onSelect={() => onSelect({ scope, collection: 'images', chapter })}
                />
              ))}
              <TreeRow
                depth={2}
                label={UNSORTED_LABEL}
                count={images.filter((a) => a.chapter === null).length}
                selected={is({ scope, collection: 'images', chapter: null })}
                onSelect={() => onSelect({ scope, collection: 'images', chapter: null })}
              />
            </>
          )}
          <TreeRow
            depth={1}
            label={KIND_LABEL.reference}
            count={references.length}
            icon={<Library className="size-3.5 flex-none" />}
            selected={is({ scope, collection: 'references' })}
            onSelect={() => onSelect({ scope, collection: 'references' })}
          />
        </>
      )}
    </div>
  );
}

function FolderPane({
  selection,
  scopeLabel,
  onSelect,
}: {
  selection: Selection;
  scopeLabel: string;
  onSelect: (selection: Selection) => void;
}) {
  const { scope } = selection;
  const { list, error: listError, reload } = useAssets(scope);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Asset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chapter = selection.collection === 'images' ? (selection.chapter ?? null) : null;

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true);
      setError(null);
      for (const file of Array.from(files)) {
        let result = await uploadAsset(scope, file, { chapter });
        if (!result.ok && result.error === 'asset exists') {
          if (!window.confirm(`"${file.name}" already exists here. Replace it?`)) continue;
          result = await uploadAsset(scope, file, { chapter, overwrite: true });
        }
        if (!result.ok) setError(`${file.name}: ${result.error}`);
      }
      reload();
      setBusy(false);
    },
    [scope, chapter, reload],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files);
  };

  const newChapter = async () => {
    const name = window.prompt('Chapter name — e.g. the chapter heading');
    if (!name?.trim()) return;
    const result = await createChapter(scope, name.trim());
    if (!result.ok) return setError(result.error);
    reload();
    onSelect({ scope, collection: 'images', chapter: result.value.chapter });
  };

  const renameCurrent = async () => {
    if (!chapter) return;
    const name = window.prompt('Rename chapter', chapter);
    if (!name?.trim() || name.trim() === chapter) return;
    const result = await renameChapter(scope, chapter, name.trim());
    if (!result.ok) return setError(result.error);
    reload();
    onSelect({ scope, collection: 'images', chapter: result.value.chapter });
  };

  const deleteCurrent = async () => {
    if (!chapter || !window.confirm(`Delete the empty chapter "${chapter}"?`)) return;
    const result = await deleteChapter(scope, chapter);
    if (!result.ok) {
      return setError(
        result.error === 'chapter is not empty' ? 'Move or delete its images first.' : result.error,
      );
    }
    reload();
    onSelect({ scope, collection: 'images' });
  };

  const crumbs = [
    scopeLabel,
    selection.collection === 'images' ? KIND_LABEL.image : KIND_LABEL.reference,
    ...(selection.collection === 'images' && selection.chapter !== undefined
      ? [selection.chapter ?? UNSORTED_LABEL]
      : []),
  ];

  return (
    <section className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate font-medium text-base">{crumbs.join(' / ')}</h2>
        {selection.collection === 'images' && (
          <PaneButton onClick={newChapter} icon={<FolderPlus className="size-3.5" />}>
            New chapter
          </PaneButton>
        )}
        {chapter && (
          <>
            <PaneButton onClick={renameCurrent} icon={<PencilLine className="size-3.5" />}>
              Rename
            </PaneButton>
            <PaneButton onClick={deleteCurrent} icon={<Trash2 className="size-3.5" />}>
              Delete
            </PaneButton>
          </>
        )}
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target is an enhancement — the "Choose files" button is the keyboard path */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'mt-4 flex items-center justify-between gap-4 rounded-lg border border-dashed px-5 py-4 transition-colors',
          dragging ? 'border-primary bg-accent' : 'border-border',
        )}
      >
        <div className="text-sm">
          <p className="font-medium">Drop files to upload</p>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Images go to{' '}
            {selection.collection === 'images' && chapter ? `“${chapter}”` : UNSORTED_LABEL}; other
            files go to {KIND_LABEL.reference}. Up to 25 MB each.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex flex-none items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {(error ?? listError) && (
        <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          {error ?? listError}
        </p>
      )}

      {list === null ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : selection.collection === 'references' ? (
        <References
          list={list}
          scope={scope}
          onChanged={reload}
          onError={setError}
          onPreview={setPreview}
        />
      ) : (
        <Images
          list={list}
          scope={scope}
          chapter={selection.chapter}
          onChanged={reload}
          onError={setError}
          onPreview={setPreview}
        />
      )}

      {preview && <AssetPreview asset={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}

function PaneButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm transition-colors hover:bg-accent"
    >
      {icon}
      {children}
    </button>
  );
}

type ListProps = {
  list: AssetList;
  scope: string;
  onChanged: () => void;
  onError: (message: string) => void;
  onPreview: (asset: Asset) => void;
};

function Images({ list, chapter, ...props }: ListProps & { chapter: string | null | undefined }) {
  const images = list.assets.filter((a) => a.kind === 'image');
  const groups =
    chapter === undefined
      ? [...list.chapters.map((c) => ({ chapter: c as string | null })), { chapter: null }]
      : [{ chapter }];

  const shown = groups
    .map((group) => ({ ...group, items: images.filter((a) => a.chapter === group.chapter) }))
    .filter((group) => chapter !== undefined || group.items.length > 0);

  if (shown.every((group) => group.items.length === 0)) {
    return <p className="py-16 text-center text-muted-foreground text-sm">No images here yet.</p>;
  }

  return (
    <div className="mt-6 space-y-8">
      {shown.map((group) => (
        <div key={group.chapter ?? ''}>
          {chapter === undefined && (
            <h3 className="mb-3 font-medium text-muted-foreground text-sm">
              {group.chapter ?? UNSORTED_LABEL}
            </h3>
          )}
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
            {group.items.map((asset) => (
              <ImageCard key={asset.path} asset={asset} chapters={list.chapters} {...props} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function References({ list, ...props }: ListProps) {
  const references = list.assets.filter((a) => a.kind === 'reference');
  if (references.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground text-sm">
        No {KIND_LABEL.reference} yet — papers, data, and notes the document draws on go here.
      </p>
    );
  }
  return (
    <div className="mt-6 divide-y divide-border rounded-lg border border-border">
      {references.map((asset) => (
        <ReferenceRow key={asset.path} asset={asset} {...props} />
      ))}
    </div>
  );
}
