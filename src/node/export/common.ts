// Helpers shared by the exporters: a clean tree per chapter, localized labels,
// GitHub alerts, and loading the images a chapter points at.

import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';
import type {
  Blockquote,
  Definition,
  FootnoteDefinition,
  Nodes,
  Paragraph,
  Parent,
  Root,
} from 'mdast';
import { isMarker } from '../../shared/annotations.ts';
import { parseMarkdown, stripMarkers } from '../../shared/markdown.ts';

export function isEnglish(language: string): boolean {
  return /^en\b/i.test(language.trim());
}

export function isCjkLanguage(language: string): boolean {
  return /^(zh|ja|ko)\b/i.test(language.trim());
}

export type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

export const ALERT_TYPES: AlertType[] = ['note', 'tip', 'important', 'warning', 'caution'];

/** GitHub's alert colours, used for the left border of a callout. */
export const ALERT_COLORS: Record<AlertType, string> = {
  note: '0969DA',
  tip: '1A7F37',
  important: '8250DF',
  warning: '9A6700',
  caution: 'CF222E',
};

export interface Labels {
  contents: string;
  untitled: string;
  image: string;
  footnotes: string;
  backToText: string;
  frontMatter: string;
  alerts: Record<AlertType, string>;
}

const ZH: Labels = {
  contents: '目錄',
  untitled: '未命名',
  image: '圖',
  footnotes: '註釋',
  backToText: '回到內文',
  frontMatter: '前言素材',
  alerts: { note: '注意', tip: '提示', important: '重要', warning: '警告', caution: '小心' },
};

const EN: Labels = {
  contents: 'Contents',
  untitled: 'Untitled',
  image: 'Image',
  footnotes: 'Notes',
  backToText: 'Back to text',
  frontMatter: 'Front matter',
  alerts: {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
  },
};

export function labelsFor(language: string): Labels {
  return isEnglish(language) ? EN : ZH;
}

/** `[圖：說明]` — what a picture that cannot be embedded turns into. */
export function imagePlaceholder(alt: string, labels: Labels): string {
  const text = alt.trim();
  if (!text) return `[${labels.image}]`;
  return labels === EN ? `[${labels.image}: ${text}]` : `[${labels.image}：${text}]`;
}

/** Depth-first walk over every node below `node`. */
export function walk(
  node: Nodes,
  visit: (node: Nodes, parent: Parent, index: number) => void,
): void {
  if (!('children' in node)) return;
  const parent = node as Parent;
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i] as Nodes;
    visit(child, parent, i);
    walk(child, visit);
  }
}

/**
 * A chapter as the exporters see it: annotation markers and the frontmatter
 * removed, at any depth (stripMarkers only handles top-level markers).
 */
export function prepareChapter(source: string): Root {
  const tree = parseMarkdown(stripMarkers(source));
  const prune = (node: Parent) => {
    node.children = node.children.filter(
      (child) => !(child.type === 'yaml' || (child.type === 'html' && isMarker(child.value))),
    ) as typeof node.children;
    for (const child of node.children) if ('children' in child) prune(child as Parent);
  };
  prune(tree);
  return tree;
}

export function collectDefinitions(tree: Root): Map<string, Definition> {
  const map = new Map<string, Definition>();
  walk(tree, (node) => {
    if (node.type === 'definition' && !map.has(node.identifier)) map.set(node.identifier, node);
  });
  return map;
}

export function collectFootnotes(tree: Root): Map<string, FootnoteDefinition> {
  const map = new Map<string, FootnoteDefinition>();
  walk(tree, (node) => {
    if (node.type === 'footnoteDefinition' && !map.has(node.identifier)) {
      map.set(node.identifier, node);
    }
  });
  return map;
}

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n[ \t]*|$)/i;

/**
 * A GitHub alert (`> [!NOTE]`): its type and the blockquote's content without
 * the `[!NOTE]` line. Null for an ordinary blockquote.
 */
export function readAlert(
  node: Blockquote,
): { type: AlertType; children: Blockquote['children'] } | null {
  const first = node.children[0];
  if (first?.type !== 'paragraph') return null;
  const head = first.children[0];
  if (head?.type !== 'text') return null;
  const match = ALERT_RE.exec(head.value);
  if (!match) return null;
  // `[!NOTE]` followed by a hard break (two trailing spaces) leaves a `break` node.
  const rest = head.value.slice(match[0].length);
  const inline = [...first.children.slice(1)];
  if (rest) inline.unshift({ ...head, value: rest });
  else if (inline[0]?.type === 'break') inline.shift();
  const paragraph: Paragraph = { ...first, children: inline };
  const hasText = inline.some((c) => c.type !== 'text' || c.value.trim() !== '');
  return {
    type: match[1].toLowerCase() as AlertType,
    children: hasText ? [paragraph, ...node.children.slice(1)] : node.children.slice(1),
  };
}

// ---------------------------------------------------------------------------
// Text

const CJK_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯⺀-⿟]/u;

function charBefore(s: string, i: number): string {
  const code = s.charCodeAt(i - 1);
  return code >= 0xdc00 && code <= 0xdfff && i >= 2 ? s.slice(i - 2, i) : s.charAt(i - 1);
}

function charAt(s: string, i: number): string {
  const cp = s.codePointAt(i);
  return cp === undefined ? '' : String.fromCodePoint(cp);
}

/**
 * Soft line breaks inside a paragraph: gone between two CJK characters
 * (Chinese has no spaces between words), a space everywhere else.
 */
export function joinSoftBreaks(text: string): string {
  if (!text.includes('\n')) return text;
  return text.replace(/[ \t]*\r?\n[ \t]*/g, (match: string, offset: number, s: string) => {
    const before = charBefore(s, offset);
    const after = charAt(s, offset + match.length);
    return CJK_RE.test(before) && CJK_RE.test(after) ? '' : ' ';
  });
}

/** A file name for the export: no path separators or characters Windows refuses; CJK kept. */
export function sanitizeFileName(name: string): string {
  const clean = name
    .replace(/[/\\:*?"<>|]/g, '')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 120)
    .trim();
  return clean || 'manuscript';
}

// ---------------------------------------------------------------------------
// Images

export interface LoadedImage {
  data: Buffer;
  /** `png`, `jpg`, `gif`, `bmp`, `svg`, `webp`, … */
  type: string;
  mime: string;
  width: number;
  height: number;
  name: string;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
};

const EXT_TYPE: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.gif': 'gif',
  '.bmp': 'bmp',
  '.svg': 'svg',
  '.webp': 'webp',
  '.avif': 'avif',
  '.ico': 'ico',
  '.tif': 'tiff',
  '.tiff': 'tiff',
};

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const WINDOWS_PATH_RE = /^[a-z]:[\\/]/i;

/** http:, https:, mailto:, data: … — anything that is not a file on this computer. */
export function isExternalUrl(url: string): boolean {
  return SCHEME_RE.test(url) && !WINDOWS_PATH_RE.test(url) && !/^file:/i.test(url);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Where a local image URL may point, most likely first. Chapter images are
 * relative to `<root>/chapters/`; be lenient and also try `<root>/`.
 */
export function imageCandidates(url: string, root: string): string[] {
  let path = url.trim();
  if (!path || isExternalUrl(path)) return [];
  if (/^file:/i.test(path)) {
    try {
      return [fileURLToPath(path)];
    } catch {
      return [];
    }
  }
  path = path.replace(/[?#].*$/, '');
  const decoded = safeDecode(path);
  const variants = decoded === path ? [path] : [decoded, path];
  const out: string[] = [];
  for (const p of variants) {
    if (isAbsolute(p) || WINDOWS_PATH_RE.test(p)) {
      out.push(p, join(root, p));
    } else {
      out.push(join(root, 'chapters', p), join(root, p));
    }
  }
  return [...new Set(out)];
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The file a local image URL refers to, or null when it does not exist. */
export function resolveLocalFile(url: string, root: string): string | null {
  return imageCandidates(url, root).find(isFile) ?? null;
}

function describe(data: Buffer, name: string): LoadedImage | null {
  let type = EXT_TYPE[extname(name).toLowerCase()] ?? '';
  let width = 0;
  let height = 0;
  try {
    const size = imageSize(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    width = size.width ?? 0;
    height = size.height ?? 0;
    if (size.type) type = size.type === 'jpeg' ? 'jpg' : size.type;
  } catch {
    if (type !== 'svg') return null;
  }
  if (!type) return null;
  return { data, type, mime: MIME[type] ?? `image/${type}`, width, height, name };
}

/** Read a local image (or a `data:` URI). Null for remote, missing or unreadable images. */
export async function loadImage(url: string, root: string): Promise<LoadedImage | null> {
  const dataUri = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,(.*)$/is.exec(url.trim());
  if (dataUri) {
    try {
      const payload = dataUri[3]
        ? Buffer.from(dataUri[4], 'base64')
        : Buffer.from(safeDecode(dataUri[4]), 'utf8');
      const ext = Object.entries(MIME).find(([, m]) => m === dataUri[1].toLowerCase())?.[0];
      return describe(payload, `image.${ext ?? 'bin'}`);
    } catch {
      return null;
    }
  }
  const file = resolveLocalFile(url, root);
  if (!file) return null;
  try {
    return describe(await readFile(file), basename(file));
  } catch {
    return null;
  }
}

/** Load every image of a set of URLs once. */
export async function loadImages(
  urls: Iterable<string>,
  root: string,
): Promise<Map<string, LoadedImage | null>> {
  const unique = [...new Set(urls)];
  const loaded = await Promise.all(unique.map((url) => loadImage(url, root)));
  return new Map(unique.map((url, i) => [url, loaded[i]]));
}

/** Every image URL of a tree, including `![x][ref]` references. */
export function imageUrls(tree: Root): string[] {
  const definitions = collectDefinitions(tree);
  const urls: string[] = [];
  walk(tree, (node) => {
    if (node.type === 'image') urls.push(node.url);
    else if (node.type === 'imageReference') {
      const def = definitions.get(node.identifier);
      if (def) urls.push(def.url);
    }
  });
  return urls;
}

// ---------------------------------------------------------------------------
// Source edits

export interface SourceEdit {
  start: number;
  end: number;
  text: string;
}

/** Apply non-overlapping replacements to a source; an edit overlapping an earlier one is dropped. */
export function applyEdits(source: string, edits: SourceEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let out = '';
  let pos = 0;
  for (const edit of sorted) {
    if (edit.start < pos) continue;
    out += source.slice(pos, edit.start) + edit.text;
    pos = edit.end;
  }
  return out + source.slice(pos);
}

/** `<url>` when the URL needs it, so spaces and parentheses survive. */
export function markdownUrl(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>` : url;
}

export function markdownTitle(title: string | null | undefined): string {
  return title ? ` "${title.replace(/["\\]/g, '\\$&')}"` : '';
}

export function markdownAlt(alt: string): string {
  return alt.replace(/[\\[\]]/g, '\\$&').replace(/\s*\n\s*/g, ' ');
}
