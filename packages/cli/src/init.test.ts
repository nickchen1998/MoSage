import { describe, expect, it } from 'vitest';
import { sanitizeDirName } from './init.ts';

describe('sanitizeDirName', () => {
  it('passes through a clean name', () => {
    expect(sanitizeDirName('quarterly-reports')).toBe('quarterly-reports');
  });

  it('collapses spaces and shell-hostile characters into dashes', () => {
    expect(sanitizeDirName('My Docs (2026)!')).toBe('My-Docs-2026');
  });

  it('keeps path separators usable', () => {
    expect(sanitizeDirName('work/ q3 report')).toBe('work/q3-report');
  });

  it('falls back when nothing usable is left', () => {
    expect(sanitizeDirName('///')).toBe('my-docs');
  });

  it('leaves relative markers alone', () => {
    expect(sanitizeDirName('.')).toBe('.');
    expect(sanitizeDirName('..')).toBe('..');
  });
});
