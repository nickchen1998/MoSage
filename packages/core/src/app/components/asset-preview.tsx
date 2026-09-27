import { Download, ExternalLink, FileIcon, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Asset, formatBytes, previewKind } from '../lib/assets';
import { useT } from '../lib/i18n';

const TEXT_LIMIT = 200_000;
const TABLE_ROWS = 200;

/** Splits delimited text into rows, honouring quoted fields. Enough for a preview. */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < TABLE_ROWS; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

function TextBody({ asset, table }: { asset: Asset; table: boolean }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(asset.url)
      .then((res) => res.text())
      .then((body) => {
        if (!cancelled) setText(body.slice(0, TEXT_LIMIT));
      })
      .catch(() => {
        if (!cancelled) setText('');
      });
    return () => {
      cancelled = true;
    };
  }, [asset.url]);

  if (text === null) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!table) {
    return (
      <pre className="h-full overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    );
  }
  const [head = [], ...rows] = parseRows(
    text,
    asset.name.toLowerCase().endsWith('.tsv') ? '\t' : ',',
  );
  return (
    <div className="h-full overflow-auto p-4">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {head.map((cell, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns have no identity beyond position
              <th key={i} className="border-border border-b px-2 py-1 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond position
            <tr key={r}>
              {row.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond position
                <td key={c} className="border-border border-b px-2 py-1 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length + 1 >= TABLE_ROWS && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t('Showing the first {count} rows.', { count: TABLE_ROWS })}
        </p>
      )}
    </div>
  );
}

function PreviewBody({ asset }: { asset: Asset }) {
  const t = useT();
  switch (previewKind(asset)) {
    case 'image':
      return (
        <div className="grid h-full place-items-center overflow-auto bg-muted p-6">
          <img src={asset.url} alt={asset.name} className="max-h-full max-w-full object-contain" />
        </div>
      );
    case 'pdf':
      return <iframe title={asset.name} src={asset.url} className="h-full w-full bg-white" />;
    case 'table':
      return <TextBody asset={asset} table />;
    case 'text':
      return <TextBody asset={asset} table={false} />;
    case 'audio':
      return (
        <div className="grid h-full place-items-center">
          {/* biome-ignore lint/a11y/useMediaCaption: a reference file the author uploaded; there is no caption track to offer */}
          <audio controls src={asset.url} />
        </div>
      );
    case 'video':
      return (
        <div className="grid h-full place-items-center bg-black">
          {/* biome-ignore lint/a11y/useMediaCaption: a reference file the author uploaded; there is no caption track to offer */}
          <video controls src={asset.url} className="max-h-full max-w-full" />
        </div>
      );
    default:
      return (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <FileIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm">{t('No preview for this file type.')}</p>
            <a
              href={asset.url}
              download={asset.name}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Download className="size-3.5" />
              {t('Download')}
            </a>
          </div>
        </div>
      );
  }
}

/** A file from the assets, opened over the page. Escape or the backdrop closes it. */
export function AssetPreview({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
      <button
        type="button"
        aria-label={t('Close preview')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-label={asset.name}
        className="relative flex h-full max-h-[56rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <header className="flex flex-none items-center gap-3 border-border border-b px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{asset.name}</p>
            <p className="truncate text-muted-foreground text-xs">
              {formatBytes(asset.size)} · <code className="font-mono">{asset.path}</code>
            </p>
          </div>
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            {t('Open')}
          </a>
          <button
            type="button"
            aria-label={t('Close')}
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1">
          <PreviewBody asset={asset} />
        </div>
      </div>
    </div>
  );
}
