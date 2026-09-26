import { Check, ChevronDown, ChevronRight, Copy, Eye, Loader2, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  type Asset,
  type AssetList,
  chapterFromHeading,
  deleteAsset,
  formatBytes,
  GLOBAL_SCOPE,
  importSnippet,
  KIND_LABEL,
  moveImage,
  uploadAsset,
  useAssets,
} from '../lib/assets';
import type { OutlineEntry } from '../lib/outline';
import { cn } from '../lib/utils';
import { AssetPreview } from './asset-preview';
import { ReferenceRow, UNSORTED_LABEL } from './assets/asset-items';
import { DocImagePrompts } from './doc-image-prompts';

type Picked = { scope: string; asset: Asset };

/** The chapters a document has: its top-level headings, then any other folder already on disk. */
function chaptersOf(entries: OutlineEntry[], existing: string[]): string[] {
  const top = entries.length ? Math.min(...entries.map((e) => e.level)) : 1;
  const fromOutline = entries
    .filter((e) => e.level === top)
    .map((e) => chapterFromHeading(e.text))
    .filter((name): name is string => name !== null);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...fromOutline, ...existing]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Everything this document can draw on, without leaving it: its images by
 * chapter, its references, and the project's shared files. Picking an image
 * gives the import line to paste into the source.
 */
export function DocAssets({ docId, entries }: { docId: string; entries: OutlineEntry[] }) {
  const own = useAssets(docId);
  const shared = useAssets(GLOBAL_SCOPE);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    own.reload();
    shared.reload();
  };

  if (own.list === null || shared.list === null) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const chapters = chaptersOf(entries, own.list.chapters);
  const current =
    picked && [...own.list.assets, ...shared.list.assets].find((a) => a.url === picked.asset.url);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <DocImagePrompts docId={docId} />

        <ScopeImages
          scope={docId}
          list={own.list}
          chapters={chapters}
          picked={current?.url ?? null}
          onPick={(asset) => setPicked({ scope: docId, asset })}
          onChanged={reload}
          onError={setError}
        />
        <ScopeReferences
          scope={docId}
          list={own.list}
          onPreview={setPreview}
          onChanged={reload}
          onError={setError}
        />

        <Collapsible title="Project (shared)" defaultOpen={false}>
          <ScopeImages
            scope={GLOBAL_SCOPE}
            list={shared.list}
            chapters={shared.list.chapters}
            picked={current?.url ?? null}
            onPick={(asset) => setPicked({ scope: GLOBAL_SCOPE, asset })}
            onChanged={reload}
            onError={setError}
            compactHeading
          />
          <ScopeReferences
            scope={GLOBAL_SCOPE}
            list={shared.list}
            onPreview={setPreview}
            onChanged={reload}
            onError={setError}
            compactHeading
          />
        </Collapsible>

        {error && <p className="mt-2 text-muted-foreground text-xs">{error}</p>}
      </div>

      {picked && current && (
        <PickedImage
          scope={picked.scope}
          asset={current}
          chapters={picked.scope === docId ? chapters : shared.list.chapters}
          onPreview={() => setPreview(current)}
          onChanged={reload}
          onError={setError}
          onClose={() => setPicked(null)}
        />
      )}
      {preview && <AssetPreview asset={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Collapsible({
  title,
  count,
  defaultOpen = true,
  action,
  nested = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: ReactNode;
  /** A chapter inside a section, rather than a section of its own. */
  nested?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={nested ? 'mt-0.5 pl-2' : 'mt-3'}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-xs hover:text-foreground',
            nested ? 'text-foreground/80' : 'text-muted-foreground uppercase tracking-wider',
          )}
        >
          {open ? (
            <ChevronDown className="size-3 flex-none" />
          ) : (
            <ChevronRight className="size-3 flex-none" />
          )}
          <span className="truncate">{title}</span>
          {count !== undefined && <span className="ml-auto font-mono tabular-nums">{count}</span>}
        </button>
        {action}
      </div>
      {open && <div className="mt-1">{children}</div>}
    </section>
  );
}

function UploadButton({ label, onFiles }: { label: string; onFiles: (files: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => ref.current?.click()}
        className="flex size-6 flex-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-3.5" />
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

async function uploadAll(
  scope: string,
  files: FileList,
  chapter: string | null,
  onError: (message: string) => void,
) {
  for (const file of Array.from(files)) {
    let result = await uploadAsset(scope, file, { chapter });
    if (!result.ok && result.error === 'asset exists') {
      if (!window.confirm(`"${file.name}" already exists. Replace it?`)) continue;
      result = await uploadAsset(scope, file, { chapter, overwrite: true });
    }
    if (!result.ok) onError(`${file.name}: ${result.error}`);
  }
}

function ScopeImages({
  scope,
  list,
  chapters,
  picked,
  onPick,
  onChanged,
  onError,
  compactHeading = false,
}: {
  scope: string;
  list: AssetList;
  chapters: string[];
  picked: string | null;
  onPick: (asset: Asset) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  compactHeading?: boolean;
}) {
  const images = list.assets.filter((a) => a.kind === 'image');
  const groups = useMemo(() => [...chapters.map((c) => c as string | null), null], [chapters]);

  return (
    <Collapsible title={KIND_LABEL.image} count={images.length} defaultOpen={!compactHeading}>
      {groups.map((chapter) => {
        const items = images.filter((a) => a.chapter === chapter);
        if (chapter === null && items.length === 0 && groups.length > 1) return null;
        return (
          <Collapsible
            key={chapter ?? ''}
            nested
            title={chapter ?? UNSORTED_LABEL}
            count={items.length}
            defaultOpen={items.length > 0}
            action={
              <UploadButton
                label={`Upload images to ${chapter ?? UNSORTED_LABEL}`}
                onFiles={(files) => void uploadAll(scope, files, chapter, onError).then(onChanged)}
              />
            }
          >
            {items.length === 0 ? (
              <p className="px-1 pb-1 text-muted-foreground text-xs">No images yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((asset) => (
                  <button
                    key={asset.path}
                    type="button"
                    title={asset.name}
                    onClick={() => onPick(asset)}
                    className={cn(
                      'grid h-16 place-items-center overflow-hidden rounded border bg-muted p-1 transition-colors',
                      picked === asset.url
                        ? 'border-foreground'
                        : 'border-border hover:border-foreground/40',
                    )}
                  >
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </Collapsible>
        );
      })}
    </Collapsible>
  );
}

function ScopeReferences({
  scope,
  list,
  onPreview,
  onChanged,
  onError,
  compactHeading = false,
}: {
  scope: string;
  list: AssetList;
  onPreview: (asset: Asset) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  compactHeading?: boolean;
}) {
  const references = list.assets.filter((a) => a.kind === 'reference');
  return (
    <Collapsible
      title={KIND_LABEL.reference}
      count={references.length}
      defaultOpen={!compactHeading}
      action={
        <UploadButton
          label={`Upload to ${KIND_LABEL.reference}`}
          onFiles={(files) => void uploadAll(scope, files, null, onError).then(onChanged)}
        />
      }
    >
      {references.length === 0 ? (
        <p className="px-1 pb-1 text-muted-foreground text-xs">No files yet.</p>
      ) : (
        references.map((asset) => (
          <ReferenceRow
            key={asset.path}
            asset={asset}
            scope={scope}
            compact
            onPreview={onPreview}
            onChanged={onChanged}
            onError={onError}
          />
        ))
      )}
    </Collapsible>
  );
}

function PickedImage({
  scope,
  asset,
  chapters,
  onPreview,
  onChanged,
  onError,
  onClose,
}: {
  scope: string;
  asset: Asset;
  chapters: string[];
  onPreview: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(importSnippet(asset));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const move = async (value: string) => {
    const result = await moveImage(scope, asset, value === '' ? null : value);
    if (!result.ok) onError(result.error);
    onChanged();
  };

  const remove = async () => {
    const warning = asset.unused ? '' : ' A document still uses it.';
    if (!window.confirm(`Delete "${asset.name}"?${warning}`)) return;
    const result = await deleteAsset(scope, asset.path);
    if (!result.ok) onError(result.error);
    onClose();
    onChanged();
  };

  return (
    <div className="flex-none border-border border-t bg-background p-2">
      <p className="truncate font-medium text-xs">{asset.name}</p>
      <p className="mt-0.5 text-[0.625rem] text-muted-foreground">
        {formatBytes(asset.size)}
        {asset.unused ? ' · unused' : ''}
      </p>
      <code className="mt-1.5 block truncate rounded bg-muted px-1.5 py-1 font-mono text-[0.625rem]">
        {asset.importPath}
      </code>
      <select
        aria-label={`Chapter of ${asset.name}`}
        value={asset.chapter ?? ''}
        onChange={(e) => void move(e.target.value)}
        className="mt-1.5 w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
      >
        <option value="">{UNSORTED_LABEL}</option>
        {chapters.map((chapter) => (
          <option key={chapter} value={chapter}>
            {chapter}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Copy import'}
        </button>
        <button
          type="button"
          aria-label="Preview"
          onClick={onPreview}
          className="flex size-7 items-center justify-center rounded border border-border hover:bg-accent"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${asset.name}`}
          onClick={() => void remove()}
          className="flex size-7 items-center justify-center rounded border border-border hover:bg-accent"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
