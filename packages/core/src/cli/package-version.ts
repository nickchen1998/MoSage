import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'mosage';

/**
 * This package's root folder (the one holding its own `package.json`, the
 * `template/` and `skills/`). Walks up instead of assuming a fixed depth: the
 * bundler decides which chunk a module lands in, so `../../` is right from
 * `dist/cli/` and wrong from `dist/`.
 */
export function packageRoot(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 6; up += 1) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file)) {
      try {
        const pkg = JSON.parse(readFileSync(file, 'utf8')) as { name?: string };
        if (pkg.name === PACKAGE_NAME) return dir;
      } catch {
        // Unreadable package.json — keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Getting the root wrong is silent — it reports `0.0.0` rather than failing. */
export async function readCoreVersion(): Promise<string> {
  const root = packageRoot();
  if (!root) return '0.0.0';
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
