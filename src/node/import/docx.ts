// Read a Word manuscript: mammoth turns it into HTML (Word styles → HTML
// elements, images saved into assets/imported/), turndown turns that into
// GitHub-flavoured Markdown with real footnotes.

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { ImportTarget } from '../export/types.ts';
import { type ImportLog, safeName } from './markdown.ts';

/** Word styles MoSage writes, and common ones mammoth does not know. */
const STYLE_MAP = [
  // The table of contents is rebuilt on export; its entries are just noise here.
  "p[style-name='TOC Heading'] => !",
  ...Array.from({ length: 9 }, (_, i) => `p[style-name='toc ${i + 1}'] => !`),
  "p[style-name='Title'] => p:fresh",
  "p[style-name='Subtitle'] => p:fresh",
  "p[style-name='Author'] => p:fresh",
  "p[style-name='Body Text'] => p:fresh",
  "p[style-name='Body Text Indent'] => p:fresh",
  "p[style-name='Body Text First Indent'] => p:fresh",
  "p[style-name='First Paragraph'] => p:fresh",
  "p[style-name='Compact'] => p:fresh",
  "p[style-name='Figure'] => p:fresh",
  "p[style-name='Captioned Figure'] => p:fresh",
  "p[style-name='caption'] => p:fresh",
  "p[style-name='Caption'] => p:fresh",
  "p[style-name='Image Caption'] => p:fresh",
  "p[style-name='Table Text'] => p:fresh",
  "p[style-name='List Continue'] => p:fresh",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
  "p[style-name='Block Text'] => blockquote > p:fresh",
  "p[style-name='Callout'] => blockquote.callout > p:fresh",
  "p[style-name='Code'] => pre:separator('\\n')",
  "p[style-name='Source Code'] => pre:separator('\\n')",
  "p[style-name='HTML Preformatted'] => pre:separator('\\n')",
  "p[style-name='Scene Break'] => p.scene-break:fresh",
  "r[style-name='Inline Code'] => code",
  "r[style-name='Verbatim Char'] => code",
  "r[style-name='HTML Code'] => code",
];

const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/x-emf': 'emf',
  'image/emf': 'emf',
  'image/x-wmf': 'wmf',
  'image/wmf': 'wmf',
};

const ALERT_LABELS: Record<string, string> = {
  注意: 'NOTE',
  提示: 'TIP',
  重要: 'IMPORTANT',
  警告: 'WARNING',
  小心: 'CAUTION',
  note: 'NOTE',
  tip: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'CAUTION',
};

const FOOTNOTE_REF_RE = /^#(footnote|endnote)-(\d+)$/;
const FOOTNOTE_BACK_RE = /^#(footnote|endnote)-ref-\d+$/;
const FOOTNOTE_ITEM_RE = /^(footnote|endnote)-(\d+)$/;

function noteLabel(kind: string, n: string): string {
  return kind === 'endnote' ? `e${n}` : n;
}

function closest(node: Node, name: string): Node | null {
  let current = node.parentNode;
  while (current && current.nodeName !== name) current = current.parentNode;
  return current;
}

/** Text of a `<pre>`, with `<br>` as line breaks. */
function preText(node: Node): string {
  let out = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) out += child.nodeValue ?? '';
    else if (child.nodeName === 'BR') out += '\n';
    else out += preText(child);
  }
  return out;
}

function tableCell(content: string, node: HTMLElement): string {
  let text = content
    .trim()
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\|/g, '\\|');
  // Header cells are bold anyway.
  if (node.nodeName === 'TH') text = text.replace(/^\*\*(.*)\*\*$/, '$1');
  const span = Number(node.getAttribute('colspan') ?? '1');
  const cell = ` ${text} |`;
  return cell + ' |'.repeat(Number.isFinite(span) && span > 1 ? Math.min(span, 50) - 1 : 0);
}

export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    hr: '---',
    fence: '```',
  });
  service.use(gfm);

  // Rules added later win, so these override turndown's own and the gfm plugin's.
  service.addRule('strikethrough', {
    filter: ['del', 's', 'strike'] as TurndownService.Filter,
    replacement: (content) => (content.trim() ? `~~${content}~~` : content),
  });
  service.addRule('listItem', {
    filter: 'li',
    replacement: (content, node, options) => {
      const li = node;
      const parent = li.parentNode as HTMLElement | null;
      let prefix = `${options.bulletListMarker} `;
      if (parent?.nodeName === 'OL') {
        const start = Number(parent.getAttribute('start') ?? '1');
        const index = Array.from(parent.children).indexOf(li);
        prefix = `${(Number.isFinite(start) ? start : 1) + index}. `;
      }
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n(?!$)/gm, `\n${' '.repeat(prefix.length)}`);
      return prefix + body + (li.nextSibling && !/\n$/.test(body) ? '\n' : '');
    },
  });
  service.addRule('preformatted', {
    filter: (node) => node.nodeName === 'PRE' && node.firstChild?.nodeName !== 'CODE',
    replacement: (_content, node) => {
      const text = preText(node).replace(/\n+$/, '');
      const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((m) => m.length));
      const fence = '`'.repeat(longest + 1);
      return `\n\n${fence}\n${text}\n${fence}\n\n`;
    },
  });
  service.addRule('sceneBreak', {
    filter: (node) =>
      node.nodeName === 'P' && /\bscene-break\b/.test(node.getAttribute('class') ?? ''),
    replacement: () => '\n\n---\n\n',
  });
  service.addRule('supSub', {
    filter: ['sup', 'sub'],
    replacement: (content, node) => {
      const el = node;
      const only = Array.from(el.children);
      if (
        only.length === 1 &&
        only[0].nodeName === 'A' &&
        FOOTNOTE_REF_RE.test(only[0].getAttribute('href') ?? '')
      ) {
        return content;
      }
      if (!content.trim()) return content;
      const tag = el.nodeName.toLowerCase();
      return `<${tag}>${content}</${tag}>`;
    },
  });

  // Tables: GFM needs a header row, so the first row always is one.
  service.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content, node) => {
      const el = node;
      const first = el.parentNode ? Array.from(el.parentNode.children).indexOf(el) === 0 : true;
      return (first ? '|' : '') + tableCell(content, el);
    },
  });
  service.addRule('tableRow', {
    filter: 'tr',
    replacement: (content, node) => {
      const tr = node;
      const table = closest(tr, 'TABLE') as HTMLTableElement | null;
      const isFirst = table?.rows ? table.rows[0] === tr : false;
      if (!isFirst) return `\n${content}`;
      let cols = 0;
      for (const cell of Array.from(tr.children)) {
        const span = Number(cell.getAttribute('colspan') ?? '1');
        cols += Number.isFinite(span) && span > 1 ? Math.min(span, 50) : 1;
      }
      return `\n${content}\n|${' --- |'.repeat(Math.max(1, cols))}`;
    },
  });
  service.addRule('tableSection', {
    filter: ['thead', 'tbody', 'tfoot'],
    replacement: (content) => content,
  });
  service.addRule('table', {
    filter: 'table',
    replacement: (content) => `\n\n${content.replace(/\n+/g, '\n').trim()}\n\n`,
  });

  // Links: internal anchors (bookmarks, TOC) become plain text, bare URLs autolinks.
  service.addRule('internalLink', {
    filter: (node) => node.nodeName === 'A' && (node.getAttribute('href') ?? '').startsWith('#'),
    replacement: (content) => content,
  });
  service.addRule('autolink', {
    filter: (node) => {
      const href = node.getAttribute('href') ?? '';
      return (
        node.nodeName === 'A' && /^https?:\/\//i.test(href) && node.textContent?.trim() === href
      );
    },
    replacement: (_content, node) => `<${node.getAttribute('href')}>`,
  });

  // mammoth's notes: `<sup><a href="#footnote-1">[1]</a></sup>` in the text and
  // `<ol><li id="footnote-1">… <a href="#footnote-ref-1">↑</a></li></ol>` at the end.
  service.addRule('footnoteReference', {
    filter: (node) =>
      node.nodeName === 'A' && FOOTNOTE_REF_RE.test(node.getAttribute('href') ?? ''),
    replacement: (_content, node) => {
      const [, kind, n] = FOOTNOTE_REF_RE.exec(node.getAttribute('href') ?? '') ?? [];
      return `[^${noteLabel(kind, n)}]`;
    },
  });
  service.addRule('footnoteBackLink', {
    filter: (node) =>
      node.nodeName === 'A' && FOOTNOTE_BACK_RE.test(node.getAttribute('href') ?? ''),
    replacement: () => '',
  });
  service.addRule('footnoteItem', {
    filter: (node) =>
      node.nodeName === 'LI' && FOOTNOTE_ITEM_RE.test(node.getAttribute('id') ?? ''),
    replacement: (content, node) => {
      const [, kind, n] = FOOTNOTE_ITEM_RE.exec(node.getAttribute('id') ?? '') ?? [];
      const text = content
        .trim()
        .split('\n')
        .map((line, i) => (i === 0 || !line.trim() ? line.trimEnd() : `    ${line}`))
        .join('\n');
      return `\n\n[^${noteLabel(kind, n)}]: ${text}\n\n`;
    },
  });
  service.addRule('footnoteList', {
    filter: (node) => {
      if (node.nodeName !== 'OL') return false;
      const items = Array.from(node.children);
      return (
        items.length > 0 && items.every((li) => FOOTNOTE_ITEM_RE.test(li.getAttribute('id') ?? ''))
      );
    },
    replacement: (content) => `\n\n${content.trim()}\n\n`,
  });

  let markdown = service.turndown(html);

  // A callout exported by MoSage: a blockquote opening with a bold label line.
  markdown = markdown.replace(
    /^> \*\*([^*\n]+)\*\*[ \t]*\n>[ \t]*\n/gm,
    (match: string, label: string) => {
      const type = ALERT_LABELS[label.trim().toLowerCase()] ?? ALERT_LABELS[label.trim()];
      return type ? `> [!${type}]\n` : match;
    },
  );
  // An image followed by a caption repeating its alt text: the caption is redundant.
  markdown = markdown.replace(
    /^(!\[([^\]\n]+)\]\([^)\n]*\))\n\n([^\n]+)\n(?=\n|$)/gm,
    (match: string, image: string, alt: string, caption: string) =>
      caption.replace(/\\(.)/g, '$1').trim() === alt.trim() ? `${image}\n` : match,
  );
  return `${markdown.replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function translateMessage(message: string): string {
  const style = /^Unrecognised (paragraph|run) style: '(.*)' \(Style ID: (.*)\)$/.exec(message);
  if (style) {
    return `Word 樣式「${style[2]}」沒有對應的 Markdown 格式，已當成一般${style[1] === 'run' ? '文字' : '段落'}匯入。`;
  }
  return `Word 轉換：${message}`;
}

/** Convert a .docx file to Markdown, saving its images into `<root>/assets/imported/`. */
export async function readDocxFile(
  file: string,
  target: ImportTarget,
  log: ImportLog,
): Promise<string> {
  const stem = safeName(basename(file, extname(file)));
  const dir = join(target.root, 'assets', 'imported');
  let count = 0;
  let metafiles = 0;
  const convertImage = mammoth.images.imgElement(async (image) => {
    const ext = IMAGE_EXT[image.contentType?.toLowerCase() ?? ''] ?? 'bin';
    let dest: string;
    do {
      count++;
      dest = join(dir, `${stem}-${count}.${ext}`);
    } while (existsSync(dest));
    const data = await image.readAsBuffer();
    await mkdir(dir, { recursive: true });
    await writeFile(dest, data);
    log.assets.push(relative(target.root, dest).split(sep).join('/'));
    if (ext === 'emf' || ext === 'wmf') metafiles++;
    return { src: relative(target.chaptersDir, dest).split(sep).join('/') };
  });

  const result = await mammoth.convertToHtml({ path: file }, { styleMap: STYLE_MAP, convertImage });
  const seen = new Set<string>();
  for (const message of result.messages) {
    const text = translateMessage(message.message);
    if (!seen.has(text)) {
      seen.add(text);
      log.warnings.push(text);
    }
  }
  if (metafiles) {
    log.warnings.push(
      `有 ${metafiles} 張圖片是 Windows 圖元檔（EMF/WMF），瀏覽器和匯出都無法顯示，建議在 Word 裡另存成 PNG 後替換。`,
    );
  }
  return htmlToMarkdown(result.value);
}
