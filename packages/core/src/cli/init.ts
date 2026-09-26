import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import chalk from 'chalk';
import prompts from 'prompts';
import { gitInitAndCommit } from './git.ts';
import { detectPackageManager, PACKAGE_MANAGERS, type PackageManager } from './package-manager.ts';
import { packageRoot, readCoreVersion } from './package-version.ts';
import { syncSkills } from './sync.ts';

const IS_WINDOWS = process.platform === 'win32';

export interface InitOptions {
  dir: string;
  force: boolean;
  name: string | undefined;
  packageManager: PackageManager;
  install: boolean;
  git: boolean;
}

export function sanitizeDirName(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '.' || trimmed === '..') return trimmed;
  const cleaned = trimmed
    .replace(/\s+/g, '-')
    .replace(/[^\\\p{L}\p{N}_./-]/gu, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .replace(/-*([/\\])-*/g, '$1');
  if (cleaned === '' || /^[/\\]+$/.test(cleaned)) return 'my-docs';
  return cleaned;
}

export async function isDirNonEmpty(target: string): Promise<boolean> {
  if (!existsSync(target)) return false;
  const entries = await readdir(target);
  return entries.some((e) => !e.startsWith('.'));
}

async function linkOrCopy(relSrc: string, dst: string): Promise<void> {
  await rm(dst, { recursive: true, force: true });
  if (IS_WINDOWS) {
    await cp(resolve(dirname(dst), relSrc), dst, { recursive: true });
    return;
  }
  await symlink(relSrc, dst);
}

// Claude Code reads CLAUDE.md; the template's instructions live in AGENTS.md
// (read by Codex and others). Point one at the other.
async function linkClaudeMd(target: string): Promise<void> {
  const claudeMd = join(target, 'CLAUDE.md');
  if (!existsSync(claudeMd) && existsSync(join(target, 'AGENTS.md'))) {
    await linkOrCopy('AGENTS.md', claudeMd);
  }
}

async function runInstall(pm: PackageManager, cwd: string): Promise<void> {
  await new Promise<void>((res, rej) => {
    const child = spawn(pm, ['install'], { cwd, stdio: 'inherit', shell: IS_WINDOWS });
    child.on('error', rej);
    child.on('close', (code) =>
      code === 0 ? res() : rej(new Error(`${pm} install exited with code ${code}`)),
    );
  });
}

export async function init(opts: InitOptions): Promise<void> {
  const { dir, force, name, packageManager, install, git } = opts;

  const root = packageRoot();
  const templateDir = root ? join(root, 'template') : '';
  if (!root || !existsSync(templateDir)) {
    throw new Error('Project template not found — reinstall mosage.');
  }

  const target = resolve(process.cwd(), dir);
  await mkdir(target, { recursive: true });

  if ((await isDirNonEmpty(target)) && !force) {
    throw new Error(`Target ${target} is not empty. Pass --force to scaffold into it anyway.`);
  }

  await cp(templateDir, target, { recursive: true });
  await linkClaudeMd(target);
  await syncSkills(join(root, 'skills'), { quiet: true }, target);

  const pkgPath = join(target, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown> & {
      dependencies?: Record<string, string>;
    };
    pkg.name = name ?? basename(target);
    pkg.version = '0.0.0';
    pkg.private = true;
    if (pkg.dependencies?.mosage) {
      pkg.dependencies.mosage = `^${await readCoreVersion()}`;
    }
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  // code/ is a repository of its own, pushed to GitHub or GitLab by `mosage code`.
  await writeFile(join(target, '.gitignore'), 'node_modules\ndist\n.DS_Store\n/code/\n');

  // pnpm blocks postinstall scripts unless a package opts in, and Vite is dead
  // in the water without esbuild's — it never unpacks its platform binary.
  // Written unconditionally: `pnpm dlx` doesn't set npm_config_user_agent, so a
  // pnpm user can easily be detected as npm here, and the file is inert under
  // every other package manager.
  await writeFile(
    join(target, 'pnpm-workspace.yaml'),
    [
      '# Vite needs esbuild to unpack its platform binary during postinstall,',
      '# which pnpm only runs for packages listed here.',
      'allowBuilds:',
      '  esbuild: true',
      '  rolldown: true',
      '',
    ].join('\n'),
  );

  const cdTarget = dir === '.' ? basename(target) : dir;
  process.stdout.write(
    `\n${chalk.green.bold('✔ Created MoSage workspace')} ${chalk.dim(`in ${target}`)}\n`,
  );

  let installed = false;
  if (install) {
    process.stdout.write(`\n${chalk.bold(`Installing dependencies with ${packageManager}…`)}\n\n`);
    try {
      await runInstall(packageManager, target);
      installed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(
        `\n${chalk.yellow('! Dependency install failed:')} ${chalk.dim(msg)}\n` +
          chalk.dim(`  You can retry manually with \`${packageManager} install\`.\n`),
      );
    }
  }

  if (git) {
    const result = await gitInitAndCommit(target);
    if (result.status === 'committed') {
      process.stdout.write(`${chalk.green('✔')} Initialized git repository with first commit.\n`);
    } else {
      process.stdout.write(
        `${chalk.yellow('!')} Git setup skipped: ${chalk.dim(result.message ?? '')}\n`,
      );
    }
  }

  process.stdout.write(`\n${chalk.bold('Next steps:')}\n`);
  process.stdout.write(`  ${chalk.cyan(`cd ${cdTarget}`)}\n`);
  if (!installed && install) {
    process.stdout.write(`  ${chalk.cyan(`${packageManager} install`)}\n`);
  } else if (!install) {
    process.stdout.write(
      `  ${chalk.cyan(`${packageManager} install`)}    ${chalk.dim('# install was skipped')}\n`,
    );
  }
  const devCommand = packageManager === 'npm' ? 'npm run dev' : `${packageManager} dev`;
  process.stdout.write(`  ${chalk.cyan(devCommand)}\n`);
}

// --- `mosage init` command-line handling -----------------------------------

interface InitCliFlags {
  force?: boolean;
  name?: string;
  useNpm?: boolean;
  usePnpm?: boolean;
  useYarn?: boolean;
  useBun?: boolean;
  install?: boolean;
  git?: boolean;
}

function onCancel(): never {
  process.stdout.write(chalk.dim('\nCancelled.\n'));
  process.exit(130);
}

function packageManagerFromFlags(flags: InitCliFlags): PackageManager | undefined {
  const picks: PackageManager[] = [];
  if (flags.useNpm) picks.push('npm');
  if (flags.usePnpm) picks.push('pnpm');
  if (flags.useYarn) picks.push('yarn');
  if (flags.useBun) picks.push('bun');

  if (picks.length > 1) {
    throw new Error(
      `Only one of --use-npm / --use-pnpm / --use-yarn / --use-bun may be specified (got ${picks
        .map((p) => `--use-${p}`)
        .join(', ')}).`,
    );
  }
  return picks[0];
}

export async function runInit(dirArg: string | undefined, flags: InitCliFlags): Promise<void> {
  const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  let dir = dirArg;
  let force = flags.force ?? false;
  let packageManager = packageManagerFromFlags(flags);

  if (isTTY && dir === undefined) {
    const answers = await prompts(
      { type: 'text', name: 'dir', message: 'Target directory', initial: '.' },
      { onCancel },
    );
    dir = answers.dir;
  }

  if (dir !== undefined) {
    const safe = sanitizeDirName(dir);
    if (safe !== dir) {
      if (!isTTY) {
        throw new Error(
          `Target directory "${dir}" contains characters that break shell commands (spaces, quotes, etc.). Try "${safe}" instead.`,
        );
      }
      const answers = await prompts(
        { type: 'text', name: 'dir', message: 'Directory name', initial: safe },
        { onCancel },
      );
      dir = sanitizeDirName(answers.dir ?? safe);
    }
  }

  if (isTTY && packageManager === undefined && flags.install !== false) {
    const detected = detectPackageManager();
    const answers = await prompts(
      {
        type: 'select',
        name: 'packageManager',
        message: 'Package manager',
        choices: PACKAGE_MANAGERS.map((pm) => ({ title: pm, value: pm })),
        initial: PACKAGE_MANAGERS.indexOf(detected),
      },
      { onCancel },
    );
    packageManager = answers.packageManager as PackageManager | undefined;
  }

  const resolvedDir = dir ?? '.';
  const target = resolve(process.cwd(), resolvedDir);

  if (!force && (await isDirNonEmpty(target))) {
    if (!isTTY) {
      throw new Error(`Target ${target} is not empty. Pass --force to scaffold into it anyway.`);
    }
    const { overwrite } = await prompts(
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${chalk.yellow(target)} is not empty. Scaffold into it anyway?`,
        initial: false,
      },
      { onCancel },
    );
    if (!overwrite) {
      process.stdout.write(chalk.dim('Aborted.\n'));
      return;
    }
    force = true;
  }

  const opts: InitOptions = {
    dir: resolvedDir,
    force,
    name: flags.name,
    packageManager: packageManager ?? detectPackageManager(),
    install: flags.install !== false,
    git: flags.git !== false,
  };
  await init(opts);
}
