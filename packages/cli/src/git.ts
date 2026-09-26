import { spawn } from 'node:child_process';

const IS_WINDOWS = process.platform === 'win32';

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function run(cmd: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: IS_WINDOWS });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function isGitAvailable(): Promise<boolean> {
  try {
    return (await run('git', ['--version'], process.cwd())).code === 0;
  } catch {
    return false;
  }
}

async function isInsideWorkTree(cwd: string): Promise<boolean> {
  try {
    const res = await run('git', ['rev-parse', '--is-inside-work-tree'], cwd);
    return res.code === 0 && res.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export interface GitInitResult {
  status: 'committed' | 'skipped-nested' | 'skipped-no-git' | 'failed';
  message?: string;
}

export async function gitInitAndCommit(target: string): Promise<GitInitResult> {
  if (!(await isGitAvailable())) {
    return { status: 'skipped-no-git', message: 'git binary not found on PATH' };
  }
  if (await isInsideWorkTree(target)) {
    return {
      status: 'skipped-nested',
      message: 'target is already inside a git work tree; leaving parent repo alone',
    };
  }

  for (const [args, label] of [
    [['init'], 'git init'],
    [['add', '-A'], 'git add'],
    [['commit', '-m', 'chore: init open-doc project'], 'git commit'],
  ] as const) {
    const res = await run('git', [...args], target);
    if (res.code !== 0) {
      return {
        status: 'failed',
        message: `${label} failed: ${res.stderr.trim() || res.stdout.trim()}`,
      };
    }
  }

  return { status: 'committed' };
}
