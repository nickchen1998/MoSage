import { describe, expect, it } from 'vitest';
import { type CodeSource, excerptLink, excerptStatus, parseRange, parseRanges } from './code.ts';
import { parseRemote } from './code-remote.ts';

const remote = parseRemote('git@gitlab.com:acme/q3-code.git');
const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const source = (pushed: CodeSource['pushed'], withRemote = true): CodeSource => ({
  path: 'etl/a.py',
  lines: ['one', 'two', 'three', 'four'],
  remote: withRemote ? remote : null,
  pushed,
});

describe('line ranges', () => {
  it('reads single lines, ranges and lists', () => {
    expect(parseRange('12-38')).toEqual({ start: 12, end: 38 });
    expect(parseRange(' 12 – 38 ')).toEqual({ start: 12, end: 38 });
    expect(parseRange('7')).toEqual({ start: 7, end: 7 });
    expect(parseRange('38-12')).toBeNull();
    expect(parseRange('0-3')).toBeNull();
    expect(parseRange('a-b')).toBeNull();
    expect(parseRanges('30-31, 22-25，24-27')).toEqual([
      { start: 22, end: 27 },
      { start: 30, end: 31 },
    ]);
    expect(parseRanges('1-2, x')).toBeNull();
  });
});

describe('excerptStatus', () => {
  const range = { start: 2, end: 3 };
  it('is pushed when origin has these lines', () => {
    expect(excerptStatus(source({ sha, at: null, same: true, lines: null }), range)).toBe('pushed');
    // The file changed, but not where the excerpt looks.
    const edited = { sha, at: null, same: false, lines: ['ONE', 'two', 'three', 'FOUR'] };
    expect(excerptStatus(source(edited), range)).toBe('pushed');
  });

  it('is changed when the pushed lines differ, and new when origin lacks the file', () => {
    const shifted = { sha, at: null, same: false, lines: ['one', 'inserted', 'two', 'three'] };
    expect(excerptStatus(source(shifted), range)).toBe('changed');
    expect(excerptStatus(source({ sha, at: null, same: false, lines: null }), range)).toBe('new');
    expect(excerptStatus(source(null), range)).toBe('new');
    expect(excerptStatus(source(null, false), range)).toBe('local');
  });

  it('links only to what origin has', () => {
    const pushed = source({ sha, at: null, same: true, lines: null });
    expect(excerptLink(pushed, range)?.href).toBe(
      `https://gitlab.com/acme/q3-code/-/blob/${sha}/etl/a.py#L2-3`,
    );
    expect(excerptLink(pushed, null)?.printed).toBe(
      'gitlab.com/acme/q3-code/-/blob/a1b2c3d4e5f6/etl/a.py',
    );
    expect(excerptLink(source({ sha, at: null, same: false, lines: null }), range)).toBeNull();
    expect(excerptLink(source(null, false), range)).toBeNull();
  });
});
