import type { ViteDevServer } from 'vite';
import { isCodeHost } from '../../app/lib/code-remote.ts';
import { validateMutationRequest } from '../../http/request-guard.ts';
import { codeStatus, codeTree, connectCode, pushCode, readCodeFile } from '../../ops/code.ts';
import { OpsError } from '../../ops/documents.ts';
import { refreshCode } from '../code-plugin.ts';
import { type ApiContext, json, readBody } from './context.ts';

// GET    /__code                  code/'s repository: origin, branch, pushed commit, what differs
// GET    /__code/tree             every file in code/, each marked against the pushed commit
// GET    /__code/file?path=       one file's text, and its link on GitHub or GitLab
// POST   /__code/connect          make code/ a repository with this origin { url?, host? }
// POST   /__code/push             commit everything in code/ and push it { message }

export function registerCodeRoutes(server: ViteDevServer, ctx: ApiContext): void {
  server.middlewares.use('/__code', async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';

    try {
      if (url.pathname === '/' && method === 'GET') {
        return json(res, 200, await codeStatus(ctx));
      }
      if (url.pathname === '/tree' && method === 'GET') {
        return json(res, 200, await codeTree(ctx));
      }
      if (url.pathname === '/file' && method === 'GET') {
        return json(res, 200, await readCodeFile(ctx, url.searchParams.get('path') ?? ''));
      }

      if (url.pathname === '/connect' && method === 'POST') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const body = (await readBody(req)) as { url?: unknown; host?: unknown };
        if (body.url !== undefined && typeof body.url !== 'string') {
          return json(res, 400, { error: 'invalid url' });
        }
        if (body.host !== undefined && body.host !== null && !isCodeHost(body.host)) {
          return json(res, 400, { error: 'host must be github or gitlab' });
        }
        const status = await connectCode(ctx, {
          ...(typeof body.url === 'string' ? { url: body.url } : {}),
          ...(body.host !== undefined ? { host: body.host } : {}),
        });
        await refreshCode(server);
        return json(res, 200, status);
      }

      if (url.pathname === '/push' && method === 'POST') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const body = (await readBody(req)) as { message?: unknown };
        const message = typeof body.message === 'string' ? body.message : '';
        const result = await pushCode(ctx, message);
        await refreshCode(server);
        return json(res, 200, result);
      }

      return next();
    } catch (err) {
      if (err instanceof OpsError) return json(res, err.status, { error: err.message });
      json(res, 500, { error: String((err as Error).message ?? err) });
    }
  });
}
