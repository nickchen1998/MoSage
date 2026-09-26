import fs from 'node:fs/promises';
import path from 'node:path';
import { type CodeHost, fileLink, parseRemote, type RemoteInfo } from '../app/lib/code-remote.ts';
import {
  codeDir,
  connectRepo,
  GitError,
  ignoreCodeDir,
  pushRepo,
  type RepoState,
  readFileAt,
  readRepoState,
  readTree,
  resolveCodePath,
  type TreeFile,
} from '../code/repo.ts';
import { readSettings, writeSettings } from '../files/settings.ts';
import type { ApiContext } from '../vite/routes/context.ts';
import { OpsError } from './documents.ts';

/** `code/` as the code panel and `mosage code` show it. */
export type CodeStatus = Omit<RepoState, 'remote'> & {
  remote: RemoteInfo | null;
  /** An origin is set, but it is neither GitHub nor GitLab. */
  unsupportedRemote: boolean;
  /** The address saved with the project — what `mosage code connect` restores. */
  savedRemote: string | null;
  host: CodeHost | null;
};

const TEXT_LIMIT = 400_000;

function asOps(err: unknown): never {
  if (err instanceof OpsError) throw err;
  if (err instanceof GitError) throw new OpsError(422, err.message);
  throw err;
}

export async function codeStatus(ctx: ApiContext): Promise<CodeStatus> {
  const settings = await readSettings(ctx.userCwd);
  const state = await readRepoState(ctx.userCwd, settings.code.host).catch(asOps);
  return {
    ...state,
    unsupportedRemote: state.remoteUrl !== null && state.remote === null,
    savedRemote: settings.code.remote,
    host: settings.code.host,
  };
}

export async function codeTree(
  ctx: ApiContext,
): Promise<{ status: CodeStatus; files: TreeFile[] }> {
  const status = await codeStatus(ctx);
  return { status, files: await readTree(ctx.userCwd, status).catch(asOps) };
}

export type CodeFile = {
  path: string;
  text: string;
  truncated: boolean;
  /** Only in the pushed commit — deleted from `code/` since. */
  deleted: boolean;
  /** The file on GitHub or GitLab, at the pushed commit, when origin has it. */
  href: string | null;
};

export async function readCodeFile(ctx: ApiContext, file: string): Promise<CodeFile> {
  const abs = resolveCodePath(ctx.userCwd, file);
  if (!abs) throw new OpsError(400, `not a path inside code/: ${file}`);
  const status = await codeStatus(ctx);
  const rel = file.split('\\').join('/');

  let text: string | null = null;
  let deleted = false;
  try {
    // A symlink inside code/ must not lead the preview out of it.
    const real = await fs.realpath(abs);
    const root = await fs.realpath(codeDir(ctx.userCwd));
    if (!real.startsWith(root + path.sep))
      throw new OpsError(400, `not a file inside code/: ${file}`);
    text = await fs.readFile(real, 'utf8');
  } catch (err) {
    if (err instanceof OpsError) throw err;
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    if (status.pushedSha) text = await readFileAt(ctx.userCwd, status.pushedSha, rel);
    deleted = text !== null;
  }
  if (text === null) throw new OpsError(404, `no such file in code/: ${file}`);

  const change = status.changes.find((c) => c.path === rel);
  const onOrigin = status.remote && status.pushedSha && change?.state !== 'added';
  return {
    path: rel,
    text: text.slice(0, TEXT_LIMIT),
    truncated: text.length > TEXT_LIMIT,
    deleted,
    href:
      onOrigin && status.remote && status.pushedSha
        ? fileLink(status.remote, status.pushedSha, rel)
        : null,
  };
}

/**
 * Connects `code/` to a GitHub or GitLab repository — cloning it into an empty
 * folder, or making the files already there a repository whose origin it is —
 * and saves the address with the project. With no address, restores the saved one.
 */
export async function connectCode(
  ctx: ApiContext,
  opts: { url?: string; host?: CodeHost | null } = {},
): Promise<CodeStatus> {
  const settings = await readSettings(ctx.userCwd);
  const url = opts.url?.trim() || settings.code.remote;
  if (!url)
    throw new OpsError(400, 'give the repository address, e.g. https://github.com/you/repo');
  const host = opts.host === undefined ? settings.code.host : opts.host;
  if (!parseRemote(url, host)) {
    throw new OpsError(
      400,
      `not a GitHub or GitLab repository address: ${url}` +
        (host
          ? ''
          : ' — for a self-hosted server on another domain, say which it runs (host: github or gitlab)'),
    );
  }

  await connectRepo(ctx.userCwd, url).catch(asOps);
  await ignoreCodeDir(ctx.userCwd);
  await writeSettings(ctx.userCwd, { ...settings, code: { remote: url, host: host ?? null } });
  return await codeStatus(ctx);
}

export type CodePushResult = { sha: string; committed: boolean; status: CodeStatus };

/** Commits everything in `code/` and pushes it, with git's own sign-in. */
export async function pushCode(ctx: ApiContext, message: string): Promise<CodePushResult> {
  const result = await pushRepo(ctx.userCwd, message).catch(asOps);
  return { ...result, status: await codeStatus(ctx) };
}
