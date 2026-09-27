import { Check, ChevronDown, ChevronRight, Copy, Eye, Loader2, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import {
  type Asset,
  type AssetList,
  deleteAsset,
  formatBytes,
  GLOBAL_SCOPE,
  importSnippet,
  KIND_LABEL,
  uploadAsset,
  useAssets,
} from '../lib/assets';
import { type Translate, useT } from '../lib/i18n';
import { cn } from '../lib/utils';
import { AssetPreview } from './asset-preview';
import { ReferenceRow } from './assets/asset-items';
import { DocImagePrompts } from './doc-image-prompts';

type Picked = { scope: string; asset: Asset };

/**
 * Everything this document can draw on, without leaving it: its images, its
 * references, and the project's shared files. Picking an image gives the
 * import line to paste into the source.
 */
export function DocAssets({ docId }: { docId: string }) {
  const t = useT();
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

  const current =
    picked && [...own.list.assets, ...shared.list.assets].find((a) => a.url === picked.asset.url);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <DocImagePrompts docId={docId} />

        <ScopeImages
          scope={docId}
          list={own.list}
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

        <Collapsible title={t('Project (shared)')} defaultOpen={false}>
          <ScopeImages
            scope={GLOBAL_SCOPE}
            list={shared.list}
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
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-left text-muted-foreground text-xs uppercase tracking-wider hover:text-foreground"
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
  onError: (message: string) => void,
  t: Translate,
) {
  for (const file of Array.from(files)) {
    let result = await uploadAsset(scope, file);
    if (!result.ok && result.error === 'asset exists') {
      if (!window.confirm(t('“{name}” already exists. Replace it?', { name: file.name }))) continue;
      result = await uploadAsset(scope, file, { overwrite: true });
    }
    if (!result.ok) onError(`${file.name}: ${result.error}`);
  }
}

function ScopeImages({
  scope,
  list,
  picked,
  onPick,
  onChanged,
  onError,
  compactHeading = false,
}: {
  scope: string;
  list: AssetList;
  picked: string | null;
  onPick: (asset: Asset) => void;
  onChanged: () => void;
  onError: (message: string) => void;
  compactHeading?: boolean;
}) {
  const t = useT();
  const images = list.assets.filter((a) => a.kind === 'image');
  return (
    <Collapsible
      title={t(KIND_LABEL.image)}
      count={images.length}
      defaultOpen={!compactHeading}
      action={
        <UploadButton
          label={t('Upload to {folder}', { folder: t(KIND_LABEL.image) })}
          onFiles={(files) => void uploadAll(scope, files, onError, t).then(onChanged)}
        />
      }
    >
      {images.length === 0 ? (
        <p className="px-1 pb-1 text-muted-foreground text-xs">{t('No images yet.')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((asset) => (
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
  const t = useT();
  const references = list.assets.filter((a) => a.kind === 'reference');
  return (
    <Collapsible
      title={t(KIND_LABEL.reference)}
      count={references.length}
      defaultOpen={!compactHeading}
      action={
        <UploadButton
          label={t('Upload to {folder}', { folder: t(KIND_LABEL.reference) })}
          onFiles={(files) => void uploadAll(scope, files, onError, t).then(onChanged)}
        />
      }
    >
      {references.length === 0 ? (
        <p className="px-1 pb-1 text-muted-foreground text-xs">{t('No files yet.')}</p>
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
  onPreview,
  onChanged,
  onError,
  onClose,
}: {
  scope: string;
  asset: Asset;
  onPreview: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(importSnippet(asset));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const remove = async () => {
    const question = asset.unused
      ? t('Delete “{name}”?', { name: asset.name })
      : t('Delete “{name}”? A document still uses it.', { name: asset.name });
    if (!window.confirm(question)) return;
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
        {asset.unused ? ` · ${t('unused')}` : ''}
      </p>
      <code className="mt-1.5 block truncate rounded bg-muted px-1.5 py-1 font-mono text-[0.625rem]">
        {asset.importPath}
      </code>
      <div className="mt-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? t('Copied') : t('Copy import')}
        </button>
        <button
          type="button"
          aria-label={t('Preview')}
          onClick={onPreview}
          className="flex size-7 items-center justify-center rounded border border-border hover:bg-accent"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t('Delete {name}', { name: asset.name })}
          onClick={() => void remove()}
          className="flex size-7 items-center justify-center rounded border border-border hover:bg-accent"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
