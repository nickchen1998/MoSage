import { describe, expect, it } from 'vitest';
import { textEms, watermarkLayout } from './watermark';

const A4 = { width: 794, height: 1123 };

describe('watermarkLayout', () => {
  it('counts CJK as square and Latin as narrower', () => {
    expect(textEms('草稿')).toBeCloseTo(2.2);
    expect(textEms('DRAFT')).toBeCloseTo(3.5);
  });

  it('runs corner to corner, steeper on a portrait sheet', () => {
    expect(watermarkLayout('草稿', A4).angle).toBe(-55);
    expect(watermarkLayout('草稿', { width: 1123, height: 794 }).angle).toBe(-35);
  });

  it('shrinks long text to fit, within even sizes', () => {
    const short = watermarkLayout('草稿', A4).size;
    const long = watermarkLayout('機密文件，請勿外流或複製', A4).size;
    expect(short).toBe(160);
    expect(long).toBeLessThan(short);
    expect(long % 2).toBe(0);
    expect(watermarkLayout('x'.repeat(200), A4).size).toBe(32);
  });
});
