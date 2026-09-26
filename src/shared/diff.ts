// Word-level diff that treats every CJK character as a word — jsdiff's own
// word mode sees a whole Chinese sentence as one token.

import { diffArrays } from 'diff';

export type DiffPart = { type: 'same' | 'add' | 'remove'; text: string };

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
const TOKEN = new RegExp(
  `[${CJK}]|(?:(?![${CJK}])[\\p{L}\\p{N}_])+|\\s+|[^\\s\\p{L}\\p{N}_]`,
  'gu',
);

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

export function diffText(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // Keep the O(ND) diff cheap on very long chapters.
  if (a.length * b.length > 4_000_000) {
    return [
      { type: 'remove', text: before },
      { type: 'add', text: after },
    ];
  }
  const parts: DiffPart[] = [];
  for (const change of diffArrays(a, b)) {
    const type = change.added ? 'add' : change.removed ? 'remove' : 'same';
    const text = change.value.join('');
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  }
  return parts;
}
