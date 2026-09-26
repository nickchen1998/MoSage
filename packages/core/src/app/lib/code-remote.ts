/** Where a document's code excerpts are published. */
export const CODE_HOSTS = ['github', 'gitlab'] as const;
export type CodeHost = (typeof CODE_HOSTS)[number];

export const HOST_LABEL: Record<CodeHost, string> = { github: 'GitHub', gitlab: 'GitLab' };

export function isCodeHost(value: unknown): value is CodeHost {
  return typeof value === 'string' && (CODE_HOSTS as readonly string[]).includes(value);
}

export type RemoteInfo = {
  host: CodeHost;
  /** `https://github.com/acme/q3-code` — what a browser opens. */
  webUrl: string;
  /** `acme/q3-code`, or `group/sub/repo` on GitLab. */
  slug: string;
};

function hostFor(hostname: string): CodeHost | null {
  const name = hostname.toLowerCase();
  if (name === 'github.com' || name.split('.').includes('github')) return 'github';
  if (name === 'gitlab.com' || name.split('.').includes('gitlab')) return 'gitlab';
  return null;
}

/**
 * The web address behind a git remote, and which host serves it. Takes every
 * form `git remote` prints — https, `git@host:path` and `ssh://` — and reads
 * the host from the domain; a self-hosted server on a domain that names
 * neither (`git.acme.dev`) needs `host` to say which one it runs.
 */
export function parseRemote(url: string, host?: CodeHost | null): RemoteInfo | null {
  const raw = url.trim();
  let hostname: string;
  let port = '';
  let pathname: string;

  const scp = /^[\w.-]+@([^:/\s]+):(?!\/)(.+)$/.exec(raw);
  if (scp) {
    hostname = scp[1];
    pathname = scp[2];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    if (!['https:', 'http:', 'ssh:', 'git:'].includes(parsed.protocol)) return null;
    hostname = parsed.hostname;
    // An ssh or git port is not the web server's.
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') port = parsed.port;
    pathname = parsed.pathname;
  }

  // Anything git could read as an option, or that is not a plain host name.
  if (raw.startsWith('-') || !/^[a-z0-9][a-z0-9.-]*$/i.test(hostname)) return null;

  const segments = pathname
    .replace(/\.git\/?$/, '')
    .split('/')
    .filter(Boolean);
  const kind = host ?? hostFor(hostname);
  if (!kind || !hostname) return null;
  if (segments.length < 2 || segments.some((s) => s === '.' || s === '..')) return null;
  if (kind === 'github' && segments.length !== 2) return null;

  const slug = segments.join('/');
  return {
    host: kind,
    webUrl: `https://${hostname}${port ? `:${port}` : ''}/${slug}`,
    slug,
  };
}

function encodePath(file: string): string {
  return file.split('/').map(encodeURIComponent).join('/');
}

function lineAnchor(host: CodeHost, start?: number, end?: number): string {
  if (start === undefined) return '';
  if (end === undefined || end === start) return `#L${start}`;
  // GitHub repeats the L on the second number; GitLab does not.
  return host === 'github' ? `#L${start}-L${end}` : `#L${start}-${end}`;
}

/** A file at one commit — the link that keeps pointing at what was printed. */
export function fileLink(
  remote: RemoteInfo,
  sha: string,
  file: string,
  start?: number,
  end?: number,
): string {
  const blob = remote.host === 'gitlab' ? '-/blob' : 'blob';
  return `${remote.webUrl}/${blob}/${sha}/${encodePath(file)}${lineAnchor(remote.host, start, end)}`;
}

export function commitLink(remote: RemoteInfo, sha: string): string {
  return `${remote.webUrl}/${remote.host === 'gitlab' ? '-/commit' : 'commit'}/${sha}`;
}

/** Characters of a commit id printed on paper. Long enough to stay unique, short enough to type. */
export const PRINTED_SHA_LENGTH = 12;

/**
 * The same link as {@link fileLink}, written for a reader to type: no scheme, a
 * shortened commit id — both hosts resolve one — and the path unescaped.
 */
export function printedLink(
  remote: RemoteInfo,
  sha: string,
  file: string,
  start?: number,
  end?: number,
): string {
  const base = remote.webUrl.replace(/^https?:\/\//, '');
  const blob = remote.host === 'gitlab' ? '-/blob' : 'blob';
  return `${base}/${blob}/${sha.slice(0, PRINTED_SHA_LENGTH)}/${file}${lineAnchor(remote.host, start, end)}`;
}
