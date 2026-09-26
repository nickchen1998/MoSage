import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: false,
  splitting: false,
  sourcemap: false,
  banner: { js: '#!/usr/bin/env node' },
  define: { __MOSAGE_VERSION__: JSON.stringify(pkg.version) },
});
