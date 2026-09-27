import path from 'node:path';
import chalk from 'chalk';
import { type ImportResult, importDocx, importMarkdown } from '../ops/index.ts';
import { cliContext } from './context.ts';

export interface ImportOptions {
  id?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  theme?: string;
  orientation?: string;
  cover?: boolean;
  contents?: boolean;
}

export async function importDoc(file: string, opts: ImportOptions = {}): Promise<void> {
  const ctx = await cliContext();
  const relative = path.relative(ctx.userCwd, path.resolve(ctx.userCwd, file));

  const options = {
    file: relative,
    ...(opts.id !== undefined ? { docId: opts.id } : {}),
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.subtitle !== undefined ? { subtitle: opts.subtitle } : {}),
    ...(opts.author !== undefined ? { author: opts.author } : {}),
    ...(opts.theme !== undefined ? { theme: opts.theme } : {}),
    ...(opts.orientation !== undefined ? { orientation: opts.orientation } : {}),
    ...(opts.cover !== undefined ? { cover: opts.cover } : {}),
    ...(opts.contents !== undefined ? { contents: opts.contents } : {}),
  };
  const word = /\.docx$/i.test(file);
  if (/\.doc$/i.test(file)) {
    throw new Error('An old .doc file cannot be read — save it from Word as .docx first.');
  }
  let skipped: Record<string, number> = {};
  let result: ImportResult;
  if (word) {
    const imported = await importDocx(ctx, options);
    skipped = imported.skipped;
    result = imported;
  } else {
    result = await importMarkdown(ctx, options);
  }

  process.stdout.write(
    `${chalk.green('✓')} ${chalk.bold(result.title)} → ${result.entry} ${chalk.dim(`(${result.blocks} blocks)`)}\n`,
  );
  if (result.assets.length > 0) {
    process.stdout.write(chalk.dim(`  copied ${result.assets.length} asset(s)\n`));
  }
  for (const missing of result.missingAssets) {
    process.stdout.write(chalk.yellow(`  ! image not found, left as written: ${missing}\n`));
  }
  for (const [kind, count] of Object.entries(skipped)) {
    process.stdout.write(
      chalk.yellow(
        `  ! ${count} ${kind}${count === 1 ? '' : 's'} not imported — redo with <Chart>, <Diagram>, or text\n`,
      ),
    );
  }
}
