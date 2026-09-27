/**
 * Traditional Chinese typography, checked on text alone. Taiwanese house style
 * sets punctuation beside Chinese in full width and quotes it with 「」; what
 * slips through is usually a half-width comma typed on an English layout, or
 * quotation marks carried over from a draft written elsewhere.
 */

export type TypographyRule = 'cjk-punctuation' | 'cjk-quotes';

export type TypographyIssue = {
  rule: TypographyRule;
  /** Offset of the offending character in the text. */
  index: number;
  found: string;
  suggestion: string;
};

const HAN = /\p{Script=Han}/u;

const FULL_WIDTH: Record<string, string> = {
  ',': '，',
  ';': '；',
  ':': '：',
  '!': '！',
  '?': '？',
  '.': '。',
  '(': '（',
  ')': '）',
};

const QUOTES = new Set(['"', '“', '”', '‘', '’']);

const isHan = (ch: string | undefined): boolean => ch !== undefined && HAN.test(ch);

export function typographyIssues(text: string): TypographyIssue[] {
  const chars = Array.from(text);
  const issues: TypographyIssue[] = [];
  let offset = 0;
  let quoteOpen = false;

  chars.forEach((ch, i) => {
    const before = chars[i - 1];
    const after = chars[i + 1];
    const index = offset;
    offset += ch.length;

    if (QUOTES.has(ch)) {
      const opening = ch === '“' || ch === '‘' || (ch === '"' && !quoteOpen);
      if (ch === '"') quoteOpen = !quoteOpen;
      const nested = ch === '‘' || ch === '’';
      if (isHan(before) || isHan(after)) {
        const suggestion = nested ? (opening ? '『' : '』') : opening ? '「' : '」';
        issues.push({ rule: 'cjk-quotes', index, found: ch, suggestion });
      }
      return;
    }

    const full = FULL_WIDTH[ch];
    if (!full) return;
    let flagged: boolean;
    if (ch === '(') flagged = isHan(after) || isHan(before);
    else if (ch === ')') flagged = isHan(before) || isHan(after);
    // A period after Chinese ends the sentence only when nothing but space,
    // the end, or more Chinese follows — `v2.0版` is a version number.
    else if (ch === '.')
      flagged = isHan(before) && (after === undefined || /\s/.test(after) || isHan(after));
    // Before Chinese it is only a mistake when it does not belong to what
    // precedes it — `10:30開會` and `1,000元` are numbers.
    else flagged = isHan(before) || (isHan(after) && (before === undefined || !/\w/.test(before)));
    if (flagged) issues.push({ rule: 'cjk-punctuation', index, found: ch, suggestion: full });
  });
  return issues;
}

/** 台 or 臺 where it names a place or the currency — the words a document spells one way. */
const VARIANT = /([台臺])(?=[灣北中南東幣])/g;

export type VariantCount = { plain: number; formal: number };

/** How often a text writes 台 and 臺 in place names, to spot a document that mixes them. */
export function countTaiVariants(text: string): VariantCount {
  const count: VariantCount = { plain: 0, formal: 0 };
  for (const match of text.matchAll(VARIANT)) {
    if (match[1] === '台') count.plain += 1;
    else count.formal += 1;
  }
  return count;
}

/** A few characters either side of an offset, for a finding a person can recognise. */
export function around(text: string, index: number, length = 1, reach = 8): string {
  const start = Math.max(0, index - reach);
  const end = Math.min(text.length, index + length + reach);
  const body = text.slice(start, end).replace(/\s+/g, ' ');
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}
