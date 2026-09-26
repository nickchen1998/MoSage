import { Check, ExternalLink, GitBranch, Loader2, Lock, Minus, Plus, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { type CodeStatus, connectCode, pushCode, timeAgo } from '../../lib/code-api';
import { type CodeHost, HOST_LABEL } from '../../lib/code-remote';
import { cn } from '../../lib/utils';

export type ChipKind = 'pushed' | 'changed' | 'new' | 'local' | 'modified' | 'added' | 'deleted';

const CHIPS: Record<ChipKind, { label: string; tone: 'plain' | 'changed' | 'unpushed' }> = {
  pushed: { label: 'Pushed', tone: 'plain' },
  local: { label: 'No link', tone: 'plain' },
  changed: { label: 'Changed', tone: 'changed' },
  modified: { label: 'Changed', tone: 'changed' },
  deleted: { label: 'Deleted', tone: 'changed' },
  new: { label: 'New', tone: 'unpushed' },
  added: { label: 'New', tone: 'unpushed' },
};

export function StatusChip({ kind }: { kind: ChipKind }) {
  const { label, tone } = CHIPS[kind];
  const Icon =
    kind === 'pushed' ? Check : kind === 'deleted' ? Minus : tone === 'unpushed' ? Plus : null;
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1 rounded-full px-1.5 text-[0.6875rem] leading-4',
        tone === 'plain' && 'text-muted-foreground',
        tone === 'changed' && 'border border-changed/40 bg-changed-muted text-changed',
        tone === 'unpushed' && 'border border-unpushed/40 bg-unpushed-muted text-unpushed',
      )}
    >
      {Icon ? (
        <Icon className="size-3" aria-hidden />
      ) : tone === 'changed' ? (
        <span className="size-1.5 rounded-full bg-changed" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function hostName(status: CodeStatus): string {
  return status.remote ? HOST_LABEL[status.remote.host] : 'GitHub or GitLab';
}

export function RepoSummary({ status }: { status: CodeStatus }) {
  if (!status.remote) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <GitBranch className="size-3.5 flex-none" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium font-mono text-[0.8125rem]">
          {status.remote.slug}
        </span>
        <span className="rounded-full border border-border px-2 text-[0.6875rem] text-muted-foreground">
          {HOST_LABEL[status.remote.host]}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">
        {status.pushedSha ? (
          <>
            {status.branch} · <span className="font-mono">{status.pushedSha.slice(0, 12)}</span>{' '}
            pushed {timeAgo(status.pushedAt)}
          </>
        ) : (
          <>{status.branch ?? 'main'} · never pushed</>
        )}
      </p>
      <a
        href={status.remote.webUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs underline underline-offset-2 hover:text-muted-foreground"
      >
        Open on {HOST_LABEL[status.remote.host]}
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}

const MAX_LISTED = 5;

export function PushForm({
  status,
  defaultMessage,
  onPushed,
}: {
  status: CodeStatus;
  defaultMessage: string;
  onPushed?: () => void;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fieldId = useId();

  if (!status.remote) return null;
  const count = status.changes.length;

  if (count === 0) {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Check className="size-3.5" aria-hidden />
        {done ??
          (status.pushedSha
            ? `Everything in code/ is on ${HOST_LABEL[status.remote.host]}.`
            : 'Nothing in code/ to push yet.')}
      </p>
    );
  }

  const push = async () => {
    setBusy(true);
    setError(null);
    const result = await pushCode(message);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(`Pushed ${result.value.sha.slice(0, 12)}. Links now point at it.`);
    onPushed?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="font-medium text-xs">
        Commit message
      </label>
      <textarea
        id={fieldId}
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-[0.8125rem] outline-none focus:border-foreground/40"
      />
      <ul className="text-muted-foreground text-xs">
        {status.changes.slice(0, MAX_LISTED).map((change) => (
          <li key={change.path} className="flex items-center gap-2 py-0.5">
            <span className="min-w-0 flex-1 truncate font-mono">{change.path}</span>
            <StatusChip kind={change.state} />
          </li>
        ))}
        {count > MAX_LISTED && <li className="py-0.5">and {count - MAX_LISTED} more</li>}
      </ul>
      <button
        type="button"
        onClick={push}
        disabled={busy}
        className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary font-medium text-[0.8125rem] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        Push {count} file{count === 1 ? '' : 's'} to {HOST_LABEL[status.remote.host]}
      </button>
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-changed text-xs">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Pushes with this computer's own git sign-in — MoSage never stores a token. Afterwards every
        link in the documents points at the new commit.
      </p>
    </div>
  );
}

export function ConnectForm({
  status,
  onConnected,
}: {
  status: CodeStatus;
  onConnected?: () => void;
}) {
  const [url, setUrl] = useState(status.remoteUrl ?? '');
  const [host, setHost] = useState<CodeHost | ''>(status.host ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlId = useId();
  const hostId = useId();

  const connect = async (address: string) => {
    setBusy(true);
    setError(null);
    const result = await connectCode(address, host || null);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onConnected?.();
  };

  const restoring = !status.exists && status.savedRemote;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <GitBranch className="size-4" aria-hidden />
        </span>
        <p className="font-medium text-sm">
          {status.unsupportedRemote
            ? 'Origin is not GitHub or GitLab'
            : 'Not connected to GitHub or GitLab'}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {status.unsupportedRemote ? (
            <>
              <span className="font-mono">{status.remoteUrl}</span> can't be linked to. Point code/
              at a GitHub or GitLab repository instead.
            </>
          ) : (
            <>
              Excerpts from <span className="font-mono">code/</span> print without links until it is
              connected to a repository.
            </>
          )}
        </p>
      </div>

      {restoring ? (
        <button
          type="button"
          onClick={() => void connect(status.savedRemote ?? '')}
          disabled={busy}
          className="flex h-8 items-center justify-center gap-2 rounded-md bg-primary font-medium text-[0.8125rem] text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Restore code/ from {status.savedRemote}
        </button>
      ) : (
        <form
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void connect(url);
          }}
        >
          <label htmlFor={urlId} className="text-xs">
            Repository address — create an empty one on GitHub or GitLab first
          </label>
          <input
            id={urlId}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/you/repo"
            spellCheck={false}
            className="h-8 rounded-md border border-border bg-background px-2.5 font-mono text-xs outline-none focus:border-foreground/40"
          />
          <label htmlFor={hostId} className="text-muted-foreground text-xs">
            Self-hosted on another domain? It runs:
          </label>
          <select
            id={hostId}
            value={host}
            onChange={(e) => setHost(e.target.value as CodeHost | '')}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Detect from the address</option>
            <option value="github">GitHub</option>
            <option value="gitlab">GitLab</option>
          </select>
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="flex h-8 items-center justify-center gap-2 rounded-md bg-primary font-medium text-[0.8125rem] text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Connect
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="whitespace-pre-wrap text-changed text-xs">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs leading-relaxed">
        Or ask your agent: “connect code/ to a new GitHub repository”.
      </p>
      <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed">
        <Lock className="mt-0.5 size-3.5 flex-none" aria-hidden />A private repository works too,
        but readers need an account with access to open the links.
      </p>
    </div>
  );
}
