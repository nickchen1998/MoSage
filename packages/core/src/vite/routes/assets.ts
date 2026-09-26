import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ViteDevServer } from 'vite';
import {
  ASSET_MAX_BYTES,
  type AssetPath,
  assetCreatedAt,
  assetImportPath,
  assetResponseHeaders,
  countAssetUsages,
  findReferencedAssets,
  GLOBAL_SCOPE,
  IMAGES_DIR,
  mimeForFilename,
  parseAssetPath,
  REFERENCES_DIR,
  resolveScopedAssetPath,
  resolveScopedAssetsDir,
  rewriteAssetReferences,
  validateFolderName,
} from '../../files/assets.ts';
import { validateMutationRequest } from '../../http/request-guard.ts';
import { DOC_ID_RE } from '../mosage-plugin.ts';
import { type ApiContext, json, readBody, resolveDocEntry } from './context.ts';

// GET    /__assets/:scope                              list { assets, chapters }
// GET    /__assets/:scope/<path>                       serve raw bytes
// POST   /__assets/:scope/<path>                       upload (raw body, ?overwrite=1)
// POST   /__assets/:scope/images/<chapter>?folder=1    create a chapter folder
// PATCH  /__assets/:scope/<path>                       move or rename { path } — rewrites imports
// PATCH  /__assets/:scope/images/<chapter>?folder=1    rename a chapter { name } — rewrites imports
// DELETE /__assets/:scope/<path>                       delete
// DELETE /__assets/:scope/images/<chapter>?folder=1    delete an empty chapter
// GET    /__assets/:scope/<path>/usages                count references from document sources
//
// <path> is `images/<chapter>/<file>`, `images/<file>`, `references/<file>`, or
// a bare `<file>` from before images and references were split.

export const FILES_CHANGED_EVENT = 'mosage:files-changed';

type ListedAsset = AssetPath & {
  size: number;
  createdAt: number;
  mtime: number;
  mime: string;
  url: string;
  importPath: string;
  unused: boolean;
};

async function listDocIds(docsRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(docsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && DOC_ID_RE.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readDir(dir: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

function assetUrl(scope: string, relative: string): string {
  return `/__assets/${encodeURIComponent(scope)}/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

/** The documents whose imports a change in this scope can affect. */
async function scopeDocIds(ctx: ApiContext, scope: string): Promise<string[]> {
  return scope === GLOBAL_SCOPE ? await listDocIds(ctx.docsRoot) : [scope];
}

async function rewriteReferences(
  ctx: ApiContext,
  scope: string,
  rewrite: (importPath: string) => string | null,
): Promise<number> {
  let total = 0;
  for (const docId of await scopeDocIds(ctx, scope)) {
    const entry = resolveDocEntry(ctx.docsRoot, docId);
    if (!entry) continue;
    const source = await fs.readFile(entry, 'utf8');
    const { source: next, count } = rewriteAssetReferences(source, rewrite);
    if (count > 0) {
      await fs.writeFile(entry, next, 'utf8');
      total += count;
    }
  }
  return total;
}

async function listScope(ctx: ApiContext, scope: string, dir: string) {
  const found: AssetPath[] = [];
  const chapters: string[] = [];
  const take = (segments: string[]) => {
    const parsed = parseAssetPath(segments);
    if (parsed) found.push(parsed);
  };

  for (const entry of await readDir(dir)) {
    if (entry.isFile()) take([entry.name]);
    else if (entry.isDirectory() && entry.name === REFERENCES_DIR) {
      for (const file of await readDir(path.join(dir, REFERENCES_DIR))) {
        if (file.isFile()) take([REFERENCES_DIR, file.name]);
      }
    } else if (entry.isDirectory() && entry.name === IMAGES_DIR) {
      for (const child of await readDir(path.join(dir, IMAGES_DIR))) {
        if (child.isFile()) take([IMAGES_DIR, child.name]);
        const chapter = child.isDirectory() ? validateFolderName(child.name) : null;
        if (!chapter || chapter !== child.name) continue;
        chapters.push(chapter);
        for (const file of await readDir(path.join(dir, IMAGES_DIR, chapter))) {
          if (file.isFile()) take([IMAGES_DIR, chapter, file.name]);
        }
      }
    }
  }

  const assets: ListedAsset[] = [];
  for (const asset of found) {
    const stat = await fs.stat(path.join(dir, ...asset.path.split('/')));
    assets.push({
      ...asset,
      size: stat.size,
      createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
      mtime: stat.mtimeMs,
      mime: mimeForFilename(asset.name),
      url: assetUrl(scope, asset.path),
      importPath: assetImportPath(scope, asset.path),
      unused: true,
    });
  }
  assets.sort((a, b) => a.path.localeCompare(b.path));

  if (assets.length > 0) {
    const byPath = new Map(assets.map((a) => [a.importPath, a]));
    const paths = assets.map((a) => a.importPath);
    for (const docId of await scopeDocIds(ctx, scope)) {
      const entry = resolveDocEntry(ctx.docsRoot, docId);
      if (!entry) continue;
      const source = await fs.readFile(entry, 'utf8');
      for (const p of findReferencedAssets(source, paths)) {
        const asset = byPath.get(p);
        if (asset) asset.unused = false;
      }
    }
  }

  chapters.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { assets, chapters };
}

async function readUpload(req: import('vite').Connect.IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  let oversized = false;
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > ASSET_MAX_BYTES) {
        oversized = true;
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve());
    req.on('close', () => resolve());
    req.on('error', reject);
  });
  return oversized ? null : Buffer.concat(chunks);
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export function registerAssetRoutes(server: ViteDevServer, ctx: ApiContext): void {
  const changed = () => server.ws.send({ type: 'custom', event: FILES_CHANGED_EVENT, data: {} });

  server.middlewares.use('/__assets', async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';

    try {
      const segments = url.pathname
        .split('/')
        .filter(Boolean)
        .map((s) => decodeURIComponent(s));
      if (segments.length === 0) return next();
      const [scope, ...rest] = segments;
      const scopedDir = resolveScopedAssetsDir(ctx.docsRoot, ctx.globalAssetsRoot, scope);
      if (!scopedDir) return json(res, 400, { error: 'invalid scope' });

      if (rest.length === 0) {
        if (method !== 'GET') return next();
        return json(res, 200, await listScope(ctx, scope, scopedDir));
      }

      // A chapter folder, addressed as `images/<chapter>` with ?folder=1.
      if (url.searchParams.get('folder') === '1') {
        const chapter =
          rest.length === 2 && rest[0] === IMAGES_DIR ? validateFolderName(rest[1]) : null;
        if (!chapter) return json(res, 400, { error: 'invalid chapter' });
        const folder = path.join(scopedDir, IMAGES_DIR, chapter);
        const check = validateMutationRequest(req, { requireJsonBody: method === 'PATCH' });
        if (!check.ok) return json(res, check.status, { error: check.error });

        if (method === 'POST') {
          await fs.mkdir(folder, { recursive: true });
          changed();
          return json(res, 200, { ok: true, chapter });
        }
        if (method === 'PATCH') {
          const target = validateFolderName(((await readBody(req)) as { name?: unknown }).name);
          if (!target) return json(res, 400, { error: 'invalid name' });
          if (target === chapter) return json(res, 200, { ok: true, chapter, updated: 0 });
          const dest = path.join(scopedDir, IMAGES_DIR, target);
          if (await exists(dest)) return json(res, 409, { error: 'target exists' });
          if (!(await exists(folder))) return json(res, 404, { error: 'chapter not found' });
          await fs.rename(folder, dest);
          const from = assetImportPath(scope, `${IMAGES_DIR}/${chapter}/`);
          const to = assetImportPath(scope, `${IMAGES_DIR}/${target}/`);
          const updated = await rewriteReferences(ctx, scope, (p) =>
            p.startsWith(from) ? to + p.slice(from.length) : null,
          );
          changed();
          return json(res, 200, { ok: true, chapter: target, updated });
        }
        if (method === 'DELETE') {
          try {
            await fs.rmdir(folder);
          } catch (err) {
            const code = (err as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return json(res, 404, { error: 'chapter not found' });
            if (code === 'ENOTEMPTY' || code === 'EEXIST') {
              return json(res, 409, { error: 'chapter is not empty' });
            }
            throw err;
          }
          changed();
          return json(res, 200, { ok: true });
        }
        return next();
      }

      if (method === 'GET' && rest.length > 1 && rest[rest.length - 1] === 'usages') {
        const asset = parseAssetPath(rest.slice(0, -1));
        if (!asset) return json(res, 400, { error: 'invalid path' });
        const importPath = assetImportPath(scope, asset.path);
        const usages: Array<{ docId: string; count: number }> = [];
        let totalCount = 0;
        for (const docId of await scopeDocIds(ctx, scope)) {
          const entry = resolveDocEntry(ctx.docsRoot, docId);
          if (!entry) continue;
          const count = countAssetUsages(await fs.readFile(entry, 'utf8'), importPath);
          if (count > 0) {
            usages.push({ docId, count });
            totalCount += count;
          }
        }
        return json(res, 200, { usages, totalCount });
      }

      const asset = parseAssetPath(rest);
      const file = asset
        ? resolveScopedAssetPath(ctx.docsRoot, ctx.globalAssetsRoot, scope, asset.path)
        : null;
      if (!asset || !file) return json(res, 400, { error: 'invalid path' });

      if (method === 'GET') {
        let buf: Buffer;
        try {
          buf = await fs.readFile(file);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return json(res, 404, { error: 'asset not found' });
          }
          throw err;
        }
        res.statusCode = 200;
        for (const [k, v] of Object.entries(
          assetResponseHeaders(mimeForFilename(asset.name), asset.name),
        )) {
          res.setHeader(k, v);
        }
        res.end(buf);
        return;
      }

      if (method === 'POST') {
        const check = validateMutationRequest(req);
        if (!check.ok) return json(res, check.status, { error: check.error });
        const len = Number(req.headers['content-length']);
        if (Number.isFinite(len) && len > ASSET_MAX_BYTES) {
          return json(res, 413, { error: 'file too large' });
        }
        if (url.searchParams.get('overwrite') !== '1' && (await exists(file))) {
          return json(res, 409, { error: 'asset exists' });
        }
        const body = await readUpload(req);
        if (!body) return json(res, 413, { error: 'file too large' });
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, body);
        const stat = await fs.stat(file);
        changed();
        return json(res, 200, {
          ok: true,
          ...asset,
          size: stat.size,
          createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
          mtime: stat.mtimeMs,
          mime: mimeForFilename(asset.name),
          url: assetUrl(scope, asset.path),
          importPath: assetImportPath(scope, asset.path),
        });
      }

      if (method === 'PATCH') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const body = (await readBody(req)) as { path?: unknown; name?: unknown };
        // `name` renames in place; `path` can also move to another chapter.
        const wanted =
          typeof body.path === 'string'
            ? body.path.split('/')
            : typeof body.name === 'string'
              ? [...asset.path.split('/').slice(0, -1), body.name.trim()]
              : null;
        const target = wanted ? parseAssetPath(wanted) : null;
        if (!target || target.kind !== asset.kind) return json(res, 400, { error: 'invalid name' });
        if (target.path === asset.path)
          return json(res, 200, { ok: true, path: asset.path, updated: 0 });
        const dest = resolveScopedAssetPath(ctx.docsRoot, ctx.globalAssetsRoot, scope, target.path);
        if (!dest) return json(res, 400, { error: 'invalid name' });
        if (await exists(dest)) return json(res, 409, { error: 'target exists' });
        if (!(await exists(file))) return json(res, 404, { error: 'asset not found' });
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.rename(file, dest);
        const from = assetImportPath(scope, asset.path);
        const to = assetImportPath(scope, target.path);
        const updated = await rewriteReferences(ctx, scope, (p) => (p === from ? to : null));
        changed();
        return json(res, 200, { ok: true, path: target.path, name: target.name, updated });
      }

      if (method === 'DELETE') {
        const check = validateMutationRequest(req);
        if (!check.ok) return json(res, check.status, { error: check.error });
        try {
          await fs.unlink(file);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return json(res, 404, { error: 'asset not found' });
          }
          throw err;
        }
        changed();
        return json(res, 200, { ok: true });
      }

      return next();
    } catch (err) {
      json(res, 500, { error: String((err as Error).message ?? err) });
    }
  });
}
