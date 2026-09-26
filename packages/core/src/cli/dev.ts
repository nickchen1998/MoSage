import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { createServer, mergeConfig, type ViteDevServer } from 'vite';
import { fetchLatestVersion, isNewerVersion } from '../versions.ts';
import { createViteConfig } from '../vite/config.ts';
import { readCoreVersion } from './package-version.ts';

export interface DevOptions {
  port?: number;
  host?: string | boolean;
  open?: boolean;
}

/** Tells the author a newer MoSage exists. Runs after the server is up, so it never delays it. */
async function announceUpdate(): Promise<void> {
  const [current, latest] = await Promise.all([readCoreVersion(), fetchLatestVersion()]);
  if (!latest || !isNewerVersion(latest, current)) return;
  process.stdout.write(
    `\n  ${chalk.yellow('↑')} MoSage ${chalk.bold(latest)} is available ${chalk.dim(`(you have ${current})`)}.\n` +
      `    Press ${chalk.bold('u + enter')} to update now, or run ${chalk.cyan('npx mosage upgrade')}.\n\n`,
  );
}

/**
 * Stops the server, installs the latest version, and starts again in a new
 * process — the running one still has the old code loaded.
 */
async function updateAndRestart(server: ViteDevServer): Promise<void> {
  await server.close();
  try {
    const { upgrade } = await import('./upgrade.ts');
    await upgrade(process.cwd());
  } catch (err) {
    process.stderr.write(`${chalk.red('error:')} ${(err as Error).message}\n`);
  }
  process.stdout.write(`\n${chalk.dim('Restarting the dev server…')}\n`);
  const child = spawn(process.execPath, process.argv.slice(1), { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}

export async function dev(opts: DevOptions = {}): Promise<void> {
  const base = await createViteConfig({ userCwd: process.cwd() });
  const config = mergeConfig(base, {
    server: {
      ...(opts.port !== undefined ? { port: opts.port } : {}),
      ...(opts.host !== undefined ? { host: opts.host } : {}),
      ...(opts.open !== undefined ? { open: opts.open } : {}),
    },
  });
  const server = await createServer(config);
  await server.listen();
  server.printUrls();
  server.bindCLIShortcuts({
    print: true,
    customShortcuts: [
      {
        key: 'u',
        description: 'update MoSage to the latest version',
        action: (s) => updateAndRestart(s),
      },
    ],
  });
  void announceUpdate();
}
