import { describe, expect, it } from 'vitest';
import { copyTitle, nextCopyId, readMetaTitle, setMetaTitle, validateDocTitle } from './doc-ops.ts';

const DOC = `import type { DocMeta, DocPage } from '@open-document/core';

const Cover: DocPage = () => <div>hi</div>;

export const meta: DocMeta = {
  title: 'Q3 Review',
  pageSize: 'A4',
  createdAt: '2026-08-15T13:44:40.268Z',
};

export default [Cover] satisfies DocPage[];
`;

describe('setMetaTitle', () => {
  it('replaces the existing title and leaves everything else alone', () => {
    const next = setMetaTitle(DOC, 'Q4 Review');
    expect(next).not.toBeNull();
    expect(next).toContain("title: 'Q4 Review'");
    expect(next).toContain("pageSize: 'A4'");
    expect(next).toContain('const Cover: DocPage');
    expect(readMetaTitle(next as string)).toBe('Q4 Review');
  });

  it('adds a title when meta has none', () => {
    const source = `export const meta = { pageSize: 'A4' };\n`;
    const next = setMetaTitle(source, 'Fresh');
    expect(next).toContain("title: 'Fresh'");
    expect(readMetaTitle(next as string)).toBe('Fresh');
  });

  it('escapes quotes in the new title', () => {
    const next = setMetaTitle(DOC, "Simon's Report");
    expect(next).toContain("title: 'Simon\\'s Report'");
  });

  it('returns null when there is no meta export to edit', () => {
    expect(setMetaTitle('export default [];\n', 'Nope')).toBeNull();
  });

  it('ignores a title on a non-exported object', () => {
    const source = `const meta = { title: 'Local' };\nexport default [];\n`;
    expect(setMetaTitle(source, 'New')).toBeNull();
  });
});

describe('validateDocTitle', () => {
  it('trims and bounds the title', () => {
    expect(validateDocTitle('  Report  ')).toBe('Report');
    expect(validateDocTitle('')).toBeNull();
    expect(validateDocTitle('  ')).toBeNull();
    expect(validateDocTitle('x'.repeat(121))).toBeNull();
    expect(validateDocTitle(7)).toBeNull();
  });
});

describe('nextCopyId', () => {
  it('appends -copy, then numbers further copies', () => {
    expect(nextCopyId('q3-review', new Set())).toBe('q3-review-copy');
    expect(nextCopyId('q3-review', new Set(['q3-review-copy']))).toBe('q3-review-copy-2');
    expect(nextCopyId('q3-review-copy', new Set(['q3-review-copy']))).toBe('q3-review-copy-2');
  });
});

describe('copyTitle', () => {
  it('marks a copy once', () => {
    expect(copyTitle('Q3 Review')).toBe('Q3 Review (copy)');
    expect(copyTitle('Q3 Review (copy)')).toBe('Q3 Review (copy)');
  });
});
