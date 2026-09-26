import path from 'node:path';
import type { ViteDevServer } from 'vite';
import {
  applySettingsPatch,
  IMAGE_GENERATION_MODES,
  IMAGE_QUALITIES,
  readSettings,
  writeSettings,
} from '../../files/settings.ts';
import {
  maskKey,
  readOpenAiKey,
  removeOpenAiKey,
  saveOpenAiKey,
  validateOpenAiKey,
} from '../../files/user-data.ts';
import { validateMutationRequest } from '../../http/request-guard.ts';
import { IMAGE_MODEL_PRICES, IMAGE_MODELS, PRICES_AS_OF } from '../../images/pricing.ts';
import { readUsage, totalsOf } from '../../images/usage.ts';
import { fetchLatestVersion, isNewerVersion } from '../../versions.ts';
import { type ApiContext, json, readBody } from './context.ts';

// GET    /__settings              project settings + key status + choices
// PATCH  /__settings              update { imageGeneration: { mode?, model?, quality?, documents? } }
// PUT    /__settings/openai-key   save the key on this machine { key }
// DELETE /__settings/openai-key   forget the saved key
// GET    /__settings/usage        OpenAI image usage across every project on this machine
// GET    /__settings/version      installed and latest mosage version

export const SETTINGS_CHANGED_EVENT = 'mosage:settings-changed';

async function keyStatus() {
  const key = await readOpenAiKey();
  return key
    ? { configured: true, source: key.source, hint: maskKey(key.key) }
    : { configured: false };
}

export function registerSettingsRoutes(server: ViteDevServer, ctx: ApiContext): void {
  const changed = () => server.ws.send({ type: 'custom', event: SETTINGS_CHANGED_EVENT, data: {} });

  server.middlewares.use('/__settings', async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const method = req.method ?? 'GET';

    try {
      if (url.pathname === '/' && method === 'GET') {
        return json(res, 200, {
          settings: await readSettings(ctx.userCwd),
          openai: await keyStatus(),
          choices: {
            modes: IMAGE_GENERATION_MODES,
            models: IMAGE_MODELS,
            qualities: IMAGE_QUALITIES,
            prices: IMAGE_MODEL_PRICES,
            pricesAsOf: PRICES_AS_OF,
          },
        });
      }

      if (url.pathname === '/' && method === 'PATCH') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const next = applySettingsPatch(await readSettings(ctx.userCwd), await readBody(req));
        if (!next) return json(res, 400, { error: 'invalid settings' });
        await writeSettings(ctx.userCwd, next);
        changed();
        return json(res, 200, { settings: next });
      }

      if (url.pathname === '/openai-key' && method === 'PUT') {
        const check = validateMutationRequest(req, { requireJsonBody: true });
        if (!check.ok) return json(res, check.status, { error: check.error });
        const key = validateOpenAiKey(((await readBody(req)) as { key?: unknown }).key);
        if (!key) return json(res, 400, { error: 'that does not look like an OpenAI API key' });
        await saveOpenAiKey(key);
        changed();
        return json(res, 200, { openai: await keyStatus() });
      }

      if (url.pathname === '/openai-key' && method === 'DELETE') {
        const check = validateMutationRequest(req);
        if (!check.ok) return json(res, check.status, { error: check.error });
        await removeOpenAiKey();
        changed();
        return json(res, 200, { openai: await keyStatus() });
      }

      if (url.pathname === '/usage' && method === 'GET') {
        const all = await readUsage();
        return json(res, 200, {
          totals: totalsOf(all),
          // The folder name is enough to tell projects apart; full paths stay out of the page.
          recent: all
            .slice(-20)
            .reverse()
            .map((entry) => ({ ...entry, project: path.basename(entry.project) })),
        });
      }

      if (url.pathname === '/version' && method === 'GET') {
        const latest = await fetchLatestVersion();
        return json(res, 200, {
          current: ctx.coreVersion,
          latest,
          updateAvailable: latest !== null && isNewerVersion(latest, ctx.coreVersion),
        });
      }

      return next();
    } catch (err) {
      json(res, 500, { error: String((err as Error).message ?? err) });
    }
  });
}
