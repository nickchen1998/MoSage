import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode,
  Folder,
  Loader2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type CodeFile, type FileState, getCodeFile, getCodeTree } from '../../lib/code-api';
import { type CodeHost, HOST_LABEL } from '../../lib/code-remote';
import { useLive } from '../../lib/settings-api';
import { cn } from '../../lib/utils';
import { ConnectForm, PushForm, RepoSummary, StatusChip } from './code-repo';

type Dir = {
  name: string;
  path: string;
  dirs: Dir[];
  files: Array<{ name: string; path: string; state: FileState }>;
};

function buildTree(files: Array<{ path: string; state: FileState }>): Dir {
  const root: Dir = { name: '', path: '', dirs: [], files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.find((d) => d.name === part);
      if (!next) {
        next = { name: part, path: dir.path ? `${dir.path}/${part}` : part, dirs: [], files: [] };
        dir.dirs.push(next);
      }
      dir = next;
    }
    dir.files.push({ name: parts[parts.length - 1], path: file.path, state: file.state });
  }
  const sort = (dir: Dir) => {
    dir.dirs.sort((a, b) => a.name.localeCompare(b.name));
    dir.files.sort((a, b) => a.name.localeCompare(b.name));
    dir.dirs.forEach(sort);
  };
  sort(root);
  return root;
}

function countChanged(dir: Dir): number {
  return (
    dir.files.filter((f) => f.state !== 'pushed').length +
    dir.dirs.reduce((sum, d) => sum + countChanged(d), 0)
  );
}

function DirRows({
  dir,
  depth,
  collapsed,
  onToggle,
  onOpen,
}: {
  dir: Dir;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <>
      {dir.dirs.map((sub) => {
        const open = !collapsed.has(sub.path);
        const changed = countChanged(sub);
        return (
          <li key={sub.path}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(sub.path)}
              className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors hover:bg-accent/60"
              style={{ paddingLeft: 4 + depth * 16 }}
            >
              {open ? (
                <ChevronDown className="size-3.5 flex-none text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="size-3.5 flex-none text-muted-foreground" aria-hidden />
              )}
              <Folder className="size-3.5 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{sub.name}</span>
              {changed > 0 && (
                <span className="text-changed text-xs tabular-nums">{changed} changed</span>
              )}
            </button>
            {open && (
              <ul>
                <DirRows
                  dir={sub}
                  depth={depth + 1}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              </ul>
            )}
          </li>
        );
      })}
      {dir.files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => onOpen(file.path)}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors hover:bg-accent/60',
              file.state === 'deleted' && 'text-muted-foreground line-through',
            )}
            style={{ paddingLeft: 4 + depth * 16 + 20 }}
          >
            <FileCode className="size-3.5 flex-none text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem]">{file.name}</span>
            {file.state !== 'pushed' && <StatusChip kind={file.state} />}
          </button>
        </li>
      ))}
    </>
  );
}

function FilePreview({
  path,
  host,
  onClose,
}: {
  path: string;
  host: CodeHost | null;
  onClose: () => void;
}) {
  const [file, setFile] = useState<CodeFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCodeFile(path).then((result) => {
      if (cancelled) return;
      if (result.ok) setFile(result.value);
      else setError(result.error);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [path, onClose]);

  const lines = useMemo(() => file?.text.replace(/\r?\n$/, '').split(/\r?\n/) ?? [], [file]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-10">
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-label={path}
        className="relative flex h-full max-h-[56rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <header className="flex flex-none items-center gap-3 border-border border-b px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate font-medium font-mono text-sm">{path}</p>
          {file?.deleted && <StatusChip kind="deleted" />}
          {file?.href && host && (
            <a
              href={file.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Open on {HOST_LABEL[host]}
            </a>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <p className="p-4 text-muted-foreground text-sm">{error}</p>
          ) : !file ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full border-collapse font-mono text-xs leading-relaxed">
              <tbody>
                {lines.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a line's number is its identity
                  <tr key={i}>
                    <td className="w-px select-none whitespace-nowrap px-3 text-right align-top text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="whitespace-pre-wrap break-all pr-4">{line || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {file?.truncated && (
            <p className="px-4 py-2 text-muted-foreground text-xs">The file is cut off here.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Assets → 程式碼: the `code/` repository as its readers will see it once you push. */
export function CodePane() {
  const { data, error } = useLive(getCodeTree);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const tree = useMemo(() => (data ? buildTree(data.files) : null), [data]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (!data) {
    return (
      <section className="grid min-w-0 flex-1 place-items-center">
        {error ? (
          <p className="text-muted-foreground text-sm">{error}</p>
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </section>
    );
  }

  const { status, files } = data;
  return (
    <section className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
      <h2 className="font-medium text-base">
        程式碼 <span className="font-mono font-normal text-muted-foreground text-sm">code/</span>
      </h2>

      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="w-full max-w-sm">
          {status.remote ? <RepoSummary status={status} /> : <ConnectForm status={status} />}
        </div>
        {status.remote && (
          <div className="w-full max-w-sm">
            <PushForm status={status} defaultMessage="Update code excerpts" />
          </div>
        )}
      </div>

      <div className="mt-6 border-border border-t pt-4">
        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {status.exists ? (
              <>
                <span className="font-mono">code/</span> is empty.
              </>
            ) : (
              <>
                No <span className="font-mono">code/</span> folder yet.
              </>
            )}{' '}
            Put the files a document shows in <span className="font-mono">code/</span>, then import
            them with <span className="font-mono">?code</span>.
          </p>
        ) : (
          tree && (
            <ul aria-label="Files in code/" className="max-w-3xl">
              <DirRows
                dir={tree}
                depth={0}
                collapsed={collapsed}
                onToggle={toggle}
                onOpen={setOpen}
              />
            </ul>
          )
        )}
      </div>

      {open && <FilePreview path={open} host={status.remote?.host ?? null} onClose={close} />}
    </section>
  );
}
