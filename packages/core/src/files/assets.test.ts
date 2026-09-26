import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assetImportPath,
  countAssetUsages,
  findReferencedAssets,
  GLOBAL_SCOPE,
  mimeForFilename,
  resolveScopedAssetFile,
  validateAssetName,
} from './assets.ts';

const DOCS_ROOT = path.resolve('/tmp/open-doc-fixture/docs');
const GLOBAL_ROOT = path.resolve('/tmp/open-doc-fixture/assets');

describe('validateAssetName', () => {
  it('accepts an ordinary file name', () => {
    expect(validateAssetName('chart.png')).toBe('chart.png');
    expect(validateAssetName('  spaced name.svg  ')).toBe('spaced name.svg');
  });

  it('rejects path traversal, separators, and hidden files', () => {
    for (const bad of ['../secret.png', 'a/b.png', 'a\\b.png', '.env.png', '~/x.png', '..']) {
      expect(validateAssetName(bad)).toBeNull();
    }
  });

  it('requires an extension', () => {
    expect(validateAssetName('logo')).toBeNull();
    expect(validateAssetName('logo.')).toBeNull();
    expect(validateAssetName('.png')).toBeNull();
  });

  it('rejects non-strings and over-long names', () => {
    expect(validateAssetName(42)).toBeNull();
    expect(validateAssetName(`${'a'.repeat(120)}.png`)).toBeNull();
  });
});

describe('resolveScopedAssetFile', () => {
  it('resolves inside the document assets folder', () => {
    expect(resolveScopedAssetFile(DOCS_ROOT, GLOBAL_ROOT, 'q3-review', 'chart.png')).toBe(
      path.join(DOCS_ROOT, 'q3-review', 'assets', 'chart.png'),
    );
  });

  it('resolves the global scope to the project assets folder', () => {
    expect(resolveScopedAssetFile(DOCS_ROOT, GLOBAL_ROOT, GLOBAL_SCOPE, 'logo.svg')).toBe(
      path.join(GLOBAL_ROOT, 'logo.svg'),
    );
  });

  it('refuses an escaping filename or an invalid scope', () => {
    expect(resolveScopedAssetFile(DOCS_ROOT, GLOBAL_ROOT, 'q3-review', '../../etc.png')).toBeNull();
    expect(resolveScopedAssetFile(DOCS_ROOT, GLOBAL_ROOT, '../escape', 'logo.svg')).toBeNull();
  });
});

describe('countAssetUsages', () => {
  const source = `import chart from './assets/chart.png';
import logo from '@assets/logo.svg';
const other = new URL('./assets/chart.png', import.meta.url);
// mentions ./assets/unused.png only in prose`;

  it('counts quoted import paths in every sanctioned form', () => {
    expect(countAssetUsages(source, './assets/chart.png')).toBe(2);
    expect(countAssetUsages(source, '@assets/logo.svg')).toBe(1);
  });

  it('does not count an unquoted mention', () => {
    expect(countAssetUsages(source, './assets/unused.png')).toBe(0);
  });

  it('lists only the referenced paths', () => {
    expect(findReferencedAssets(source, ['./assets/chart.png', './assets/unused.png'])).toEqual([
      './assets/chart.png',
    ]);
  });
});

describe('assetImportPath', () => {
  it('uses the alias for global assets and a relative path per document', () => {
    expect(assetImportPath(GLOBAL_SCOPE, 'logo.svg')).toBe('@assets/logo.svg');
    expect(assetImportPath('q3-review', 'chart.png')).toBe('./assets/chart.png');
  });
});

describe('mimeForFilename', () => {
  it('maps known extensions and falls back to octet-stream', () => {
    expect(mimeForFilename('a.svg')).toBe('image/svg+xml');
    expect(mimeForFilename('a.woff2')).toBe('font/woff2');
    expect(mimeForFilename('a.zzz')).toBe('application/octet-stream');
    expect(mimeForFilename('noext')).toBe('application/octet-stream');
  });
});
