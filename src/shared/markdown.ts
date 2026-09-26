// One parser for everything: the web preview, the Word exporter, word counts
// and the source edits all read a chapter through parseChapter(), so what you
// see in the browser is what ends up in the .docx.

import type { Heading, Root, RootContent } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import { type Annotation, parseMarker, toAnnotation } from './annotations.ts';
import { countWords } from './wordcount.ts';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']);

export function parseMarkdown(source: string): Root {
  return processor.parse(source) as Root;
}

export interface Block {
  index: number;
  node: RootContent;
  start: number;
  end: number;
  /** Markers directly above this block. */
  annotations: Annotation[];
}

export interface OutlineHeading {
  depth: number;
  text: string;
  blockIndex: number;
  line: number;
}

export interface ParsedChapter {
  source: string;
  tree: Root;
  frontmatter: Record<string, unknown>;
  /** Offsets of the `---` … `---` block, when there is one. */
  frontmatterRange: [number, number] | null;
  /** Text of the first `#` heading. */
  title: string | null;
  blocks: Block[];
  /** Every marker in source order. */
  annotations: Annotation[];
  headings: OutlineHeading[];
  words: number;
}

/** Plain text of a node, the way a reader sees it. */
export function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: string; value?: string; alt?: string; children?: unknown[] };
  if (n.type === 'html' || n.type === 'yaml' || n.type === 'footnoteDefinition') return '';
  if (n.type === 'break') return '\n';
  if (typeof n.value === 'string') return n.value;
  if (n.type === 'image') return n.alt ?? '';
  if (Array.isArray(n.children)) return n.children.map(textOf).join('');
  return '';
}

export function isPageBreak(node: RootContent): boolean {
  return (
    node.type === 'html' && /^<!--\s*(pagebreak|page-break|分頁)\s*-->$/i.test(node.value.trim())
  );
}

export function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function readFrontmatter(value: string): Record<string, unknown> {
  try {
    const data = parseYaml(value);
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Word count of a tree: CJK characters + Latin words, code and markers excluded. */
export function wordsOf(tree: Root): number {
  let total = 0;
  const walk = (node: unknown) => {
    const n = node as { type?: string; value?: string; children?: unknown[] };
    if (!n || n.type === 'html' || n.type === 'yaml' || n.type === 'code') return;
    if (typeof n.value === 'string') total += countWords(n.value);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  walk(tree);
  return total;
}

export function parseChapter(source: string): ParsedChapter {
  const tree = parseMarkdown(source);
  let frontmatter: Record<string, unknown> = {};
  let frontmatterRange: [number, number] | null = null;
  const blocks: Block[] = [];
  const annotations: Annotation[] = [];
  const seen = new Set<string>();
  let pending: Annotation[] = [];

  for (const node of tree.children) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? start;
    if (node.type === 'yaml') {
      frontmatter = readFrontmatter(node.value);
      frontmatterRange = [start, end];
      continue;
    }
    if (node.type === 'html') {
      const marker = parseMarker(node.value);
      if (marker) {
        const annotation = toAnnotation(marker, { start, end, blockIndex: null }, seen);
        pending.push(annotation);
        annotations.push(annotation);
        continue;
      }
    }
    const index = blocks.length;
    for (const a of pending) a.blockIndex = index;
    blocks.push({ index, node, start, end, annotations: pending });
    pending = [];
  }

  const headings: OutlineHeading[] = [];
  for (const block of blocks) {
    if (block.node.type !== 'heading') continue;
    headings.push({
      depth: (block.node as Heading).depth,
      text: textOf(block.node).trim(),
      blockIndex: block.index,
      line: lineAt(source, block.start),
    });
  }
  const h1 = headings.find((h) => h.depth === 1);

  return {
    source,
    tree,
    frontmatter,
    frontmatterRange,
    title: h1 ? h1.text : null,
    blocks,
    annotations,
    headings,
    words: wordsOf(tree),
  };
}

/** Markdown with every MoSage marker removed — what gets exported. */
export function stripMarkers(source: string): string {
  const { annotations } = parseChapter(source);
  let out = source;
  for (const a of [...annotations].reverse()) {
    let end = a.end;
    if (out[end] === '\n') end++;
    out = out.slice(0, a.start) + out.slice(end);
  }
  return out;
}
