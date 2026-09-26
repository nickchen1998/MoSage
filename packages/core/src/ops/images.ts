import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readSettings, usesGeneratedImages } from '../files/settings.ts';
import { readOpenAiKey } from '../files/user-data.ts';
import { OpenAiError, requestImage, sizeFor } from '../images/openai.ts';
import { estimateCostUsd, type ImageTokenUsage } from '../images/pricing.ts';
import {
  findImagePrompts,
  type ImagePromptEntry,
  imagePathFor,
  replaceImagePrompt,
} from '../images/prompts.ts';
import { appendUsage } from '../images/usage.ts';
import type { ApiContext } from '../vite/routes/context.ts';
import { docDir, listDocIds, OpsError, resolveEntry } from './documents.ts';

export type PendingImage = ImagePromptEntry & {
  docId: string;
  /** Where the finished image goes, relative to the project root. */
  file: string;
  /** What the document will import once the image is placed. */
  importPath: string;
  /** The file is already on disk — only the source still needs the swap. */
  ready: boolean;
  /** Whether this document has generated images switched on. */
  enabled: boolean;
};

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

async function promptsOf(
  ctx: ApiContext,
  docId: string,
  enabled: boolean,
): Promise<PendingImage[]> {
  const entry = resolveEntry(ctx, docId);
  if (!entry) return [];
  const source = await fs.readFile(entry, 'utf8');
  const dir = docDir(ctx, docId);
  return findImagePrompts(source).map((prompt) => {
    const relative = imagePathFor(prompt);
    const absolute = path.join(dir, relative);
    return {
      ...prompt,
      docId,
      file: toPosix(path.relative(ctx.userCwd, absolute)),
      importPath: `./${relative}`,
      ready: existsSync(absolute),
      enabled,
    };
  });
}

/** Every `<ImagePrompt>` still in the documents — one document, or all of them. */
export async function listImagePrompts(ctx: ApiContext, docId?: string): Promise<PendingImage[]> {
  const settings = await readSettings(ctx.userCwd);
  const ids = docId ? [docId] : await listDocIds(ctx);
  const out: PendingImage[] = [];
  for (const id of ids) out.push(...(await promptsOf(ctx, id, usesGeneratedImages(settings, id))));
  return out;
}

async function findPrompt(ctx: ApiContext, docId: string, id: string): Promise<PendingImage> {
  const settings = await readSettings(ctx.userCwd);
  const prompt = (await promptsOf(ctx, docId, usesGeneratedImages(settings, docId))).find(
    (p) => p.id === id,
  );
  if (!prompt) throw new OpsError(404, `no <ImagePrompt id="${id}"> in ${docId}`);
  if (prompt.problem) throw new OpsError(422, `<ImagePrompt id="${id}">: ${prompt.problem}`);
  return prompt;
}

/**
 * Swaps a prompt for the image already saved at its path. This is the step
 * Codex runs after drawing an image, and the last step of `generateImage`.
 */
export async function placeImage(
  ctx: ApiContext,
  docId: string,
  id: string,
): Promise<{ file: string; importPath: string }> {
  const prompt = await findPrompt(ctx, docId, id);
  if (!prompt.ready) throw new OpsError(409, `the image is not on disk yet: ${prompt.file}`);
  const entry = resolveEntry(ctx, docId);
  if (!entry) throw new OpsError(404, `document not found: ${docId}`);
  const source = await fs.readFile(entry, 'utf8');
  const next = replaceImagePrompt(source, id, prompt.importPath);
  if (next === null) throw new OpsError(404, `no <ImagePrompt id="${id}"> in ${docId}`);
  await fs.writeFile(entry, next, 'utf8');
  return { file: prompt.file, importPath: prompt.importPath };
}

export type GeneratedImage = {
  docId: string;
  id: string;
  file: string;
  model: string;
  size: string;
  usage: ImageTokenUsage;
  costUsd: number;
};

/** Draws one prompt through the OpenAI Images API, saves it, and places it. */
export async function generateImage(
  ctx: ApiContext,
  docId: string,
  id: string,
): Promise<GeneratedImage> {
  const settings = (await readSettings(ctx.userCwd)).imageGeneration;
  if (settings.mode !== 'openai') {
    throw new OpsError(409, 'image generation is not set to the OpenAI API in settings');
  }
  const prompt = await findPrompt(ctx, docId, id);
  if (!prompt.enabled) {
    throw new OpsError(409, `generated images are switched off for ${docId}`);
  }
  const key = await readOpenAiKey();
  if (!key) throw new OpsError(412, 'no OpenAI API key — add one in Settings');

  const size = sizeFor(prompt.width, prompt.height);
  let result: Awaited<ReturnType<typeof requestImage>>;
  try {
    result = await requestImage({
      apiKey: key.key,
      model: settings.model,
      prompt: prompt.prompt,
      size,
      quality: settings.quality,
    });
  } catch (err) {
    if (err instanceof OpenAiError) throw new OpsError(err.status, err.message);
    throw err;
  }

  const absolute = path.join(ctx.userCwd, prompt.file);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, result.bytes);

  const costUsd = estimateCostUsd(settings.model, result.usage);
  await appendUsage({
    ts: new Date().toISOString(),
    project: ctx.userCwd,
    docId,
    imageId: id,
    model: settings.model,
    size,
    quality: settings.quality,
    ...result.usage,
    costUsd,
  });

  await placeImage(ctx, docId, id);
  return {
    docId,
    id,
    file: prompt.file,
    model: settings.model,
    size,
    usage: result.usage,
    costUsd,
  };
}
