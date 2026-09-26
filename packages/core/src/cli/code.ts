import chalk from 'chalk';
import { type CodeHost, HOST_LABEL, isCodeHost } from '../app/lib/code-remote.ts';
import { type CodeStatus, codeStatus, connectCode, pushCode } from '../ops/code.ts';
import { OpsError } from '../ops/documents.ts';
import { cliContext } from './context.ts';

function fail(err: unknown): never {
  process.stderr.write(`${chalk.red('✗')} ${(err as Error).message}\n`);
  process.exit(err instanceof OpsError && err.status < 500 ? 1 : 2);
}

const STATE_MARK = { modified: chalk.yellow('M'), added: chalk.cyan('A'), deleted: chalk.red('D') };

function describe(status: CodeStatus): string {
  if (!status.exists) {
    return status.savedRemote
      ? `code/ is missing. Bring it back with ${chalk.bold('mosage code connect')} (${status.savedRemote}).`
      : `No code/ folder yet. Put files in code/, then ${chalk.bold('mosage code connect <url>')}.`;
  }
  if (!status.isRepo) {
    return `code/ is not connected. Run ${chalk.bold('mosage code connect <github-or-gitlab-url>')}.`;
  }
  const lines: string[] = [];
  if (status.remote) {
    lines.push(
      `${HOST_LABEL[status.remote.host]} ${chalk.bold(status.remote.slug)} ${chalk.dim(status.remote.webUrl)}`,
    );
  } else if (status.unsupportedRemote) {
    lines.push(
      chalk.yellow(
        `origin ${status.remoteUrl} is neither GitHub nor GitLab — excerpts print without links`,
      ),
    );
  } else {
    lines.push(chalk.yellow('No origin — excerpts print without links.'));
  }
  lines.push(
    status.pushedSha
      ? `${status.branch} at ${status.pushedSha.slice(0, 12)}${status.pushedAt ? chalk.dim(` · ${status.pushedAt}`) : ''}`
      : `${status.branch ?? 'no branch'} · never pushed`,
  );
  if (status.changes.length === 0) {
    lines.push(chalk.green('Everything is pushed.'));
  } else {
    lines.push(
      `${status.changes.length} file(s) differ from origin — ${chalk.bold('mosage code push')} publishes them:`,
    );
    for (const change of status.changes) lines.push(`  ${STATE_MARK[change.state]} ${change.path}`);
  }
  return lines.join('\n');
}

export async function showCode(opts: { json?: boolean }): Promise<void> {
  const ctx = await cliContext();
  const status = await codeStatus(ctx).catch(fail);
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${describe(status)}\n`);
}

export async function connectCodeRepo(
  url: string | undefined,
  opts: { host?: string },
): Promise<void> {
  if (opts.host !== undefined && !isCodeHost(opts.host))
    fail(new OpsError(400, '--host must be github or gitlab'));
  const ctx = await cliContext();
  const status = await connectCode(ctx, {
    ...(url ? { url } : {}),
    ...(opts.host ? { host: opts.host as CodeHost } : {}),
  }).catch(fail);
  process.stdout.write(`${chalk.green('✓')} code/ is connected\n${describe(status)}\n`);
}

export async function pushCodeRepo(opts: { message?: string }): Promise<void> {
  const ctx = await cliContext();
  const result = await pushCode(ctx, opts.message ?? 'Update code excerpts').catch(fail);
  process.stdout.write(
    `${chalk.green('✓')} ${result.committed ? 'committed and pushed' : 'pushed'} ${result.sha.slice(0, 12)}\n`,
  );
}
