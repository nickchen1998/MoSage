import { describe, expect, it } from 'vitest';
import {
  barPath,
  foldSlices,
  formatValue,
  niceTicks,
  seriesColor,
  textWidth,
  toNumber,
} from './chart';

describe('niceTicks', () => {
  it('lands on round steps and always includes zero', () => {
    expect(niceTicks(3, 97)).toEqual({ ticks: [0, 20, 40, 60, 80, 100], min: 0, max: 100 });
    expect(niceTicks(120, 980, 4).ticks).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(-35, 60).ticks).toEqual([-40, -20, 0, 20, 40, 60]);
  });

  it('copes with a flat or fractional series', () => {
    expect(niceTicks(0, 0).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0.1, 0.33).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
  });
});

describe('values and labels', () => {
  it('reads numbers the way a spreadsheet writes them', () => {
    expect(toNumber(1200)).toBe(1200);
    expect(toNumber('1,200')).toBe(1200);
    expect(toNumber(' 3.5 ')).toBe(3.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber('n/a')).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });

  it('groups digits and keeps the unit', () => {
    expect(formatValue(12345.678)).toBe('12,345.68');
    expect(formatValue(42, '%')).toBe('42%');
    expect(formatValue(3, ' 萬元')).toBe('3 萬元');
  });

  it('estimates CJK as square and Latin as narrower', () => {
    expect(textWidth('營收', 12)).toBe(24);
    expect(textWidth('Q1', 10)).toBe(12);
  });

  it('paints a lone series in the accent and several in the fixed order', () => {
    expect(seriesColor(0, 1)).toContain('--od-accent');
    expect(seriesColor(1, 3)).toBe('var(--od-chart-2, #eb6834)');
  });
});

describe('foldSlices', () => {
  const slices = [3, 20, 1, 8, 13, 2, 5, 40].map((value, i) => ({ label: `s${i}`, value }));

  it('keeps the five largest and folds the rest into one, in their original order', () => {
    const folded = foldSlices(slices, '其他');
    expect(folded.map((s) => s.label)).toEqual(['s1', 's3', 's4', 's6', 's7', '其他']);
    expect(folded[5]).toEqual({ label: '其他', value: 6, folded: true });
  });

  it('drops empty slices and leaves a short list alone', () => {
    expect(
      foldSlices(
        [
          { label: 'a', value: 0 },
          { label: 'b', value: 2 },
        ],
        'x',
      ),
    ).toEqual([{ label: 'b', value: 2 }]);
  });
});

describe('barPath', () => {
  it('rounds only the end away from the baseline', () => {
    expect(barPath(0, 0, 20, 100, 'top')).toBe('M0,100V4Q0,0 4,0H16Q20,0 20,4V100Z');
    expect(barPath(0, 0, 100, 20, 'right')).toBe('M0,0H96Q100,0 100,4V16Q100,20 96,20H0Z');
  });

  it('never rounds more than a short bar can hold', () => {
    expect(barPath(0, 0, 20, 2, 'top')).toBe('M0,2V1Q0,0 1,0H19Q20,0 20,1V2Z');
  });
});
