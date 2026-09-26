// 字數 the way Chinese publishing counts it: every CJK character is one,
// every run of Latin letters or digits is one word.

const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
const LATIN = `(?:(?![${CJK}])[\\p{L}\\p{N}])+`;
const TOKEN = new RegExp(`[${CJK}]|${LATIN}(?:['’.-]${LATIN})*`, 'gu');

export function countWords(text: string): number {
  let count = 0;
  for (const _ of text.matchAll(TOKEN)) count++;
  return count;
}

export function formatCount(n: number, locale = 'zh-TW'): string {
  return new Intl.NumberFormat(locale).format(n);
}
