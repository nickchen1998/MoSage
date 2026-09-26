import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assetImportPath,
  assetResponseHeaders,
  countAssetUsages,
  findReferencedAssets,
  folderNameFromHeading,
  GLOBAL_SCOPE,
  mimeForFilename,
  parseAssetPath,
  resolveScopedAssetFile,
  resolveScopedAssetPath,
  rewriteAssetReferences,
  uploadPathFor,
  validateAssetName,
} from './assets.ts';

const DOCS_ROOT = path.resolve('/tmp/mosage-fixture/docs');
const GLOBAL_ROOT = path.resolve('/tmp/mosage-fixture/assets');

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

describe('parseAssetPath', () => {
  it('accepts the images, references, and legacy shapes', () => {
    expect(parseAssetPath(['images', '第二章 市場分析', 'map.png'])).toEqual({
      path: 'images/第二章 市場分析/map.png',
      name: 'map.png',
      kind: 'image',
      chapter: '第二章 市場分析',
    });
    expect(parseAssetPath(['images', 'logo.svg'])).toMatchObject({ kind: 'image', chapter: null });
    expect(parseAssetPath(['references', 'paper.pdf'])).toMatchObject({ kind: 'reference' });
    expect(parseAssetPath(['old.png'])).toMatchObject({ path: 'old.png', kind: 'image' });
    expect(parseAssetPath(['notes.md'])).toMatchObject({ path: 'notes.md', kind: 'reference' });
  });

  it('refuses anything else', () => {
    for (const bad of [
      ['images', 'paper.pdf'],
      ['images', 'a', 'b', 'x.png'],
      ['references', 'sub', 'x.pdf'],
      ['other', 'x.png'],
      ['images', '..', 'x.png'],
      ['images', '.hidden', 'x.png'],
      ['images', 'a:b', 'x.png'],
    ]) {
      expect(parseAssetPath(bad), bad.join('/')).toBeNull();
    }
  });
});

describe('uploadPathFor', () => {
  it('files images under the chapter and everything else under references', () => {
    expect(uploadPathFor('map.png', '第一章')?.path).toBe('images/第一章/map.png');
    expect(uploadPathFor('map.png', null)?.path).toBe('images/map.png');
    expect(uploadPathFor('data.csv', '第一章')?.path).toBe('references/data.csv');
  });
});

describe('resolveScopedAssetPath', () => {
  it('resolves nested paths inside the scope and nowhere else', () => {
    expect(resolveScopedAssetPath(DOCS_ROOT, GLOBAL_ROOT, 'q3', 'images/第一章/a.png')).toBe(
      path.join(DOCS_ROOT, 'q3', 'assets', 'images', '第一章', 'a.png'),
    );
    expect(resolveScopedAssetPath(DOCS_ROOT, GLOBAL_ROOT, 'q3', 'images/../../x.png')).toBeNull();
  });
});

describe('folderNameFromHeading', () => {
  it('keeps the words and drops what a folder cannot hold', () => {
    expect(folderNameFromHeading('第二章：市場分析')).toBe('第二章：市場分析');
    expect(folderNameFromHeading('2.1 Q3 / Q4 results')).toBe('2.1 Q3 Q4 results');
    expect(folderNameFromHeading('...hidden')).toBe('hidden');
    expect(folderNameFromHeading('///')).toBeNull();
  });
});

describe('rewriteAssetReferences', () => {
  it('rewrites quoted asset paths and counts them', () => {
    const source = `import a from './assets/images/old/a.png';\nconst b = new URL("./assets/images/old/b.png", import.meta.url);\n// ./assets/images/old/c.png in prose`;
    const { source: next, count } = rewriteAssetReferences(source, (p) =>
      p.startsWith('./assets/images/old/') ? p.replace('/old/', '/new/') : null,
    );
    expect(count).toBe(2);
    expect(next).toContain("'./assets/images/new/a.png'");
    expect(next).toContain('"./assets/images/new/b.png"');
    expect(next).toContain('./assets/images/old/c.png in prose');
  });
});

describe('assetResponseHeaders', () => {
  it('renders safe types inline and downloads the rest', () => {
    expect(assetResponseHeaders('application/pdf', 'a.pdf')['content-type']).toBe(
      'application/pdf',
    );
    expect(
      assetResponseHeaders('text/csv; charset=utf-8', 'a.csv')['content-disposition'],
    ).toBeUndefined();
    const html = assetResponseHeaders('application/octet-stream', 'page.html');
    expect(html['content-type']).toBe('application/octet-stream');
    expect(html['content-disposition']).toMatch(/^attachment/);
    expect(assetResponseHeaders('image/svg+xml', 'a.svg')['content-security-policy']).toMatch(
      /sandbox/,
    );
  });
});
