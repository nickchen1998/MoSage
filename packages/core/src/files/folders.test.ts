import { describe, expect, it } from 'vitest';
import {
  FOLDER_ID_RE,
  type Folder,
  newFolderId,
  validateIcon,
  validateName,
  validateReorder,
} from './folders.ts';

const folders: Folder[] = [
  { id: 'f-00000001', name: 'A', icon: { type: 'color', value: '#e5484d' } },
  { id: 'f-00000002', name: 'B', icon: { type: 'emoji', value: '📊' } },
];

describe('newFolderId', () => {
  it('produces ids the route guard accepts', () => {
    expect(FOLDER_ID_RE.test(newFolderId())).toBe(true);
  });
});

describe('validateName', () => {
  it('trims and bounds', () => {
    expect(validateName('  Quarterly ')).toBe('Quarterly');
    expect(validateName('')).toBeNull();
    expect(validateName('x'.repeat(41))).toBeNull();
    expect(validateName(null)).toBeNull();
  });
});

describe('validateIcon', () => {
  it('accepts emoji and hex colors', () => {
    expect(validateIcon({ type: 'emoji', value: '📊' })).toEqual({ type: 'emoji', value: '📊' });
    expect(validateIcon({ type: 'color', value: '#0091ff' })).toEqual({
      type: 'color',
      value: '#0091ff',
    });
  });

  it('rejects malformed icons', () => {
    expect(validateIcon({ type: 'color', value: 'blue' })).toBeNull();
    expect(validateIcon({ type: 'emoji', value: '' })).toBeNull();
    expect(validateIcon({ type: 'image', value: 'x.png' })).toBeNull();
    expect(validateIcon(null)).toBeNull();
  });
});

describe('validateReorder', () => {
  it('accepts a permutation of the current ids', () => {
    expect(validateReorder(['f-00000002', 'f-00000001'], folders)).toEqual([
      'f-00000002',
      'f-00000001',
    ]);
  });

  it('rejects wrong length, duplicates, and unknown ids', () => {
    expect(validateReorder(['f-00000001'], folders)).toBeNull();
    expect(validateReorder(['f-00000001', 'f-00000001'], folders)).toBeNull();
    expect(validateReorder(['f-00000001', 'f-00000009'], folders)).toBeNull();
    expect(validateReorder('nope', folders)).toBeNull();
  });
});
