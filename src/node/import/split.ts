// Cut one imported manuscript into chapters at its top-level headings.
//
// Footnote and link definitions usually sit at the very end of a converted
// document; each chapter gets the ones it references, so `[^3]` in chapter two
// still resolves after the split.

import type { Heading, Nodes, Root } from 'mdast';
import { parseMarkdown, textOf } from '../../shared/markdown.ts';
import { applyEdits, type SourceEdit, walk } from '../export/common.ts';

export interface ChapterDraft {
  title: string;
  body: string;
}

export interface SplitOptions {
  /** Cut at headings (default) or keep everything in one chapter. */
  split: boolean;
  /** Title of a chapter that has no heading of its own, e.g. the file name. */
  fallbackTitle: string;
  /** Title of the chapter holding the text before the first heading. */
  frontMatterTitle: string;
}

export interface SplitResult {
  chapters: ChapterDraft[];
  /** There was no heading at all to cut at. */
  noHeadings: boolean;
}

interface Def {
  key: string;
  start: number;
  end: number;
  text: string;
}

interface Ref {
  key: string;
  offset: number;
}

const off = (node: Nodes, edge: 'start' | 'end') => node.position?.[edge].offset ?? 0;

/** Line breaks and runs of ASCII whitespace become one space; full-width spaces (　) stay. */
function oneLine(text: string): string {
  return text.replace(/[ \t\r\n]+/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
}

/** Rewrite a heading (ATX or setext) as an ATX heading of another depth. */
function reheading(source: string, node: Heading, depth: number): SourceEdit {
  const first = node.children[0];
  const last = node.children.at(-1);
  const inline = first && last ? oneLine(source.slice(off(first, 'start'), off(last, 'end'))) : '';
  const hashes = '#'.repeat(Math.min(6, Math.max(1, depth)));
  return {
    start: off(node, 'start'),
    end: off(node, 'end'),
    text: inline ? `${hashes} ${inline}` : hashes,
  };
}

export function splitManuscript(source: string, opts: SplitOptions): SplitResult {
  const tree: Root = parseMarkdown(source);
  const cuts: SourceEdit[] = [];
  const defs: Def[] = [];
  const refs: Ref[] = [];

  for (const node of tree.children) {
    if (node.type === 'yaml') {
      cuts.push({ start: off(node, 'start'), end: off(node, 'end'), text: '' });
    } else if (node.type === 'footnoteDefinition' || node.type === 'definition') {
      const start = off(node, 'start');
      let end = off(node, 'end');
      while (source[end] === '\n' || source[end] === '\r') end++;
      const kind = node.type === 'footnoteDefinition' ? 'footnote' : 'link';
      defs.push({
        key: `${kind}:${node.identifier}`,
        start,
        end,
        text: source.slice(start, off(node, 'end')).trim(),
      });
      cuts.push({ start, end, text: '' });
    }
  }
  const headings: Heading[] = [];
  walk(tree, (node) => {
    if (node.type === 'heading') headings.push(node);
    else if (node.type === 'footnoteReference') {
      refs.push({ key: `footnote:${node.identifier}`, offset: off(node, 'start') });
    } else if (node.type === 'linkReference' || node.type === 'imageReference') {
      refs.push({ key: `link:${node.identifier}`, offset: off(node, 'start') });
    }
  });
  const referenced = new Set(refs.map((r) => r.key));
  const orphansIn = (start: number, end: number) =>
    defs.filter((d) => d.start >= start && d.start < end && !referenced.has(d.key));

  /**
   * The text of [start, end) with definitions cut out and headings moved by
   * `shift` levels, followed by the definitions it references and `extra`.
   */
  const body = (start: number, end: number, shift: number, extra: Def[]): string => {
    const edits: SourceEdit[] = [];
    for (const c of cuts) {
      if (c.start >= start && c.start < end) {
        edits.push({ start: c.start - start, end: Math.min(c.end, end) - start, text: '' });
      }
    }
    if (shift !== 0) {
      for (const h of headings) {
        const depth = h.depth + shift;
        if (off(h, 'start') < start || off(h, 'end') > end || depth < 2) continue;
        const edit = reheading(source, h, depth);
        edits.push({ ...edit, start: edit.start - start, end: edit.end - start });
      }
    }
    const text = applyEdits(source.slice(start, end), edits).trim();
    const used: Def[] = [];
    for (const ref of refs) {
      if (ref.offset < start || ref.offset >= end) continue;
      const def = defs.find((d) => d.key === ref.key);
      if (def && !used.includes(def)) used.push(def);
    }
    for (const def of extra) if (!used.includes(def)) used.push(def);
    return [text, ...used.map((d) => d.text)].filter(Boolean).join('\n\n');
  };

  const topLevel = tree.children.filter((n): n is Heading => n.type === 'heading');
  const level = topLevel.length ? Math.min(...topLevel.map((h) => h.depth)) : 0;
  const unreferenced = defs.filter((d) => !referenced.has(d.key));

  if (!opts.split || level === 0) {
    const h1s = headings.filter((h) => h.depth === 1);
    const first = tree.children.find((n) => n.type !== 'yaml');
    if (h1s.length === 1 && first === h1s[0]) {
      return {
        chapters: [
          {
            title: oneLine(textOf(h1s[0])) || opts.fallbackTitle,
            body: body(off(h1s[0], 'end'), source.length, 0, unreferenced),
          },
        ],
        noHeadings: false,
      };
    }
    // One `#` per chapter: with several, every heading moves one level down.
    return {
      chapters: [
        {
          title: opts.fallbackTitle,
          body: body(0, source.length, h1s.length ? 1 : 0, unreferenced),
        },
      ],
      noHeadings: headings.length === 0,
    };
  }

  // Cut at the shallowest top-level heading level; deeper headings move up so
  // the chapter titles become `#` and their sections `##`.
  const splits = topLevel.filter((h) => h.depth === level);
  const shift = 1 - level;
  const chapters: ChapterDraft[] = [];
  const firstStart = off(splits[0], 'start');
  const leadingOrphans = orphansIn(0, firstStart);
  const hasLeading = body(0, firstStart, shift, []).trim() !== '';
  if (hasLeading) {
    chapters.push({
      title: opts.frontMatterTitle,
      body: body(0, firstStart, shift, leadingOrphans),
    });
  }
  splits.forEach((heading, i) => {
    const next = splits[i + 1];
    const end = next ? off(next, 'start') : source.length;
    const extra = orphansIn(off(heading, 'start'), end);
    if (i === 0 && !hasLeading) extra.unshift(...leadingOrphans);
    chapters.push({
      title: oneLine(textOf(heading)) || opts.fallbackTitle,
      body: body(off(heading, 'end'), end, shift, extra),
    });
  });
  return { chapters, noHeadings: false };
}
