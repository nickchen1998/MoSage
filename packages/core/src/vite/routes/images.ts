import type { ViteDevServer } from 'vite';
import { readSettings } from '../../files/settings.ts';
import { validateMutationRequest } from '../../http/request-guard.ts';
import { OpsError } from '../../ops/documents.ts';
import { generateImage, listImagePrompts, placeImage } from '../../ops/images.ts';
import { DOC_ID_RE } from '../mosage-plugin.ts';
import { type ApiContext, json, readBody } from './context.ts';

// GET    /__images?docId=         the <ImagePrompt>s still in one document (or all)
// POST   /__images/generate       draw one through the OpenAI API { docId, id }
// POST   /__images/place          swap a prompt for the image already on disk { docId, id }

export function registerImageRoutes(server: ViteDevServer, ctx: ApiContext): void {
  server.middlewares.use('/__images', async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';

    try {
      if (url.pathname === '/' && method === 'GET') {
        const docId = url.searchParams.get('docId') ?? undefined;
        if (docId !== undefined && !DOC_ID_RE.test(docId)) {
          return json(res, 400, { error: 'invalid docId' });
        }
        const settings = await readSettings(ctx.userCwd);
        return json(res, 200, {
          mode: settings.imageGeneration.mode,
          prompts: await listImagePrompts(ctx, docId),
        });
      }

      if ((url.pathname === '/generate' || url.pathname === '/place') && method === 'POST') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const body = (await readBody(req)) as { docId?: unknown; id?: unknown };
        if (typeof body.docId !== 'string' || !DOC_ID_RE.test(body.docId)) {
          return json(res, 400, { error: 'invalid docId' });
        }
        if (typeof body.id !== 'string') return json(res, 400, { error: 'invalid id' });
        const result =
          url.pathname === '/generate'
            ? await generateImage(ctx, body.docId, body.id)
            : await placeImage(ctx, body.docId, body.id);
        return json(res, 200, result);
      }

      return next();
    } catch (err) {
      if (err instanceof OpsError) return json(res, err.status, { error: err.message });
      json(res, 500, { error: String((err as Error).message ?? err) });
    }
  });
}
