import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './versions.ts';

describe('isNewerVersion', () => {
  it('compares each part numerically', () => {
    expect(isNewerVersion('0.10.0', '0.9.1')).toBe(true);
    expect(isNewerVersion('0.9.1', '0.9.1')).toBe(false);
    expect(isNewerVersion('0.9.0', '0.9.1')).toBe(false);
    expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
  });

  it('ranks a release above its own pre-release', () => {
    expect(isNewerVersion('1.0.0', '1.0.0-beta.1')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0')).toBe(false);
  });
});
