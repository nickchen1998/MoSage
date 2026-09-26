import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { fetchLatestVersion, isNewerVersion } from '../versions.ts';
import { detectPackageManager, type PackageManager } from './package-manager.ts';

const CHANGELOG_URL = 'https://github.com/nickchen1998/MoSage/blob/main/packages/core/CHANGELOG.md';

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readManifest(file: string): Manifest | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Manifest;
  } catch {
    return null;
  }
}

/** The package manager this project was installed with, read off its lockfile. */
export function projectPackageManager(cwd: string): PackageManager {
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(cwd, 'bun.lock')) || existsSync(path.join(cwd, 'bun.lockb')))
    return 'bun';
  if (existsSync(path.join(cwd, 'package-lock.json'))) return 'npm';
  return detectPackageManager();
}

function addArgs(pm: PackageManager, specs: string[], dev: boolean): [string, string[]] {
  if (pm === 'npm') return ['npm', ['install', ...(dev ? ['--save-dev'] : []), ...specs]];
  return [pm, ['add', ...(dev ? ['-D'] : []), ...specs]];
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

const major = (range: string | undefined) => range?.match(/\d+/)?.[0] ?? null;

/**
 * Packages the project pins at a major the new mosage no longer works with —
 * React, and the Vite an older project template listed — so one upgrade leaves
 * a single copy of each. Returns the specs to install.
 */
export function packagesToAlign(
  project: Manifest,
  mosage: Manifest,
): { deps: string[]; dev: string[] } {
  const deps: string[] = [];
  const dev: string[] = [];
  const check = (
    name: string,
    have: string | undefined,
    wanted: string | undefined,
    into: string[],
  ) => {
    if (wanted && have && major(wanted) !== major(have)) into.push(`${name}@${wanted}`);
  };
  for (const name of ['react', 'react-dom']) {
    check(name, project.dependencies?.[name], mosage.dependencies?.[name], deps);
  }
  for (const name of ['@types/react', '@types/react-dom']) {
    check(name, project.devDependencies?.[name], mosage.devDependencies?.[name], dev);
  }
  check('vite', project.devDependencies?.vite, mosage.dependencies?.vite, dev);
  return { deps, dev };
}

export type UpgradeResult = { from: string; to: string } | null;

/**
 * Installs the latest mosage into the project, brings React and Vite along when
 * the new version needs a different major, and syncs the skills that shipped
 * with it.
 * Returns null when there was nothing to do.
 */
export async function upgrade(cwd = process.cwd()): Promise<UpgradeResult> {
  const manifestPath = path.join(cwd, 'package.json');
  const project = readManifest(manifestPath);
  const range = project?.dependencies?.mosage ?? project?.devDependencies?.mosage;
  if (!project || !range) {
    throw new Error('No mosage dependency in package.json — run this in a MoSage project.');
  }
  if (range.startsWith('workspace:') || range.startsWith('file:') || range.startsWith('link:')) {
    throw new Error(`mosage is linked here (${range}); update the source it links to instead.`);
  }

  const installed = readManifest(path.join(cwd, 'node_modules', 'mosage', 'package.json')) as
    | (Manifest & { version?: string })
    | null;
  const current = installed?.version ?? range.replace(/^[^\d]*/, '');
  const latest = await fetchLatestVersion(10_000);
  if (!latest) throw new Error('Could not reach the npm registry to find the latest version.');
  if (!isNewerVersion(latest, current)) {
    process.stdout.write(`${chalk.green('✔')} MoSage ${current} is already the latest.\n`);
    return null;
  }

  const pm = projectPackageManager(cwd);
  process.stdout.write(`\n${chalk.bold(`Updating MoSage ${current} → ${latest} with ${pm}…`)}\n\n`);
  const [cmd, args] = addArgs(pm, [`mosage@^${latest}`], false);
  await run(cmd, args, cwd);

  const next = readManifest(path.join(cwd, 'node_modules', 'mosage', 'package.json'));
  const align = next
    ? packagesToAlign(readManifest(manifestPath) ?? project, next)
    : { deps: [], dev: [] };
  if (align.deps.length > 0) {
    process.stdout.write(
      `\n${chalk.bold(`MoSage ${latest} needs ${align.deps.join(', ')} — updating…`)}\n\n`,
    );
    await run(...addArgs(pm, align.deps, false), cwd);
  }
  if (align.dev.length > 0) {
    process.stdout.write(`\n${chalk.bold(`Updating ${align.dev.join(', ')}…`)}\n\n`);
    await run(...addArgs(pm, align.dev, true), cwd);
  }

  // The skills belong to the version just installed, so sync with its CLI, not this one.
  const bin = path.join(cwd, 'node_modules', 'mosage', 'bin.js');
  if (existsSync(bin)) await run(process.execPath, [bin, 'sync:skills'], cwd);

  process.stdout.write(
    `\n${chalk.green('✔')} MoSage ${latest} is installed. What changed: ${chalk.underline(CHANGELOG_URL)}\n`,
  );
  return { from: current, to: latest };
}
