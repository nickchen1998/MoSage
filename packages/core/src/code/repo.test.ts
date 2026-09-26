import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  connectRepo,
  ignoreCodeDir,
  pushRepo,
  readFileAt,
  readRepoState,
  readTree,
  resolveCodePath,
} from './repo.ts';

const REMOTE_URL = 'https://github.com/acme/q3-code.git';

let root: string;
let project: string;
let bare: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function connectWithLocalRemote(): Promise<void> {
  await connectRepo(project, REMOTE_URL);
}

const GIT_ENV = [
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_KEY_0',
  'GIT_CONFIG_VALUE_0',
];

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'mosage-code-'));
  project = path.join(root, 'project');
  bare = path.join(root, 'remote.git');
  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', bare]);
  process.env.GIT_AUTHOR_NAME = 'Test';
  process.env.GIT_AUTHOR_EMAIL = 'test@example.com';
  process.env.GIT_COMMITTER_NAME = 'Test';
  process.env.GIT_COMMITTER_EMAIL = 'test@example.com';
  // A GitHub address that really pushes to the local bare repository: the tests
  // see the links a reader would get without touching the network.
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = `url.${bare}.insteadOf`;
  process.env.GIT_CONFIG_VALUE_0 = REMOTE_URL;
});

afterEach(() => {
  for (const key of GIT_ENV) delete process.env[key];
  rmSync(root, { recursive: true, force: true });
});

describe('code repository', () => {
  it('starts as a plain folder, then becomes a repository on main', async () => {
    await fs.mkdir(path.join(project, 'code', 'etl'), { recursive: true });
    await fs.writeFile(path.join(project, 'code', 'etl', 'a.py'), 'print(1)\n');

    const before = await readRepoState(project);
    expect(before).toMatchObject({ exists: true, isRepo: false, remote: null });
    expect(await readTree(project, before)).toEqual([{ path: 'etl/a.py', state: 'added' }]);

    await connectWithLocalRemote();
    const after = await readRepoState(project);
    expect(after).toMatchObject({ isRepo: true, branch: 'main', pushedSha: null });
    expect(after.remote).toEqual({
      host: 'github',
      webUrl: 'https://github.com/acme/q3-code',
      slug: 'acme/q3-code',
    });
    expect(after.changes).toEqual([{ path: 'etl/a.py', state: 'added' }]);
  });

  it('pushes, then tracks every file against the pushed commit', async () => {
    await fs.mkdir(path.join(project, 'code'), { recursive: true });
    await fs.writeFile(path.join(project, 'code', 'keep.py'), 'a = 1\n');
    await fs.writeFile(path.join(project, 'code', 'edit.py'), 'b = 1\n');
    await fs.writeFile(path.join(project, 'code', 'gone.py'), 'c = 1\n');
    await connectWithLocalRemote();

    const first = await pushRepo(project, 'First');
    expect(first.committed).toBe(true);
    const pushed = await readRepoState(project);
    expect(pushed.pushedSha).toBe(first.sha);
    expect(pushed.pushedAt).toMatch(/^\d{4}-/);
    expect(pushed.changes).toEqual([]);
    expect(git(bare, 'rev-parse', 'main').trim()).toBe(first.sha);

    await fs.writeFile(path.join(project, 'code', 'edit.py'), 'b = 2\n');
    await fs.rm(path.join(project, 'code', 'gone.py'));
    await fs.writeFile(path.join(project, 'code', 'new.py'), 'd = 1\n');
    const dirty = await readRepoState(project);
    expect(dirty.changes).toEqual([
      { path: 'edit.py', state: 'modified' },
      { path: 'gone.py', state: 'deleted' },
      { path: 'new.py', state: 'added' },
    ]);
    expect(await readTree(project, dirty)).toEqual([
      { path: 'edit.py', state: 'modified' },
      { path: 'gone.py', state: 'deleted' },
      { path: 'keep.py', state: 'pushed' },
      { path: 'new.py', state: 'added' },
    ]);
    expect(await readFileAt(project, first.sha, 'edit.py')).toBe('b = 1\n');
    expect(await readFileAt(project, first.sha, 'new.py')).toBeNull();

    const second = await pushRepo(project, 'Second');
    expect(second.sha).not.toBe(first.sha);
    expect((await readRepoState(project)).changes).toEqual([]);

    // Nothing new: no empty commit, no push.
    const again = await pushRepo(project, 'Nothing');
    expect(again).toEqual({ sha: second.sha, committed: false });
  });

  it('pushes commits the agent made but never pushed', async () => {
    await fs.mkdir(path.join(project, 'code'), { recursive: true });
    await fs.writeFile(path.join(project, 'code', 'a.py'), 'a = 1\n');
    await connectWithLocalRemote();
    await pushRepo(project, 'First');

    await fs.writeFile(path.join(project, 'code', 'a.py'), 'a = 2\n');
    const code = path.join(project, 'code');
    git(code, 'commit', '--quiet', '-am', 'By hand');
    expect((await readRepoState(project)).changes).toEqual([{ path: 'a.py', state: 'modified' }]);

    const result = await pushRepo(project, 'unused');
    expect(result.committed).toBe(false);
    expect((await readRepoState(project)).changes).toEqual([]);
  });

  it('clones into a missing folder', async () => {
    const seed = path.join(root, 'seed');
    git(root, 'clone', '--quiet', bare, seed);
    await fs.writeFile(path.join(seed, 'hello.sql'), 'select 1;\n');
    git(seed, 'add', '-A');
    git(seed, 'commit', '--quiet', '-m', 'seed');
    git(seed, 'push', '--quiet', 'origin', 'HEAD:main');

    await fs.mkdir(project, { recursive: true });
    await connectRepo(project, bare);
    const state = await readRepoState(project, 'gitlab');
    expect(state.isRepo).toBe(true);
    expect(await fs.readFile(path.join(project, 'code', 'hello.sql'), 'utf8')).toBe('select 1;\n');
    // A local path is no web address, whichever host is claimed.
    expect(state.remote).toBeNull();
  });

  it('never treats the project’s own repository as the code one', async () => {
    await fs.mkdir(path.join(project, 'code'), { recursive: true });
    git(project, 'init', '--quiet');
    await fs.writeFile(path.join(project, 'code', 'a.py'), 'a = 1\n');
    expect((await readRepoState(project)).isRepo).toBe(false);
  });

  it('keeps paths inside code/', () => {
    expect(resolveCodePath(project, 'etl/a.py')).toBe(path.join(project, 'code', 'etl', 'a.py'));
    expect(resolveCodePath(project, '../docs/x/index.tsx')).toBeNull();
    expect(resolveCodePath(project, '.git/config')).toBeNull();
    expect(resolveCodePath(project, '')).toBeNull();
  });

  it('adds code/ to the project’s .gitignore once', async () => {
    await fs.mkdir(project, { recursive: true });
    await fs.writeFile(path.join(project, '.gitignore'), 'node_modules\ndist');
    expect(await ignoreCodeDir(project)).toBe(true);
    expect(await ignoreCodeDir(project)).toBe(false);
    expect(await fs.readFile(path.join(project, '.gitignore'), 'utf8')).toBe(
      'node_modules\ndist\n/code/\n',
    );
  });
});
