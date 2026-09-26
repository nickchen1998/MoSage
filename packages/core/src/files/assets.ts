import path from 'node:path';
import { DOC_ID_RE } from '../vite/mosage-plugin.ts';

export const GLOBAL_SCOPE = '@global';
export const ASSET_MAX_BYTES = 25 * 1024 * 1024;

// biome-ignore lint/suspicious/noControlCharactersInRegex: explicit control-char block list for filename safety
const ASSET_FORBIDDEN_RE = /[\x00-\x1F\x7F/\\:*?"<>|]/;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  bib: 'text/plain; charset=utf-8',
  tex: 'text/plain; charset=utf-8',
  yaml: 'text/plain; charset=utf-8',
  yml: 'text/plain; charset=utf-8',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/**
 * Headers for serving an asset from the dev server's own origin. A page
 * rendered here could call the API that writes to the project, so only types
 * that cannot run script render inline; SVG renders under a sandbox, and
 * anything else — an uploaded `.html` above all — arrives as a download.
 */
export function assetResponseHeaders(mime: string, filename: string): Record<string, string> {
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (mime === 'image/svg+xml') {
    return {
      ...headers,
      'content-type': mime,
      'content-security-policy':
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    };
  }
  const inline =
    mime.startsWith('image/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    mime.startsWith('text/') ||
    mime.startsWith('font/') ||
    mime === 'application/pdf' ||
    mime === 'application/json';
  if (inline) return { ...headers, 'content-type': mime };
  return {
    ...headers,
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}

export function mimeForFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  return MIME_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? 'application/octet-stream';
}

export function assetCreatedAt(birthtimeMs: number, mtimeMs: number): number {
  return Number.isFinite(birthtimeMs) && birthtimeMs > 0 ? birthtimeMs : mtimeMs;
}

export function validateAssetName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return null;
  // No path separators, control chars, or characters Windows/macOS can't store.
  if (ASSET_FORBIDDEN_RE.test(trimmed)) return null;
  // Block leading dots / tildes (hidden files, home expansion) and any `..` segment.
  if (trimmed.startsWith('.') || trimmed.startsWith('~')) return null;
  if (trimmed === '..' || trimmed.split(/[/\\]/).includes('..')) return null;
  // Require an extension so authors get sensible MIME / dev-server behavior.
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  return trimmed;
}

/** Images, filed into one sub-folder per chapter. */
export const IMAGES_DIR = 'images';
/** Everything that is not an image — papers, data, notes the author works from. */
export const REFERENCES_DIR = 'references';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif']);

export function isImageFilename(name: string): boolean {
  const dot = name.lastIndexOf('.');
  return dot > 0 && IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/** A chapter folder: the same character rules as a file name, no extension needed. */
export function validateFolderName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return null;
  if (ASSET_FORBIDDEN_RE.test(trimmed)) return null;
  if (trimmed.startsWith('.') || trimmed.startsWith('~')) return null;
  return trimmed;
}

/** Turns a heading such as `第二章：市場分析` into a folder name it can be stored under. */
export function folderNameFromHeading(text: string): string | null {
  const cleaned = text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: same block list as file names
    .replace(/[\x00-\x1F\x7F/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.~\s]+/, '')
    .trim()
    .slice(0, 80)
    .trim();
  return validateFolderName(cleaned);
}

/** Which of the two collections a file belongs to. */
export type AssetKind = 'image' | 'reference';

export type AssetPath = {
  /** Relative to the scope's assets folder, `/`-separated. */
  path: string;
  name: string;
  kind: AssetKind;
  /** The chapter an image is filed under; null when it has none. */
  chapter: string | null;
};

/**
 * Validates the path of a file inside an assets folder. The shapes are
 * `images/<chapter>/<file>`, `images/<file>`, `references/<file>`, and a bare
 * `<file>` — where documents written before the split keep theirs.
 */
export function parseAssetPath(segments: string[]): AssetPath | null {
  const name = validateAssetName(segments[segments.length - 1]);
  if (!name) return null;
  if (segments.length === 1) {
    return { path: name, name, kind: isImageFilename(name) ? 'image' : 'reference', chapter: null };
  }
  const [collection] = segments;
  if (collection === IMAGES_DIR) {
    if (!isImageFilename(name)) return null;
    if (segments.length === 2)
      return { path: `${IMAGES_DIR}/${name}`, name, kind: 'image', chapter: null };
    const chapter = segments.length === 3 ? validateFolderName(segments[1]) : null;
    if (!chapter) return null;
    return { path: `${IMAGES_DIR}/${chapter}/${name}`, name, kind: 'image', chapter };
  }
  if (collection === REFERENCES_DIR && segments.length === 2) {
    return { path: `${REFERENCES_DIR}/${name}`, name, kind: 'reference', chapter: null };
  }
  return null;
}

/** Where an uploaded file goes: images into their chapter, anything else into references. */
export function uploadPathFor(filename: string, chapter: string | null): AssetPath | null {
  const name = validateAssetName(filename);
  if (!name) return null;
  if (!isImageFilename(name)) return parseAssetPath([REFERENCES_DIR, name]);
  return parseAssetPath(chapter ? [IMAGES_DIR, chapter, name] : [IMAGES_DIR, name]);
}

export function resolveScopedAssetPath(
  docsRoot: string,
  globalAssetsRoot: string,
  scope: string,
  relative: string,
): string | null {
  const parsed = parseAssetPath(relative.split('/'));
  if (!parsed) return null;
  const dir = resolveScopedAssetsDir(docsRoot, globalAssetsRoot, scope);
  if (!dir) return null;
  const file = path.resolve(dir, ...parsed.path.split('/'));
  if (!file.startsWith(dir + path.sep)) return null;
  return file;
}

/**
 * Rewrites quoted asset paths in a document's source — a moved file or a
 * renamed chapter — and reports how many references it changed.
 */
export function rewriteAssetReferences(
  source: string,
  rewrite: (importPath: string) => string | null,
): { source: string; count: number } {
  let count = 0;
  const next = source.replace(
    /(['"`])((?:\.\/assets\/|@assets\/)[^'"`\n]+)\1/g,
    (match, quote: string, importPath: string) => {
      const replaced = rewrite(importPath);
      if (replaced === null || replaced === importPath) return match;
      count++;
      return `${quote}${replaced}${quote}`;
    },
  );
  return { source: next, count };
}

export function resolveAssetsDir(docsRoot: string, docId: string): string | null {
  if (!DOC_ID_RE.test(docId)) return null;
  const docDir = path.resolve(docsRoot, docId);
  if (!docDir.startsWith(docsRoot + path.sep)) return null;
  const assetsDir = path.resolve(docDir, 'assets');
  if (assetsDir !== path.join(docDir, 'assets')) return null;
  return assetsDir;
}

export function resolveScopedAssetsDir(
  docsRoot: string,
  globalAssetsRoot: string,
  scope: string,
): string | null {
  if (scope === GLOBAL_SCOPE) return globalAssetsRoot;
  return resolveAssetsDir(docsRoot, scope);
}

export function resolveScopedAssetFile(
  docsRoot: string,
  globalAssetsRoot: string,
  scope: string,
  filename: string,
): string | null {
  if (!validateAssetName(filename)) return null;
  const dir = resolveScopedAssetsDir(docsRoot, globalAssetsRoot, scope);
  if (!dir) return null;
  const file = path.resolve(dir, filename);
  if (!file.startsWith(dir + path.sep)) return null;
  return file;
}

/** How a document imports an asset — the string we look for when counting usages. */
export function assetImportPath(scope: string, filename: string): string {
  return scope === GLOBAL_SCOPE ? `@assets/${filename}` : `./assets/${filename}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Counts references to an asset in a document's source. Matches the quoted path
 * in both import statements and `new URL('./assets/x.png', import.meta.url)`,
 * which is every form the authoring skill sanctions.
 */
export function countAssetUsages(source: string, importPath: string): number {
  const quoted = new RegExp(`(['"\`])${escapeRegExp(importPath)}\\1`, 'g');
  return source.match(quoted)?.length ?? 0;
}

export function findReferencedAssets(source: string, importPaths: string[]): string[] {
  return importPaths.filter((p) => countAssetUsages(source, p) > 0);
}
