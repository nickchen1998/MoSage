import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type CodeHost, parseRemote, type RemoteInfo } from '../app/lib/code-remote.ts';

/** The project folder whose files documents excerpt. It is its own git repository. */
export const CODE_DIR = 'code';

export function codeDir(userCwd: string): string {
  return path.join(userCwd, CODE_DIR);
}

export class GitError extends Error {}

type GitResult = { code: number | null; stdout: string; stderr: string };

const NETWORK_TIMEOUT_MS = 60_000;
const LOCAL_TIMEOUT_MS = 15_000;

/**
 * Runs git with no terminal to fall back on: a missing credential fails at once
 * with git's own message instead of waiting on a prompt nobody can see. The
 * push uses whatever sign-in git already has — MoSage never holds a token.
 */
async function git(
  cwd: string,
  args: string[],
  opts: { network?: boolean } = {},
): Promise<GitResult> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  if (opts.network && !env.GIT_SSH_COMMAND && !env.GIT_SSH) {
    const configured = await git(cwd, ['config', '--get', 'core.sshCommand']).catch(() => null);
    if (!configured?.stdout.trim()) env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes';
  }
  return await new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(
      () => child.kill('SIGTERM'),
      opts.network ? NETWORK_TIMEOUT_MS : LOCAL_TIMEOUT_MS,
    );
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? new GitError('git is not installed, or not on PATH')
          : err,
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function gitOk(cwd: string, args: string[], opts?: { network?: boolean }): Promise<string> {
  const res = await git(cwd, args, opts);
  if (res.code !== 0) {
    throw new GitError(
      (res.stderr.trim() || res.stdout.trim() || `git ${args[0]} failed`)
        .split('\n')
        .slice(-3)
        .join('\n'),
    );
  }
  return res.stdout;
}

async function gitMaybe(cwd: string, args: string[]): Promise<string | null> {
  const res = await git(cwd, args);
  return res.code === 0 ? res.stdout.trim() : null;
}

export type FileState = 'pushed' | 'modified' | 'added' | 'deleted';

export type RepoState = {
  /** `code/` exists at all. */
  exists: boolean;
  /** `code/` is its own repository, not a folder inside the project's. */
  isRepo: boolean;
  /** The `origin` address as configured — what the user typed. */
  remoteUrl: string | null;
  /** null when there is no origin, or it is neither GitHub nor GitLab. */
  remote: RemoteInfo | null;
  branch: string | null;
  /** The commit origin has for this branch, as of the last push or fetch. */
  pushedSha: string | null;
  /** ISO date of that commit. */
  pushedAt: string | null;
  /** Files that differ from the pushed commit, deletions included. */
  changes: Array<{ path: string; state: Exclude<FileState, 'pushed'> }>;
};

export async function isOwnRepo(dir: string): Promise<boolean> {
  if (!existsSync(path.join(dir, '.git'))) return false;
  const top = await gitMaybe(dir, ['rev-parse', '--show-toplevel']).catch(() => null);
  if (!top) return false;
  return (await fs.realpath(top)) === (await fs.realpath(dir));
}

async function listLocalFiles(dir: string): Promise<string[]> {
  const out = await gitOk(dir, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  return out.split('\0').filter(Boolean);
}

async function walk(dir: string, base = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(path.join(dir, base), { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') {
      continue;
    }
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(dir, rel)));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

export async function readRepoState(
  userCwd: string,
  hostOverride?: CodeHost | null,
): Promise<RepoState> {
  const dir = codeDir(userCwd);
  const empty: RepoState = {
    exists: existsSync(dir),
    isRepo: false,
    remoteUrl: null,
    remote: null,
    branch: null,
    pushedSha: null,
    pushedAt: null,
    changes: [],
  };
  if (!empty.exists || !(await isOwnRepo(dir))) return empty;

  // The raw setting, not `git remote get-url`: that expands `insteadOf`, and the
  // address a reader is sent to is the one the user configured.
  const remoteUrl = await gitMaybe(dir, ['config', '--get', 'remote.origin.url']);
  const branch = await gitMaybe(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const pushedSha = branch
    ? await gitMaybe(dir, [
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/remotes/origin/${branch}^{commit}`,
      ])
    : null;
  const pushedAt = pushedSha
    ? await gitMaybe(dir, ['show', '-s', '--format=%cI', pushedSha])
    : null;

  const changes: RepoState['changes'] = [];
  if (pushedSha) {
    const diff = await gitOk(dir, ['diff', '--no-renames', '--name-status', '-z', pushedSha]);
    const parts = diff.split('\0').filter(Boolean);
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const code = parts[i][0];
      changes.push({
        path: parts[i + 1],
        state: code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified',
      });
    }
    const untracked = await gitOk(dir, ['ls-files', '-z', '--others', '--exclude-standard']);
    for (const file of untracked.split('\0').filter(Boolean)) {
      changes.push({ path: file, state: 'added' });
    }
  } else {
    for (const file of await listLocalFiles(dir)) changes.push({ path: file, state: 'added' });
  }
  changes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    ...empty,
    isRepo: true,
    remoteUrl,
    remote: remoteUrl ? parseRemote(remoteUrl, hostOverride) : null,
    branch,
    pushedSha,
    pushedAt,
    changes,
  };
}

export type TreeFile = { path: string; state: FileState };

/**
 * Every file in `code/` together with the ones only the pushed commit still
 * has, each marked against that commit — the folder as a reader of the
 * repository would see it once you push.
 */
export async function readTree(userCwd: string, state: RepoState): Promise<TreeFile[]> {
  const dir = codeDir(userCwd);
  if (!state.exists) return [];
  if (!state.isRepo) return (await walk(dir)).sort().map((p) => ({ path: p, state: 'added' }));

  const changed = new Map(state.changes.map((c) => [c.path, c.state]));
  const files = new Set(await listLocalFiles(dir));
  for (const change of state.changes) if (change.state === 'deleted') files.add(change.path);
  return [...files]
    .sort((a, b) => a.localeCompare(b))
    .map((p) => ({ path: p, state: changed.get(p) ?? 'pushed' }));
}

/** A file's text at one commit, or null when that commit has no such file. */
export async function readFileAt(
  userCwd: string,
  sha: string,
  file: string,
): Promise<string | null> {
  const res = await git(codeDir(userCwd), ['show', `${sha}:${file}`]);
  return res.code === 0 ? res.stdout : null;
}

/** A path inside `code/`, or null for anything that would leave it. */
export function resolveCodePath(userCwd: string, file: string): string | null {
  const dir = codeDir(userCwd);
  if (!file || file.includes('\0')) return null;
  const abs = path.resolve(dir, file);
  const rel = path.relative(dir, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (rel.split(path.sep)[0] === '.git') return null;
  return abs;
}

/**
 * Makes `code/` a repository whose origin is `url`. An empty or missing folder
 * is cloned, so an existing repository comes down with its history; a folder
 * that already has files becomes a new repository on `main`.
 */
export async function connectRepo(userCwd: string, url: string): Promise<void> {
  const dir = codeDir(userCwd);
  const entries = existsSync(dir)
    ? (await fs.readdir(dir)).filter((name) => name !== '.DS_Store')
    : [];

  if (entries.length === 0) {
    await fs.rm(dir, { recursive: true, force: true });
    await gitOk(userCwd, ['clone', '--quiet', '--', url, CODE_DIR], { network: true });
    return;
  }

  if (!(await isOwnRepo(dir))) {
    const init = await git(dir, ['init', '--quiet', '--initial-branch=main']);
    if (init.code !== 0) {
      await gitOk(dir, ['init', '--quiet']);
      await gitOk(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
    }
  }
  const current = await gitMaybe(dir, ['config', '--get', 'remote.origin.url']);
  if (current === null) await gitOk(dir, ['remote', 'add', '--', 'origin', url]);
  else if (current !== url) await gitOk(dir, ['remote', 'set-url', '--', 'origin', url]);
  // Learn what origin already has, so the first push knows whether it is one.
  await git(dir, ['fetch', '--quiet', 'origin'], { network: true });
}

export type PushResult = { sha: string; committed: boolean };

/**
 * Commits everything in `code/` that differs and pushes the branch. Code the
 * agent committed but never pushed goes out too; with nothing new at all it is
 * a no-op that reports the commit origin already has.
 */
export async function pushRepo(userCwd: string, message: string): Promise<PushResult> {
  const dir = codeDir(userCwd);
  if (!(await isOwnRepo(dir)))
    throw new GitError('code/ is not a git repository yet — connect it first');
  if (!(await gitMaybe(dir, ['config', '--get', 'remote.origin.url']))) {
    throw new GitError('code/ has no origin — connect it to a repository first');
  }

  await gitOk(dir, ['add', '-A']);
  let committed = false;
  const staged = await git(dir, ['diff', '--cached', '--quiet']);
  if (staged.code === 1) {
    await gitOk(dir, ['commit', '--quiet', '-m', message.trim() || 'Update code excerpts']);
    committed = true;
  }

  const branch = await gitMaybe(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const head = await gitMaybe(dir, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  if (!branch || !head) throw new GitError('code/ has nothing to push yet — add a file first');

  const pushed = await gitMaybe(dir, [
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${branch}`,
  ]);
  if (pushed !== head) {
    await gitOk(dir, ['push', '--quiet', '--set-upstream', 'origin', branch], { network: true });
  }
  return { sha: head, committed };
}

/** Keeps the project's own repository from picking up `code/` as an embedded one. */
export async function ignoreCodeDir(userCwd: string): Promise<boolean> {
  const file = path.join(userCwd, '.gitignore');
  let text = '';
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines.some((line) => ['code', 'code/', '/code', '/code/'].includes(line))) return false;
  const sep = text === '' || text.endsWith('\n') ? '' : '\n';
  await fs.writeFile(file, `${text}${sep}/${CODE_DIR}/\n`, 'utf8');
  return true;
}
