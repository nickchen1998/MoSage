import path from 'node:path';
import { DOC_ID_RE } from '../vite/open-doc-plugin.ts';

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
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
};

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
