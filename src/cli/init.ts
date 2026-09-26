// `npx mosage init my-writing` — a project folder that holds any number of
// books and theses under books/.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { PROJECT_TEMPLATE_DIR, SKILLS_DIR, VERSION } from './paths.ts';
import { bold, cyan, dim, green, yellow } from './style.ts';

export interface InitOptions {
  dir: string;
  author?: string;
  install: boolean;
  git: boolean;
  force: boolean;
}

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';
  if (agent.startsWith('bun')) return 'bun';
  return 'npm';
}

async function isNonEmpty(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  return (await readdir(dir)).some((name) => !name.startsWith('.'));
}

function run(cmd: string, args: string[], cwd: string, quiet = false): Promise<void> {
  return new Promise((ok, fail) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: quiet ? 'ignore' : 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? ok() : fail(new Error(`${cmd} exited with ${code}`)),
    );
  });
}

/**
 * Copy the bundled skills into `.agents/skills/` (read by Codex and other
 * agents) and point `.claude/skills/` at them for Claude Code.
 */
export async function installSkills(target: string): Promise<string[]> {
  const agentsDir = join(target, '.agents', 'skills');
  const claudeDir = join(target, '.claude', 'skills');
  await mkdir(agentsDir, { recursive: true });
  await mkdir(claudeDir, { recursive: true });
  const names = (await readdir(SKILLS_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const name of names) {
    const src = join(agentsDir, name);
    await rm(src, { recursive: true, force: true });
    await cp(join(SKILLS_DIR, name), src, { recursive: true });
    const link = join(claudeDir, name);
    await rm(link, { recursive: true, force: true });
    if (process.platform === 'win32') {
      await cp(src, link, { recursive: true });
    } else {
      await symlink(relative(claudeDir, src), link);
    }
  }
  return names;
}

export async function init(opts: InitOptions): Promise<void> {
  const target = resolve(process.cwd(), opts.dir);
  if ((await isNonEmpty(target)) && !opts.force) {
    throw new Error(`${target} 不是空資料夾。換一個名稱，或加上 --force 強制建立。`);
  }
  await mkdir(target, { recursive: true });
  await cp(PROJECT_TEMPLATE_DIR, target, { recursive: true, force: opts.force });

  // npm drops .gitignore from published packages, so the template ships it
  // under another name.
  if (existsSync(join(target, 'gitignore'))) {
    await cp(join(target, 'gitignore'), join(target, '.gitignore'));
    await rm(join(target, 'gitignore'));
  }

  const name = basename(target);
  const pkgPath = join(target, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  pkg.name =
    name
      .toLowerCase()
      .replace(/[^a-z0-9-_.]+/g, '-')
      .replace(/^[-.]+|-+$/g, '') || 'my-writing';
  pkg.devDependencies = { ...pkg.devDependencies, mosage: `^${VERSION}` };
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const configPath = join(target, 'mosage.yaml');
  if (opts.author) {
    const doc = parseDocument(await readFile(configPath, 'utf8'));
    doc.set('author', opts.author);
    await writeFile(configPath, doc.toString({ lineWidth: 0 }));
  }

  const skills = await installSkills(target);

  const out = process.stdout;
  out.write(`\n${green('✔')} ${bold('已建立寫作專案')} ${dim(target)}\n`);
  out.write(dim(`  已安裝 ${skills.length} 個 AI skills：${skills.join('、')}\n`));

  const pm = detectPackageManager();
  let installed = false;
  if (opts.install) {
    out.write(`\n${bold(`正在用 ${pm} 安裝相依套件…`)}\n\n`);
    try {
      await run(pm, ['install'], target);
      installed = true;
    } catch (err) {
      out.write(
        `\n${yellow('!')} 安裝失敗：${dim((err as Error).message)}，稍後可手動執行 ${cyan(`${pm} install`)}\n`,
      );
    }
  }

  if (opts.git) {
    try {
      await run('git', ['init', '-q'], target, true);
      await run('git', ['add', '-A'], target, true);
      await run(
        'git',
        [
          '-c',
          'user.name=MoSage',
          '-c',
          'user.email=mosage@localhost',
          'commit',
          '-qm',
          '建立寫作專案',
        ],
        target,
        true,
      );
      out.write(`${green('✔')} 已建立 git 版本庫（AI 的每一次修改都能回溯）\n`);
    } catch {
      out.write(`${yellow('!')} 略過 git 初始化（找不到 git 或初始化失敗）\n`);
    }
  }

  const cd = relative(process.cwd(), target) || '.';
  const devCmd = pm === 'npm' ? 'npm run dev' : `${pm} dev`;
  out.write(`\n${bold('接下來：')}\n\n`);
  out.write(`  ${dim('1.')} 開啟寫作介面\n`);
  if (cd !== '.') out.write(`     ${cyan(`cd ${cd}`)}\n`);
  if (!installed) out.write(`     ${cyan(`${pm} install`)}\n`);
  out.write(`     ${cyan(devCmd)}      ${dim('# 瀏覽器開啟 http://localhost:5280')}\n\n`);
  out.write(`  ${dim('2.')} 在同一個資料夾開啟 AI 工具\n`);
  out.write(`     ${cyan('claude')}   ${dim('# Claude Code，或')}  ${cyan('codex')}\n\n`);
  out.write(`  ${dim('3.')} 對 AI 說「${bold('開始')}」（或輸入 ${cyan('/kickoff')}）\n`);
  out.write(
    dim(
      '     AI 會先了解你的寫作目的、讀者與風格，再和你一起訂書名與大綱，\n' +
        '     在瀏覽器裡編排好章節後，就可以開始一章一章寫。\n' +
        '     一個專案可以放很多本書 —— 想寫下一本時，跟 AI 說「我想寫一本新書」。\n\n',
    ),
  );
}
