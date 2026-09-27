import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { chinese, english, msg, resolveLocale } from './i18n';
import { ZH_TW } from './i18n-zh-tw';

const APP = path.resolve(__dirname, '..');
const CALL = /(?<![\w.$])(?:t|t\.rich|msg)\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function keysInUse(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of sources(APP)) {
    for (const match of readFileSync(file, 'utf8').matchAll(CALL)) {
      keys.set((match[1] ?? match[2]) as string, path.relative(APP, file));
    }
  }
  return keys;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the Traditional Chinese dictionary', () => {
  const used = keysInUse();

  it('translates every string the interface shows', () => {
    const missing = [...used]
      .filter(([key]) => !(key in ZH_TW))
      .map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('holds nothing the interface no longer shows', () => {
    expect(Object.keys(ZH_TW).filter((key) => !used.has(key))).toEqual([]);
  });

  it('keeps every placeholder of the English', () => {
    const broken = Object.entries(ZH_TW).filter(
      ([key, value]) => placeholders(key).join() !== placeholders(value).join(),
    );
    expect(broken).toEqual([]);
  });
});

/* 文件元件印在紙上的是作者的文字，介面語言不能改到它。 */
describe('the public entry', () => {
  it('reaches no translated string', () => {
    const entry = readFileSync(path.resolve(APP, '../index.ts'), 'utf8');
    const modules = new Set(
      [...entry.matchAll(/from '\.\/(app\/[^']+)'/g)].map((m) =>
        path.resolve(APP, '..', m[1] as string),
      ),
    );
    const translated = [...modules].filter((file) =>
      /from '[./]*(?:lib\/)?i18n'/.test(readFileSync(file, 'utf8')),
    );
    expect(translated).toEqual([]);
  });
});

describe('translators', () => {
  it('fill placeholders in either language', () => {
    expect(english('Page {page} will be downloaded', { page: 8 })).toBe(
      'Page 8 will be downloaded',
    );
    expect(chinese('Page {page} will be downloaded', { page: 8 })).toBe('將下載第 8 頁');
  });

  it('fall back to the English when a string has no translation', () => {
    expect(chinese('asset exists')).toBe('asset exists');
  });

  it('put elements where the placeholders were', () => {
    const parts = chinese.rich('Create {file} and it appears here.', { file: 'X' });
    expect(parts.filter((part) => typeof part === 'string')).toEqual([
      '建立 ',
      '，文件就會出現在這裡。',
    ]);
    expect(parts.filter(isValidElement)).toHaveLength(1);
  });

  it('leave a marked string as it is', () => {
    expect(msg('Settings')).toBe('Settings');
  });
});

describe('resolveLocale', () => {
  it("follows the browser's first language, unless one is chosen", () => {
    expect(resolveLocale('auto', ['zh-TW', 'en'])).toBe('zh-TW');
    expect(resolveLocale('auto', ['zh-Hant'])).toBe('zh-TW');
    expect(resolveLocale('auto', ['en-US', 'zh-TW'])).toBe('en');
    expect(resolveLocale('auto', [])).toBe('en');
    expect(resolveLocale('en', ['zh-TW'])).toBe('en');
    expect(resolveLocale('zh-TW', ['en-US'])).toBe('zh-TW');
  });
});
