import path from 'node:path';
import type { Plugin } from 'vite';
import { registerAssetRoutes } from './routes/assets.ts';
import { type ApiPluginOptions, makeContext } from './routes/context.ts';
import { registerDocRoutes } from './routes/docs.ts';
import { registerEditRoutes } from './routes/edit.ts';
import { registerFolderRoutes } from './routes/folders.ts';
import { registerImageRoutes } from './routes/images.ts';
import { registerSettingsRoutes, SETTINGS_CHANGED_EVENT } from './routes/settings.ts';

export type { ApiPluginOptions };

// All mosage dev-server endpoints in one plugin. Each file under `routes/`
// leads with a comment-block manifest of the endpoints it owns.
export function apiPlugin(opts: ApiPluginOptions): Plugin {
  return {
    name: 'mosage:api',
    apply: 'serve',
    configureServer(server) {
      const ctx = makeContext(opts);
      registerAssetRoutes(server, ctx);
      registerFolderRoutes(server, ctx);
      registerDocRoutes(server, ctx);
      registerEditRoutes(server, ctx);
      registerSettingsRoutes(server, ctx);
      registerImageRoutes(server, ctx);

      // Files that land on disk without going through the API — an image Codex
      // drew, a PDF dropped into references/ by hand — still refresh the panels.
      const assetDir = `${path.sep}assets${path.sep}`;
      const settingsFile = path.join(ctx.userCwd, '.mosage', 'settings.json');
      let timer: ReturnType<typeof setTimeout> | null = null;
      const notify = (event: string) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          server.ws.send({ type: 'custom', event, data: {} });
        }, 150);
      };
      server.watcher.add([ctx.globalAssetsRoot, settingsFile]);
      for (const kind of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) {
        server.watcher.on(kind, (file) => {
          const inDocAssets = file.startsWith(ctx.docsRoot + path.sep) && file.includes(assetDir);
          const inGlobal = file.startsWith(ctx.globalAssetsRoot + path.sep);
          if (inDocAssets || inGlobal) notify('mosage:files-changed');
        });
      }
      server.watcher.on('change', (file) => {
        if (file === settingsFile) notify(SETTINGS_CHANGED_EVENT);
      });
    },
  };
}
