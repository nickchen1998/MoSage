import { Check, Copy, FileIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Asset,
  deleteAsset,
  formatBytes,
  GLOBAL_SCOPE,
  importSnippet,
  isPreviewable,
  listAssets,
  renameAsset,
  uploadAsset,
} from '../lib/assets';
import { docIds } from '../lib/docs';
import { cn } from '../lib/utils';

export function AssetsPage() {
  const scopes = useMemo(() => [GLOBAL_SCOPE, ...[...docIds].sort()], []);
  const [scope, setScope] = useState<string>(GLOBAL_SCOPE);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (target: string) => {
    const result = await listAssets(target);
    if (result.ok) {
      setAssets(result.value);
      setError(null);
    } else {
      setAssets([]);
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    setAssets(null);
    void refresh(scope);
  }, [scope, refresh]);

  const upload = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true);
      setError(null);
      for (const file of Array.from(files)) {
        let result = await uploadAsset(scope, file);
        if (!result.ok && result.error === 'asset exists') {
          const replace = window.confirm(`"${file.name}" already exists in ${scope}. Replace it?`);
          if (!replace) continue;
          result = await uploadAsset(scope, file, { overwrite: true });
        }
        if (!result.ok) setError(`${file.name}: ${result.error}`);
      }
      await refresh(scope);
      setBusy(false);
    },
    [scope, refresh],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files);
  };

  return (
    <div>
      <header className="border-border border-b px-8 py-6">
        <h1 className="font-medium text-lg tracking-tight">Assets</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Images and fonts documents can import. Global files live in{' '}
          <code className="font-mono">assets/</code>; per-document files in{' '}
          <code className="font-mono">docs/&lt;id&gt;/assets/</code>.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-8 pt-6">
        {scopes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              s === scope
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {s === GLOBAL_SCOPE ? 'Global' : s}
          </button>
        ))}
      </div>

      <div className="px-8 py-6">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target is an enhancement — the "Choose files" button is the keyboard path */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex items-center justify-between gap-4 rounded-lg border border-dashed px-5 py-4 transition-colors',
            dragging ? 'border-primary bg-accent' : 'border-border',
          )}
        >
          <div className="text-sm">
            <p className="font-medium">Drop files to upload</p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              Up to 25 MB each · png, jpg, svg, webp, pdf, woff2, csv…
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex flex-none items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
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

        {error && (
          <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs">{error}</p>
        )}

        {assets === null ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground text-sm">
            No assets in {scope === GLOBAL_SCOPE ? 'the global folder' : scope} yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {assets.map((asset) => (
              <AssetCard
                key={asset.name}
                asset={asset}
                scope={scope}
                onChanged={() => refresh(scope)}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  scope,
  onChanged,
  onError,
}: {
  asset: Asset;
  scope: string;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyImport = async () => {
    try {
      await navigator.clipboard.writeText(importSnippet(asset));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      onError(String((err as Error).message));
    }
  };

  const rename = async () => {
    const next = window.prompt('New file name', asset.name);
    if (!next || next === asset.name) return;
    const result = await renameAsset(scope, asset.name, next);
    if (!result.ok) onError(`${asset.name}: ${result.error}`);
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${asset.name}"? This removes the file from disk.`)) return;
    const result = await deleteAsset(scope, asset.name);
    if (!result.ok) onError(`${asset.name}: ${result.error}`);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative grid h-32 place-items-center overflow-hidden rounded-md border border-border bg-muted">
        {isPreviewable(asset.mime) ? (
          <img
            src={asset.url}
            alt={asset.name}
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <FileIcon className="size-6 text-muted-foreground" />
        )}
        {asset.unused && (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            unused
          </span>
        )}
      </div>

      <div className="min-w-0">
        <button
          type="button"
          onClick={rename}
          title="Rename"
          className="block w-full truncate text-left text-xs hover:underline"
        >
          {asset.name}
        </button>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatBytes(asset.size)}</p>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={copyImport}
          title={importSnippet(asset)}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Import'}
        </button>
        <button
          type="button"
          onClick={remove}
          aria-label={`Delete ${asset.name}`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
