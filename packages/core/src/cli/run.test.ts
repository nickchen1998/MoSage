import { describe, expect, it } from 'vitest';
import { parsePort } from './run.ts';

describe('parsePort', () => {
  it('accepts a valid port', () => {
    expect(parsePort('5273')).toBe(5273);
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(() => parsePort('abc')).toThrow(/Invalid port/);
    expect(() => parsePort('1.5')).toThrow(/Invalid port/);
    expect(() => parsePort('70000')).toThrow(/Invalid port/);
  });
});
