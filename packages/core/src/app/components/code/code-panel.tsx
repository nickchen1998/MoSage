import { Loader2, X } from 'lucide-react';
import { getCodeStatus } from '../../lib/code-api';
import { type LabelEntry, useLabelVocabulary } from '../../lib/labels';
import { useLive } from '../../lib/settings-api';
import { cn } from '../../lib/utils';
import { codeDetail } from '../code-excerpt';
import { ConnectForm, hostName, PushForm, RepoSummary, StatusChip } from './code-repo';

/** Excerpts whose printed link would open something else, or nothing. */
export function unpushedEntries(entries: LabelEntry[]): LabelEntry[] {
  return entries.filter((entry) => {
    const status = codeDetail(entry)?.status;
    return status === 'changed' || status === 'new';
  });
}

/**
 * The document's code excerpts and the repository they link to, docked beside
 * the pages like the Design panel. Pushing here is what makes a changed
 * excerpt's link open what the page prints.
 */
export function CodePanel({
  entries,
  docTitle,
  selectedId,
  onSelect,
  onClose,
}: {
  entries: LabelEntry[];
  docTitle: string;
  selectedId: string | null;
  onSelect: (entry: LabelEntry) => void;
  onClose: () => void;
}) {
  const { data: status } = useLive(getCodeStatus);
  const vocabulary = useLabelVocabulary();

  return (
    <aside
      aria-label="Code"
      className="flex w-80 flex-none flex-col border-border border-l bg-background"
    >
      <header className="flex h-10 flex-none items-center justify-between border-border border-b px-3">
        <span className="flex items-baseline gap-2">
          <span className="font-medium text-xs uppercase tracking-wider">程式碼</span>
          <span className="text-[0.6875rem] text-muted-foreground">
            {entries.length} excerpt{entries.length === 1 ? '' : 's'}
          </span>
        </span>
        <button
          type="button"
          aria-label="Close code panel"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!status ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="border-border border-b px-3 py-3">
              {status.remote ? <RepoSummary status={status} /> : <ConnectForm status={status} />}
            </div>

            <div className="px-1.5 py-3">
              <p className="px-1.5 pb-1.5 text-[0.6875rem] text-muted-foreground uppercase tracking-wide">
                In this document
              </p>
              {entries.length === 0 && (
                <p className="px-1.5 text-muted-foreground text-xs leading-relaxed">
                  No excerpts yet. Import a file from <span className="font-mono">code/</span> with{' '}
                  <span className="font-mono">?code</span> and pass it to{' '}
                  <span className="font-mono">{'<CodeExcerpt>'}</span>.
                </p>
              )}
              {entries.map((entry) => {
                const detail = codeDetail(entry);
                if (!detail) return null;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-current={entry.id === selectedId}
                    onClick={() => onSelect(entry)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-accent/60',
                      entry.id === selectedId && 'bg-accent hover:bg-accent',
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="flex-none font-medium text-xs">
                        {vocabulary.code} {entry.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">
                        {detail.path}
                      </span>
                      <StatusChip kind={detail.status} />
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Lines {detail.lines} · page {entry.page}
                    </span>
                    {detail.status === 'changed' && (
                      <span className="text-changed text-xs leading-relaxed">
                        These lines differ from the pushed commit — the printed link opens the old
                        version until you push.
                      </span>
                    )}
                    {detail.status === 'new' && (
                      <span className="text-unpushed text-xs leading-relaxed">
                        Not on {hostName(status)} yet — it prints without a link.
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {status?.remote && (
        <div className="flex-none border-border border-t px-3 py-3">
          <PushForm status={status} defaultMessage={`Update code for “${docTitle}”`} />
        </div>
      )}
    </aside>
  );
}
