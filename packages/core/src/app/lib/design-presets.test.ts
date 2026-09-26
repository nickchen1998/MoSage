import { describe, expect, it } from 'vitest';
import { defaultDesign } from './design';
import { designPresets } from './design-presets';

describe('design presets', () => {
  it('size every type step in even px', () => {
    for (const design of [defaultDesign, ...designPresets]) {
      for (const [step, size] of Object.entries(design.typeScale)) {
        expect(size % 2, `${step}: ${size}px`).toBe(0);
      }
    }
  });
});
