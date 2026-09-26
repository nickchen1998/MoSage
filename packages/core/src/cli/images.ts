import chalk from 'chalk';
import { readSettings, usesGeneratedImages } from '../files/settings.ts';
import { listDocIds, OpsError } from '../ops/documents.ts';
import { generateImage, listImagePrompts, type PendingImage, placeImage } from '../ops/images.ts';
import { cliContext } from './context.ts';

function describe(prompt: PendingImage): string {
  const state = prompt.problem
    ? chalk.red(`✗ ${prompt.problem}`)
    : prompt.ready
      ? chalk.yellow('image on disk — run `mosage images place`')
      : prompt.enabled
        ? chalk.cyan('waiting')
        : chalk.dim('off for this document');
  const text = prompt.prompt.length > 90 ? `${prompt.prompt.slice(0, 89)}…` : prompt.prompt;
  return `  ${chalk.bold(`${prompt.docId}/${prompt.id}`)} ${state}\n    ${text}\n    ${chalk.dim(`→ ${prompt.file}`)}`;
}

/**
 * The image prompts still in the documents, and whether each document uses
 * generated images. `--json` is what an agent reads: the `generate-images`
 * skill draws exactly the prompts listed here.
 */
export async function listImages(opts: { doc?: string; json?: boolean }): Promise<void> {
  const ctx = await cliContext();
  const settings = await readSettings(ctx.userCwd);
  const prompts = await listImagePrompts(ctx, opts.doc);
  const docs = opts.doc ? [opts.doc] : await listDocIds(ctx);
  const documents = Object.fromEntries(docs.map((id) => [id, usesGeneratedImages(settings, id)]));

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({ mode: settings.imageGeneration.mode, documents, prompts }, null, 2)}\n`,
    );
    return;
  }

  process.stdout.write(`Image generation: ${chalk.bold(settings.imageGeneration.mode)}\n`);
  if (prompts.length === 0) {
    process.stdout.write(chalk.dim('No <ImagePrompt> left in the documents.\n'));
    return;
  }
  process.stdout.write(`${prompts.map(describe).join('\n')}\n`);
}

/** Draws prompts through the OpenAI API — one, one document's, or every waiting one. */
export async function generateImages(opts: { doc?: string; id?: string }): Promise<void> {
  const ctx = await cliContext();
  const prompts = (await listImagePrompts(ctx, opts.doc)).filter(
    (p) => !p.problem && p.enabled && !p.ready && (!opts.id || p.id === opts.id),
  );
  if (prompts.length === 0) {
    process.stdout.write(chalk.dim('Nothing to generate.\n'));
    return;
  }
  let total = 0;
  for (const prompt of prompts) {
    process.stdout.write(`${chalk.dim('…')} ${prompt.docId}/${prompt.id}\n`);
    const result = await generateImage(ctx, prompt.docId, prompt.id);
    total += result.costUsd;
    process.stdout.write(
      `${chalk.green('✓')} ${prompt.docId}/${prompt.id} → ${result.file} ${chalk.dim(
        `(${result.usage.inputTokens} in / ${result.usage.outputTokens} out · ~$${result.costUsd.toFixed(4)})`,
      )}\n`,
    );
  }
  process.stdout.write(`${chalk.bold(`~$${total.toFixed(4)}`)} for ${prompts.length} image(s)\n`);
}

/**
 * Swaps prompts for the images already saved at their paths — what Codex runs
 * after drawing. With no id, places every prompt in the document whose image exists.
 */
export async function placeImages(docId: string, id?: string): Promise<void> {
  const ctx = await cliContext();
  const ready = (await listImagePrompts(ctx, docId)).filter(
    (p) => !p.problem && (id ? p.id === id : p.ready),
  );
  if (ready.length === 0) {
    throw new OpsError(
      404,
      id ? `no <ImagePrompt id="${id}"> in ${docId}` : 'no image is waiting to be placed',
    );
  }
  for (const prompt of ready) {
    const result = await placeImage(ctx, docId, prompt.id);
    process.stdout.write(`${chalk.green('✓')} ${docId}/${prompt.id} ← ${result.importPath}\n`);
  }
}
