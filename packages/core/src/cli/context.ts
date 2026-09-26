import { loadUserConfig } from '../vite/mosage-plugin.ts';
import { type ApiContext, makeContext } from '../vite/routes/context.ts';
import { readCoreVersion } from './package-version.ts';

/** The same context the dev API runs on, for commands that call `ops/`. */
export async function cliContext(userCwd = process.cwd()): Promise<ApiContext> {
  const config = await loadUserConfig(userCwd);
  return makeContext({
    userCwd,
    docsDir: config.docsDir ?? 'docs',
    assetsDir: config.assetsDir ?? 'assets',
    coreVersion: await readCoreVersion(),
  });
}
