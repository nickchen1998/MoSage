import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isOrientation, isPageSizeName, ORIENTATIONS, PAGE_SIZE_NAMES } from '../app/lib/sdk.ts';
import { validateAssetName } from '../files/assets.ts';
import { parseDocx } from '../import/docx.ts';
import { type ParsedMarkdown, parseMarkdown } from '../import/markdown.ts';
import { collectImageSources, generateDocumentSource, type ImportImage } from '../import/to-tsx.ts';
import { DOC_ID_RE } from '../vite/mosage-plugin.ts';
import type { ApiContext } from '../vite/routes/context.ts';
import { createDocument, listDocIds, OpsError } from './documents.ts';

export type ImportMarkdownOptions = {
  /** Markdown text. One of `markdown` or `file` is required. */
  markdown?: string;
  /** Path to a `.md` file, relative to the workspace root. */
  file?: string;
  docId?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  theme?: string;
  pageSize?: string;
  orientation?: string;
  /** Open with a title page. Defaults to true. */
  cover?: boolean;
  /** Insert a self-filling contents page. Defaults to false. */
  contents?: boolean;
};

export type ImportResult = {
  id: string;
  entry: string;
  title: string;
  blocks: number;
  /** Local images copied into `docs/<id>/assets/images/`. */
  assets: string[];
  /** Image references that could not be resolved and were left as written. */
  missingAssets: string[];
};

const REMOTE_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function slugify(value: string, fallback = 'document'): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  // Non-Latin titles slug down to nothing; a caller-supplied id is the fix.
  return DOC_ID_RE.test(slug) ? slug : fallback;
}

function uniqueId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new OpsError(409, `could not find a free id for ${base}`);
}

function identFor(index: number): string {
  return `figure${index + 1}`;
}

/** Where a picture comes from: a file beside the markdown, or bytes out of a Word package. */
type StagedImage = { filename: string; from: string } | { filename: string; bytes: Uint8Array };

type Prepared = {
  parsed: ParsedMarkdown;
  fallbackName: string;
  images: Map<string, ImportImage>;
  staged: StagedImage[];
  missing: string[];
};

/**
 * What every import shares once its source is parsed: the checks on page
 * setup, a free document id, the generated module, and the pictures copied
 * into the document's own `assets/images/`.
 */
async function writeImport(
  ctx: ApiContext,
  { parsed, fallbackName, images, staged, missing }: Prepared,
  opts: Omit<ImportMarkdownOptions, 'markdown' | 'file'>,
): Promise<ImportResult> {
  const pageSize = opts.pageSize ?? parsed.frontmatter.pageSize;
  if (pageSize !== undefined && !isPageSizeName(pageSize)) {
    throw new OpsError(
      422,
      `unsupported pageSize \`${pageSize}\` — MoSage lays out ${PAGE_SIZE_NAMES.join(', ')} only`,
    );
  }
  const orientation = opts.orientation ?? parsed.frontmatter.orientation;
  if (orientation !== undefined && !isOrientation(orientation)) {
    throw new OpsError(
      422,
      `unsupported orientation \`${orientation}\` — use ${ORIENTATIONS.join(', ')}`,
    );
  }

  const requestedId = opts.docId ?? slugify(opts.title ?? parsed.frontmatter.title ?? fallbackName);
  if (opts.docId && !DOC_ID_RE.test(opts.docId)) {
    throw new OpsError(400, `invalid document id: ${opts.docId}`);
  }
  const docId = opts.docId ?? uniqueId(requestedId, new Set(await listDocIds(ctx)));

  const generated = generateDocumentSource(parsed, {
    docId,
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.subtitle !== undefined ? { subtitle: opts.subtitle } : {}),
    ...(opts.author !== undefined ? { author: opts.author } : {}),
    ...(opts.theme !== undefined ? { theme: opts.theme } : {}),
    ...(opts.pageSize !== undefined ? { pageSize: opts.pageSize } : {}),
    ...(opts.orientation !== undefined ? { orientation: opts.orientation } : {}),
    ...(opts.cover !== undefined ? { cover: opts.cover } : {}),
    ...(opts.contents !== undefined ? { contents: opts.contents } : {}),
    createdAt: new Date().toISOString(),
    images,
  });

  const created = await createDocument(ctx, docId, generated.source);

  if (staged.length > 0) {
    const imagesDir = path.join(ctx.docsRoot, docId, 'assets', 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    for (const image of staged) {
      const dest = path.join(imagesDir, image.filename);
      if ('bytes' in image) await fs.writeFile(dest, image.bytes);
      else await fs.copyFile(image.from, dest);
    }
  }

  return {
    id: created.id,
    entry: created.entry,
    title: generated.title,
    blocks: generated.blockCount,
    assets: staged.map((image) => image.filename),
    missingAssets: missing,
  };
}

function resolveSourceFile(ctx: ApiContext, file: string | undefined): string | null {
  const sourceFile = file ? path.resolve(ctx.userCwd, file) : null;
  if (sourceFile && !sourceFile.startsWith(ctx.userCwd + path.sep)) {
    throw new OpsError(400, `file must sit inside the workspace: ${file}`);
  }
  return sourceFile;
}

/** A file name the assets folder accepts, unique among the ones already taken. */
function claimName(name: string, taken: Set<string>): string | null {
  const safe = validateAssetName(name);
  if (!safe) return null;
  const filename = taken.has(safe) ? `${taken.size + 1}-${safe}` : safe;
  taken.add(filename);
  return filename;
}

/**
 * Reads markdown and writes a real MoSage document: `flow()` body, inline
 * styles, a cover, and any local images copied into the document's own assets
 * folder. Nothing about the result is special-cased — it is the same shape an
 * agent would have written by hand, and every editing surface works on it.
 */
export async function importMarkdown(
  ctx: ApiContext,
  opts: ImportMarkdownOptions,
): Promise<ImportResult> {
  const sourceFile = resolveSourceFile(ctx, opts.file);

  let markdown = opts.markdown;
  if (markdown === undefined) {
    if (!sourceFile) throw new OpsError(400, 'pass either `markdown` or `file`');
    try {
      markdown = await fs.readFile(sourceFile, 'utf8');
    } catch {
      throw new OpsError(404, `file not found: ${opts.file}`);
    }
  }
  if (markdown.trim() === '') throw new OpsError(422, 'the markdown is empty');

  const parsed = parseMarkdown(markdown);
  const baseDir = sourceFile ? path.dirname(sourceFile) : ctx.userCwd;
  const images = new Map<string, ImportImage>();
  const missing: string[] = [];
  const staged: StagedImage[] = [];
  const taken = new Set<string>();

  for (const src of new Set(collectImageSources(parsed.blocks))) {
    if (REMOTE_RE.test(src)) continue;
    const from = path.resolve(baseDir, src.split(/[?#]/)[0]);
    const filename =
      from.startsWith(ctx.userCwd + path.sep) && existsSync(from)
        ? claimName(path.basename(from), taken)
        : null;
    if (!filename) {
      missing.push(src);
      continue;
    }
    images.set(src, { source: src, ident: identFor(images.size), filename });
    staged.push({ from, filename });
  }

  const fallbackName = sourceFile ? path.basename(sourceFile).replace(/\.mdx?$/i, '') : 'document';
  return writeImport(ctx, { parsed, fallbackName, images, staged, missing }, opts);
}

export type ImportDocxOptions = Omit<ImportMarkdownOptions, 'markdown' | 'file'> & {
  /** Path to a `.docx` file, relative to the workspace root. */
  file: string;
};

export type ImportDocxResult = ImportResult & {
  /** What Word drew that could not come across, by kind — charts, text boxes, equations. */
  skipped: Record<string, number>;
};

/**
 * Reads a Word document and writes it as a MoSage document the same way a
 * markdown import does, with its pictures copied into `assets/images/`.
 */
export async function importDocx(
  ctx: ApiContext,
  opts: ImportDocxOptions,
): Promise<ImportDocxResult> {
  const sourceFile = resolveSourceFile(ctx, opts.file);
  if (!sourceFile) throw new OpsError(400, 'pass the `.docx` file to import');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await fs.readFile(sourceFile));
  } catch {
    throw new OpsError(404, `file not found: ${opts.file}`);
  }

  let parsed: ReturnType<typeof parseDocx>;
  try {
    parsed = parseDocx(bytes);
  } catch (err) {
    throw new OpsError(422, (err as Error).message);
  }
  if (parsed.blocks.length === 0)
    throw new OpsError(422, 'the Word document has no text to import');

  const images = new Map<string, ImportImage>();
  const staged: StagedImage[] = [];
  const missing: string[] = [];
  const taken = new Set<string>();
  for (const src of new Set(collectImageSources(parsed.blocks))) {
    const media = parsed.media.get(src);
    const filename = media ? claimName(media.filename, taken) : null;
    if (!media || !filename) {
      missing.push(src);
      continue;
    }
    images.set(src, { source: src, ident: identFor(images.size), filename });
    staged.push({ filename, bytes: media.bytes });
  }

  const fallbackName = path.basename(sourceFile).replace(/\.docx$/i, '');
  const result = await writeImport(ctx, { parsed, fallbackName, images, staged, missing }, opts);
  return { ...result, skipped: parsed.skipped };
}
