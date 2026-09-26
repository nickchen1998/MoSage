import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';

export type SkillStatus = 'added' | 'updated' | 'unchanged';

export type SkillDrift = { name: string; status: SkillStatus };

const SKILL_TARGET_DIRS = ['.agents/skills', '.claude/skills'];

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string) => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else out.push(path.relative(dir, abs));
    }
  };
  await walk(dir);
  return out.sort();
}

async function sameTree(src: string, dst: string): Promise<boolean> {
  if (!existsSync(dst)) return false;
  const [srcFiles, dstFiles] = await Promise.all([listFiles(src), listFiles(dst)]);
  if (srcFiles.length !== dstFiles.length) return false;
  if (srcFiles.some((f, i) => f !== dstFiles[i])) return false;
  for (const rel of srcFiles) {
    const [a, b] = await Promise.all([
      fs.readFile(path.join(src, rel), 'utf8'),
      fs.readFile(path.join(dst, rel), 'utf8'),
    ]);
    if (a !== b) return false;
  }
  return true;
}

async function skillNames(builtinDir: string): Promise<string[]> {
  if (!existsSync(builtinDir)) return [];
  const entries = await fs.readdir(builtinDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export async function detectSkillsDrift(
  builtinDir: string,
  userCwd = process.cwd(),
): Promise<SkillDrift[]> {
  const names = await skillNames(builtinDir);
  const primaryTarget = path.join(userCwd, SKILL_TARGET_DIRS[0]);
  const drift: SkillDrift[] = [];
  for (const name of names) {
    const src = path.join(builtinDir, name);
    const dst = path.join(primaryTarget, name);
    if (!existsSync(dst)) drift.push({ name, status: 'added' });
    else if (!(await sameTree(src, dst))) drift.push({ name, status: 'updated' });
    else drift.push({ name, status: 'unchanged' });
  }
  return drift;
}

export async function syncSkills(
  builtinDir: string,
  opts: { dryRun?: boolean } = {},
  userCwd = process.cwd(),
): Promise<void> {
  const drift = await detectSkillsDrift(builtinDir, userCwd);
  const stale = drift.filter((d) => d.status !== 'unchanged');

  if (stale.length === 0) {
    process.stdout.write(`${chalk.green('✔')} Skills already up to date.\n`);
    return;
  }

  for (const { name, status } of stale) {
    if (opts.dryRun) {
      process.stdout.write(`${chalk.yellow('~')} ${name} ${chalk.dim(`(${status})`)}\n`);
      continue;
    }
    for (const targetDir of SKILL_TARGET_DIRS) {
      const dst = path.join(userCwd, targetDir, name);
      await fs.rm(dst, { recursive: true, force: true });
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.cp(path.join(builtinDir, name), dst, { recursive: true });
    }
    process.stdout.write(`${chalk.green('✔')} ${name} ${chalk.dim(`(${status})`)}\n`);
  }

  if (opts.dryRun) {
    process.stdout.write(chalk.dim('\nDry run — nothing written.\n'));
  }
}
