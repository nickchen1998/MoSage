import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __MOSAGE_VERSION__: string | undefined;

/** The installed mosage package: holds template/, skills/ and dist/web/. */
export const PACKAGE_ROOT = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        if (JSON.parse(readFileSync(pkg, 'utf8')).name === 'mosage') return dir;
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Cannot locate the mosage package root.');
    dir = parent;
  }
})();

export const VERSION: string =
  typeof __MOSAGE_VERSION__ === 'string'
    ? __MOSAGE_VERSION__
    : JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;

export const PROJECT_TEMPLATE_DIR = join(PACKAGE_ROOT, 'template', 'project');
export const BOOK_TEMPLATE_DIR = join(PACKAGE_ROOT, 'template', 'book');
export const SKILLS_DIR = join(PACKAGE_ROOT, 'skills');
export const WEB_DIR = join(PACKAGE_ROOT, 'dist', 'web');
