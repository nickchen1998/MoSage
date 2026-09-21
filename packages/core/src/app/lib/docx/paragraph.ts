import type { Inline, LinkTarget, RunStyle } from './model';

function meaningful(inline: Inline): boolean {
  if (inline.type === 'text') return inline.text.trim() !== '';
  return inline.type !== 'break' && inline.type !== 'tab';
}

type Item = { inline: Inline; collapse: boolean };

/**
 * Inline content for one paragraph, with CSS white-space collapsing applied
 * across element boundaries — the space between two spans is one space, and
 * none at all at the start or end of a line.
 */
export class ParagraphBuilder {
  private readonly items: Item[] = [];
  private breakPending = false;

  text(text: string, style: RunStyle, link: LinkTarget | undefined, collapse: boolean): void {
    if (text) this.push({ type: 'text', text, style, link }, collapse);
  }

  push(inline: Inline, collapse = false): void {
    if (this.breakPending) {
      this.breakPending = false;
      if (!this.empty) this.items.push({ inline: { type: 'break' }, collapse: false });
    }
    this.items.push({ inline, collapse });
  }

  /** A block nested in inline content starts and ends its own line. */
  requestBreak(): void {
    this.breakPending = true;
  }

  get empty(): boolean {
    return !this.items.some((item) => meaningful(item.inline));
  }

  finish(): Inline[] {
    const out: Item[] = [];
    const trimEnd = () => {
      for (let i = out.length - 1; i >= 0; i--) {
        const item = out[i];
        if (!item?.collapse || item.inline.type !== 'text') return;
        const text = item.inline.text.replace(/ +$/, '');
        if (text) {
          out[i] = { inline: { ...item.inline, text }, collapse: true };
          return;
        }
        out.splice(i, 1);
      }
    };

    let afterSpace = true;
    for (const item of this.items) {
      const { inline } = item;
      if (inline.type === 'text' && item.collapse) {
        let text = inline.text.replace(/ {2,}/g, ' ');
        if (afterSpace) text = text.replace(/^ /, '');
        if (!text) continue;
        afterSpace = text.endsWith(' ');
        out.push({ inline: { ...inline, text }, collapse: true });
        continue;
      }
      if (inline.type === 'break' || inline.type === 'tab') {
        trimEnd();
        afterSpace = true;
      } else {
        afterSpace = false;
      }
      out.push(item);
    }
    trimEnd();
    while (out[out.length - 1]?.inline.type === 'break') out.pop();
    return out.map((item) => item.inline);
  }
}
