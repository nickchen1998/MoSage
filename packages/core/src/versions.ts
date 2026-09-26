/** Compares `x.y.z` versions; a pre-release suffix sorts below its release. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => {
    const [core, pre] = v.trim().replace(/^v/, '').split('-', 2);
    const parts = core.split('.').map((n) => Number.parseInt(n, 10) || 0);
    return { parts: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], pre: pre ?? null };
  };
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if (a.parts[i] !== b.parts[i]) return a.parts[i] > b.parts[i];
  }
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true;
  if (b.pre === null) return false;
  return a.pre > b.pre;
}

export function updateCheckDisabled(): boolean {
  return Boolean(process.env.MOSAGE_NO_UPDATE_CHECK || process.env.CI);
}

let cached: { at: number; version: string | null } | null = null;
const CACHE_MS = 60 * 60 * 1000;

/**
 * The `latest` dist-tag of mosage on npm, or null when it cannot be had quickly
 * — offline, slow, or switched off. Never throws: an update notice is a
 * courtesy, and nothing may wait on it.
 */
export async function fetchLatestVersion(timeoutMs = 3000): Promise<string | null> {
  if (updateCheckDisabled()) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.version;
  const registry = (process.env.MOSAGE_NPM_REGISTRY || 'https://registry.npmjs.org').replace(
    /\/+$/,
    '',
  );
  let version: string | null = null;
  try {
    const res = await fetch(`${registry}/mosage/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) {
      const body = (await res.json()) as { version?: unknown };
      if (typeof body.version === 'string') version = body.version;
    }
  } catch {
    version = null;
  }
  cached = { at: Date.now(), version };
  return version;
}
