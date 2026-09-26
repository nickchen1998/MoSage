import fs from 'node:fs/promises';
import path from 'node:path';
import type { ViteDevServer } from 'vite';
import {
  ASSET_MAX_BYTES,
  assetCreatedAt,
  assetImportPath,
  countAssetUsages,
  findReferencedAssets,
  GLOBAL_SCOPE,
  mimeForFilename,
  resolveScopedAssetFile,
  resolveScopedAssetsDir,
  validateAssetName,
} from '../../files/assets.ts';
import { validateMutationRequest } from '../../http/request-guard.ts';
import { DOC_ID_RE } from '../open-doc-plugin.ts';
import { type ApiContext, json, readBody, resolveDocEntry } from './context.ts';

// GET    /__assets/:scope                list assets in a document or @global
// GET    /__assets/:scope/:file          serve raw asset bytes
// POST   /__assets/:scope/:file          upload (raw body, ?overwrite=1)
// PATCH  /__assets/:scope/:file          rename { name }
// DELETE /__assets/:scope/:file          delete
// GET    /__assets/:scope/:file/usages   count references from document sources

async function listDocIds(docsRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(docsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && DOC_ID_RE.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readDocSource(docsRoot: string, docId: string): Promise<string | null> {
  const entry = resolveDocEntry(docsRoot, docId);
  if (!entry) return null;
  try {
    return await fs.readFile(entry, 'utf8');
  } catch {
    return null;
  }
}

export function registerAssetRoutes(server: ViteDevServer, ctx: ApiContext): void {
  server.middlewares.use('/__assets', async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';

    try {
      const listMatch = url.pathname.match(/^\/([^/]+)\/?$/);
      const fileMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)$/);
      const usagesMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)\/usages$/);

      if (usagesMatch && method === 'GET') {
        const scope = decodeURIComponent(usagesMatch[1]);
        const filename = decodeURIComponent(usagesMatch[2]);
        if (!validateAssetName(filename)) return json(res, 400, { error: 'invalid path' });

        const isGlobal = scope === GLOBAL_SCOPE;
        if (!isGlobal && !DOC_ID_RE.test(scope)) return json(res, 400, { error: 'invalid scope' });

        const importPath = assetImportPath(scope, filename);
        const docIds = isGlobal ? await listDocIds(ctx.docsRoot) : [scope];

        const usages: Array<{ docId: string; count: number }> = [];
        let totalCount = 0;
        for (const docId of docIds) {
          const source = await readDocSource(ctx.docsRoot, docId);
          if (source === null) continue;
          const count = countAssetUsages(source, importPath);
          if (count > 0) {
            usages.push({ docId, count });
            totalCount += count;
          }
        }
        return json(res, 200, { usages, totalCount });
      }

      if (listMatch && method === 'GET') {
        const scope = decodeURIComponent(listMatch[1]);
        const scopedDir = resolveScopedAssetsDir(ctx.docsRoot, ctx.globalAssetsRoot, scope);
        if (!scopedDir) return json(res, 400, { error: 'invalid scope' });

        let entries: string[];
        try {
          entries = await fs.readdir(scopedDir);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return json(res, 200, { assets: [] });
          }
          throw err;
        }

        const assets: Array<{
          name: string;
          size: number;
          createdAt: number;
          mtime: number;
          mime: string;
          url: string;
          importPath: string;
          unused: boolean;
        }> = [];
        for (const name of entries) {
          if (!validateAssetName(name)) continue;
          const stat = await fs.stat(path.join(scopedDir, name));
          if (!stat.isFile()) continue;
          assets.push({
            name,
            size: stat.size,
            createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
            mtime: stat.mtimeMs,
            mime: mimeForFilename(name),
            url: `/__assets/${encodeURIComponent(scope)}/${encodeURIComponent(name)}`,
            importPath: assetImportPath(scope, name),
            unused: true,
          });
        }
        assets.sort((a, b) => a.name.localeCompare(b.name));

        if (assets.length > 0) {
          const isGlobal = scope === GLOBAL_SCOPE;
          const scanIds = isGlobal ? await listDocIds(ctx.docsRoot) : [scope];
          const pathToAsset = new Map(assets.map((a) => [a.importPath, a]));
          const paths = assets.map((a) => a.importPath);
          for (const docId of scanIds) {
            const source = await readDocSource(ctx.docsRoot, docId);
            if (source === null) continue;
            for (const p of findReferencedAssets(source, paths)) {
              const asset = pathToAsset.get(p);
              if (asset) asset.unused = false;
            }
          }
        }

        return json(res, 200, { assets });
      }

      if (fileMatch) {
        const scope = decodeURIComponent(fileMatch[1]);
        const filename = decodeURIComponent(fileMatch[2]);
        const file = resolveScopedAssetFile(ctx.docsRoot, ctx.globalAssetsRoot, scope, filename);
        if (!file) return json(res, 400, { error: 'invalid path' });

        if (method === 'GET') {
          try {
            const buf = await fs.readFile(file);
            res.statusCode = 200;
            res.setHeader('content-type', mimeForFilename(filename));
            res.setHeader('cache-control', 'no-store');
            res.end(buf);
            return;
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              return json(res, 404, { error: 'asset not found' });
            }
            throw err;
          }
        }

        if (method === 'POST') {
          const requestCheck = validateMutationRequest(req);
          if (!requestCheck.ok)
            return json(res, requestCheck.status, { error: requestCheck.error });

          const overwrite = url.searchParams.get('overwrite') === '1';
          const lenHeader = req.headers['content-length'];
          const len = typeof lenHeader === 'string' ? Number(lenHeader) : NaN;
          if (Number.isFinite(len) && len > ASSET_MAX_BYTES) {
            return json(res, 413, { error: 'file too large' });
          }

          if (!overwrite) {
            try {
              await fs.access(file);
              return json(res, 409, { error: 'asset exists' });
            } catch {
              // fall through — file does not exist, OK to write
            }
          }

          const scopedDir = resolveScopedAssetsDir(ctx.docsRoot, ctx.globalAssetsRoot, scope);
          if (!scopedDir) return json(res, 400, { error: 'invalid scope' });
          await fs.mkdir(scopedDir, { recursive: true });

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
            req.on('error', reject);
          });
          if (oversized) return json(res, 413, { error: 'file too large' });

          await fs.writeFile(file, Buffer.concat(chunks));
          const stat = await fs.stat(file);
          return json(res, 200, {
            ok: true,
            name: filename,
            size: stat.size,
            createdAt: assetCreatedAt(stat.birthtimeMs, stat.mtimeMs),
            mtime: stat.mtimeMs,
            mime: mimeForFilename(filename),
            url: `/__assets/${encodeURIComponent(scope)}/${encodeURIComponent(filename)}`,
            importPath: assetImportPath(scope, filename),
          });
        }

        if (method === 'PATCH') {
          const requestCheck = validateMutationRequest(req, { requireJsonBody: true });
          if (!requestCheck.ok)
            return json(res, requestCheck.status, { error: requestCheck.error });

          const body = (await readBody(req)) as { name?: unknown };
          const target = validateAssetName(body.name);
          if (!target) return json(res, 400, { error: 'invalid name' });
          if (target === filename) return json(res, 200, { ok: true, name: filename });

          const dest = resolveScopedAssetFile(ctx.docsRoot, ctx.globalAssetsRoot, scope, target);
          if (!dest) return json(res, 400, { error: 'invalid name' });

          try {
            await fs.access(dest);
            return json(res, 409, { error: 'target exists' });
          } catch {
            // OK — destination is free
          }

          try {
            await fs.rename(file, dest);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              return json(res, 404, { error: 'asset not found' });
            }
            throw err;
          }
          return json(res, 200, { ok: true, name: target });
        }

        if (method === 'DELETE') {
          const requestCheck = validateMutationRequest(req);
          if (!requestCheck.ok)
            return json(res, requestCheck.status, { error: requestCheck.error });
          try {
            await fs.unlink(file);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              return json(res, 404, { error: 'asset not found' });
            }
            throw err;
          }
          return json(res, 200, { ok: true });
        }
      }

      return next();
    } catch (err) {
      json(res, 500, { error: String((err as Error).message ?? err) });
    }
  });
}
