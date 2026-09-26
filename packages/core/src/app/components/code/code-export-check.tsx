import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { pushCode } from '../../lib/code-api';
import { HOST_LABEL, isCodeHost } from '../../lib/code-remote';
import { type LabelEntry, useLabelVocabulary } from '../../lib/labels';
import { codeDetail } from '../code-excerpt';
import { StatusChip } from './code-repo';

/**
 * Asked before a download when some excerpt's printed link would open another
 * version, or nothing. Exporting anyway stays one click away: the document is
 * the user's, and a draft for review may not need working links.
 */
export function CodeExportCheck({
  entries,
  format,
  docTitle,
  onExportAnyway,
  onPushed,
  onCancel,
}: {
  entries: LabelEntry[];
  format: string;
  docTitle: string;
  onExportAnyway: () => void;
  onPushed: () => void;
  onCancel: () => void;
}) {
  const vocabulary = useLabelVocabulary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hostKey = entries.map((e) => codeDetail(e)?.host).find(isCodeHost);
  const host = hostKey ? HOST_LABEL[hostKey] : 'GitHub';

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onCancel]);

  const push = async () => {
    setBusy(true);
    setError(null);
    const result = await pushCode(`Update code for “${docTitle}”`);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onPushed();
  };

  const count = entries.length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel download"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-export-check-title"
        className="relative flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex gap-3">
          <span className="grid size-8 flex-none place-items-center rounded-full bg-changed-muted text-changed">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 id="code-export-check-title" className="font-semibold text-sm">
              {count} code excerpt{count === 1 ? " isn't" : "s aren't"} on {host} yet
            </h2>
            <p className="text-muted-foreground text-[0.8125rem] leading-relaxed">
              The {format.toUpperCase()} links every excerpt to its version on {host}. Anyone
              following {count === 1 ? 'this one' : 'these'} will see an older version, or nothing.
            </p>
          </div>
        </div>

        <ul className="overflow-hidden rounded-lg border border-border">
          {entries.map((entry) => {
            const detail = codeDetail(entry);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2.5 border-border border-b px-3 py-2 last:border-b-0"
              >
                <span className="w-14 flex-none font-medium text-xs">
                  {vocabulary.code} {entry.number}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{detail?.path}</span>
                {detail && <StatusChip kind={detail.status} />}
              </li>
            );
          })}
        </ul>

        {error && (
          <p role="alert" className="whitespace-pre-wrap text-changed text-xs">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onExportAnyway}
            disabled={busy}
            className="h-9 rounded-md border border-border px-3.5 text-[0.8125rem] transition-colors hover:bg-accent disabled:opacity-60"
          >
            Export anyway
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={push}
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 font-medium text-[0.8125rem] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Push, then export {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
