import { Check, Copy, Eye, FileIcon, FileText, PencilLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  type Asset,
  deleteAsset,
  formatBytes,
  importSnippet,
  moveImage,
  renameAsset,
} from '../../lib/assets';
import { cn } from '../../lib/utils';

export const UNSORTED_LABEL = '未分章節';

type Actions = {
  scope: string;
  onChanged: () => void;
  onError: (message: string) => void;
};

function useCopy(onError: (message: string) => void) {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      onError(String((err as Error).message));
    }
  };
  return { copied, copy };
}

async function rename(asset: Asset, { scope, onChanged, onError }: Actions) {
  const next = window.prompt('New file name', asset.name);
  if (!next || next === asset.name) return;
  const result = await renameAsset(scope, asset.path, next);
  if (!result.ok) onError(`${asset.name}: ${result.error}`);
  onChanged();
}

async function remove(asset: Asset, { scope, onChanged, onError }: Actions) {
  const warning = asset.unused ? '' : ' A document still uses it.';
  if (!window.confirm(`Delete "${asset.name}"? This removes the file from disk.${warning}`)) return;
  const result = await deleteAsset(scope, asset.path);
  if (!result.ok) onError(`${asset.name}: ${result.error}`);
  onChanged();
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function ImageCard({
  asset,
  chapters,
  onPreview,
  ...actions
}: Actions & { asset: Asset; chapters: string[]; onPreview: (asset: Asset) => void }) {
  const { copied, copy } = useCopy(actions.onError);

  const move = async (value: string) => {
    const chapter = value === '' ? null : value;
    if (chapter === asset.chapter) return;
    const result = await moveImage(actions.scope, asset, chapter);
    if (!result.ok) actions.onError(`${asset.name}: ${result.error}`);
    actions.onChanged();
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onPreview(asset)}
        aria-label={`Preview ${asset.name}`}
        className="relative grid h-36 place-items-center overflow-hidden rounded-md border border-border bg-muted transition-colors hover:border-foreground/40"
      >
        <img
          src={asset.url}
          alt={asset.name}
          className="max-h-full max-w-full object-contain p-2"
        />
        {asset.unused && (
          <span className="absolute top-1.5 left-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
            unused
          </span>
        )}
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm" title={asset.path}>
          {asset.name}
        </p>
        <p className="text-muted-foreground text-xs">{formatBytes(asset.size)}</p>
      </div>
      <select
        aria-label={`Chapter of ${asset.name}`}
        value={asset.chapter ?? ''}
        onChange={(e) => void move(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
      >
        <option value="">{UNSORTED_LABEL}</option>
        {chapters.map((chapter) => (
          <option key={chapter} value={chapter}>
            {chapter}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void copy(importSnippet(asset))}
          title={importSnippet(asset)}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? 'Copied' : 'Import'}
        </button>
        <IconAction label={`Rename ${asset.name}`} onClick={() => void rename(asset, actions)}>
          <PencilLine className="size-3.5" />
        </IconAction>
        <IconAction label={`Delete ${asset.name}`} onClick={() => void remove(asset, actions)}>
          <Trash2 className="size-3.5" />
        </IconAction>
      </div>
    </div>
  );
}

export function ReferenceRow({
  asset,
  onPreview,
  compact = false,
  ...actions
}: Actions & { asset: Asset; onPreview: (asset: Asset) => void; compact?: boolean }) {
  const Icon =
    asset.mime === 'application/pdf' || asset.mime.startsWith('text/') ? FileText : FileIcon;
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md transition-colors hover:bg-accent/60',
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
      )}
    >
      <Icon className="size-4 flex-none text-muted-foreground" />
      <button
        type="button"
        onClick={() => onPreview(asset)}
        className="min-w-0 flex-1 truncate text-left text-sm"
        title={asset.path}
      >
        {asset.name}
      </button>
      {!compact && (
        <span className="flex-none text-muted-foreground text-xs tabular-nums">
          {formatBytes(asset.size)}
        </span>
      )}
      <div className={cn('flex flex-none items-center', compact && 'hidden group-hover:flex')}>
        <IconAction label={`Preview ${asset.name}`} onClick={() => onPreview(asset)}>
          <Eye className="size-3.5" />
        </IconAction>
        {!compact && (
          <IconAction label={`Rename ${asset.name}`} onClick={() => void rename(asset, actions)}>
            <PencilLine className="size-3.5" />
          </IconAction>
        )}
        <IconAction label={`Delete ${asset.name}`} onClick={() => void remove(asset, actions)}>
          <Trash2 className="size-3.5" />
        </IconAction>
      </div>
    </div>
  );
}
