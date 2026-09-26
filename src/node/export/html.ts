// Markdown chapters → one self-contained, print-ready HTML file: open it in a
// browser and print to PDF. Images are inlined, typography follows mosage.yaml.

import type { Element, ElementContent, Nodes as HastNodes, Root as HastRoot } from 'hast';
import type { Emphasis, Nodes, Parent, PhrasingContent, Root, RootContent } from 'mdast';
import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { pageSizeMm } from '../../shared/config.ts';
import { isPageBreak, textOf } from '../../shared/markdown.ts';
import {
  ALERT_COLORS,
  ALERT_TYPES,
  collectDefinitions,
  imagePlaceholder,
  imageUrls,
  joinSoftBreaks,
  type Labels,
  type LoadedImage,
  labelsFor,
  loadImages,
  prepareChapter,
  readAlert,
} from './common.ts';
import type { ManuscriptInput } from './types.ts';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** A value for a double-quoted CSS string. `<` is escaped so it can never close the style element. */
function cssString(text: string): string {
  return `"${text
    .replace(/[\r\n\f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\3c ')}"`;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Inline HTML tags kept as formatting (raw HTML itself is never passed through). */
const INLINE_TAGS = new Set([
  'sup',
  'sub',
  'u',
  'ins',
  'mark',
  's',
  'del',
  'b',
  'strong',
  'i',
  'em',
  'kbd',
  'small',
]);

/** `x<sup>2</sup>` arrives as html, text, html siblings: wrap what is between into a real element. */
function wrapInlineHtml(parent: Parent): void {
  const kids = parent.children as Nodes[];
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i];
    if (node.type !== 'html') continue;
    const open = /^<([a-z]+)(?:\s[^<>]*)?>$/i.exec(node.value.trim());
    const tag = open?.[1].toLowerCase();
    if (!tag || !INLINE_TAGS.has(tag)) continue;
    const closing = new RegExp(`^</${tag}\\s*>$`, 'i');
    const close = kids.findIndex(
      (n, j) => j > i && n.type === 'html' && closing.test(n.value.trim()),
    );
    if (close === -1) continue;
    const wrapped: Emphasis = {
      type: 'emphasis',
      data: { hName: tag },
      children: kids.slice(i + 1, close) as PhrasingContent[],
    };
    kids.splice(i, close - i + 1, wrapped);
  }
}

/** remark-rehype does not prefix the footnote label id; give each chapter its own. */
function prefixFootnoteLabel(node: HastNodes, prefix: string): void {
  if (node.type === 'element') {
    const props = node.properties;
    if (props.id === 'footnote-label') props.id = `${prefix}footnote-label`;
    if (Array.isArray(props.ariaDescribedBy)) {
      props.ariaDescribedBy = props.ariaDescribedBy.map((v) =>
        v === 'footnote-label' ? `${prefix}footnote-label` : v,
      );
    }
  }
  if ('children' in node) for (const child of node.children) prefixFootnoteLabel(child, prefix);
}

interface TocEntry {
  level: number;
  text: string;
  id: string;
}

interface Figure {
  src: string | null;
  alt: string;
  title?: string;
}

function element(tagName: string, className: string | null, children: ElementContent[]): Element {
  return {
    type: 'element',
    tagName,
    properties: className ? { className: [className] } : {},
    children,
  };
}

class HtmlBuilder {
  private readonly labels: Labels;
  private images = new Map<string, LoadedImage | null>();
  private readonly toc: TocEntry[] = [];

  constructor(private readonly input: ManuscriptInput) {
    this.labels = labelsFor(input.config.language);
  }

  async build(): Promise<string> {
    const trees = this.input.chapters.map((c) => prepareChapter(c.source));
    this.images = await loadImages(
      trees.flatMap((t) => imageUrls(t)),
      this.input.root,
    );
    const sections: string[] = [];
    for (const [i, tree] of trees.entries()) {
      const prefix = `ch${i + 1}-`;
      this.transform(tree, prefix);
      const processor = unified()
        .use(remarkRehype, {
          allowDangerousHtml: false,
          clobberPrefix: prefix,
          footnoteLabel: this.labels.footnotes,
          footnoteLabelTagName: 'h2',
          footnoteLabelProperties: { className: ['footnotes-title'] },
          footnoteBackLabel: (n: number) => `${this.labels.backToText} ${n + 1}`,
        })
        .use(rehypeStringify);
      const hast = (await processor.run(tree)) as HastRoot;
      prefixFootnoteLabel(hast, prefix);
      const body = processor.stringify(hast);
      sections.push(
        `<section class="chapter" id="${prefix}start" data-chapter="${escapeHtml(this.input.chapters[i].id)}">\n${body}\n</section>`,
      );
    }
    const { config } = this.input;
    const title = config.title || this.labels.untitled;
    return [
      '<!DOCTYPE html>',
      `<html lang="${escapeHtml(config.language || 'zh-TW')}">`,
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="generator" content="MoSage">',
      config.author ? `<meta name="author" content="${escapeHtml(config.author)}">` : '',
      `<title>${escapeHtml(title)}</title>`,
      `<style>\n${this.css()}\n</style>`,
      '</head>',
      '<body>',
      config.export.titlePage ? this.titlePage() : '',
      config.export.toc ? this.contents() : '',
      '<main>',
      sections.join('\n'),
      '</main>',
      '</body>',
      '</html>',
      '',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private titlePage(): string {
    const c = this.input.config;
    return [
      '<header class="title-page">',
      `<h1 class="book-title">${escapeHtml(c.title || this.labels.untitled)}</h1>`,
      c.subtitle ? `<p class="book-subtitle">${escapeHtml(c.subtitle)}</p>` : '',
      c.author ? `<p class="book-author">${escapeHtml(c.author)}</p>` : '',
      '</header>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private contents(): string {
    const items = this.toc
      .map(
        (e) =>
          `<li class="toc-${e.level}"><a href="#${escapeHtml(e.id)}">${escapeHtml(e.text)}</a></li>`,
      )
      .join('\n');
    return `<nav class="toc" aria-labelledby="toc-title">\n<h2 id="toc-title" class="toc-title">${escapeHtml(this.labels.contents)}</h2>\n<ol class="toc-list">\n${items}\n</ol>\n</nav>`;
  }

  /** Rewrite the mdast in place: ids, alerts, scene and page breaks, images, soft breaks. */
  private transform(tree: Root, prefix: string): void {
    const definitions = collectDefinitions(tree);
    let headings = 0;

    const visit = (parent: Parent) => {
      wrapInlineHtml(parent);
      const children = parent.children as Nodes[];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        switch (node.type) {
          case 'heading': {
            const id = `${prefix}h${++headings}`;
            node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
            const text = joinSoftBreaks(textOf(node)).trim();
            if (node.depth <= 3 && text && parent.type === 'root') {
              this.toc.push({ level: node.depth, text, id });
            }
            break;
          }
          case 'blockquote': {
            const alert = readAlert(node);
            if (alert) {
              node.children = [
                {
                  type: 'paragraph',
                  data: { hProperties: { className: ['callout-title'] } },
                  children: [{ type: 'text', value: this.labels.alerts[alert.type] }],
                },
                ...alert.children,
              ];
              node.data = {
                ...node.data,
                hName: 'aside',
                hProperties: { className: ['callout', `callout-${alert.type}`] },
              };
            }
            break;
          }
          case 'thematicBreak':
            children[i] = {
              type: 'paragraph',
              data: { hProperties: { className: ['scene-break'] } },
              children: [{ type: 'text', value: this.input.config.export.sceneBreak }],
            };
            continue;
          case 'html':
            if (isPageBreak(node as RootContent)) {
              children[i] = {
                type: 'paragraph',
                data: { hName: 'div', hProperties: { className: ['page-break'] } },
                children: [],
              };
            } else if (/^<br\s*\/?>$/i.test(node.value.trim())) {
              children[i] = { type: 'break' };
            }
            continue;
          case 'text':
            node.value = joinSoftBreaks(node.value);
            continue;
          case 'paragraph': {
            const figure = this.figureOf(node.children, definitions);
            if (figure) {
              node.data = { ...node.data, hName: 'figure', hChildren: this.figure(figure) };
              continue;
            }
            break;
          }
          case 'image':
          case 'imageReference': {
            const def = node.type === 'imageReference' ? definitions.get(node.identifier) : null;
            const url = node.type === 'image' ? node.url : def?.url;
            const src = url === undefined ? null : this.source(url);
            if (src === null) {
              children[i] = {
                type: 'text',
                value: imagePlaceholder(joinSoftBreaks(node.alt ?? ''), this.labels),
              };
            } else if (node.type === 'image') {
              node.url = src;
            } else if (def) {
              children[i] = { type: 'image', url: src, alt: node.alt, title: def.title };
            }
            continue;
          }
        }
        if ('children' in node) visit(node as Parent);
      }
    };
    visit(tree);
  }

  /** Data URI of a local image, the URL itself for a remote one, null when it cannot be shown. */
  private source(url: string): string | null {
    if (/^https?:\/\//i.test(url.trim())) return url.trim();
    const image = this.images.get(url);
    return image ? `data:${image.mime};base64,${image.data.toString('base64')}` : null;
  }

  private figureOf(
    children: PhrasingContent[],
    definitions: ReturnType<typeof collectDefinitions>,
  ): Figure | null {
    const content = children.filter((c) => !(c.type === 'text' && !c.value.trim()));
    if (content.length !== 1) return null;
    const only = content[0];
    let url: string | undefined;
    let title: string | undefined;
    if (only.type === 'image') {
      url = only.url;
      title = only.title ?? undefined;
    } else if (only.type === 'imageReference') {
      const def = definitions.get(only.identifier);
      url = def?.url;
      title = def?.title ?? undefined;
    }
    if (url === undefined || (only.type !== 'image' && only.type !== 'imageReference')) return null;
    const alt = joinSoftBreaks(only.alt ?? '').trim();
    return { src: this.source(url), alt, title };
  }

  private figure(figure: Figure): ElementContent[] {
    if (figure.src === null) {
      return [
        element('p', 'image-missing', [
          { type: 'text', value: imagePlaceholder(figure.alt, this.labels) },
        ]),
      ];
    }
    const img: Element = {
      type: 'element',
      tagName: 'img',
      properties: {
        src: figure.src,
        alt: figure.alt,
        ...(figure.title ? { title: figure.title } : {}),
      },
      children: [],
    };
    if (!figure.alt) return [img];
    return [img, element('figcaption', null, [{ type: 'text', value: figure.alt }])];
  }

  private css(): string {
    const { config } = this.input;
    const e = config.export;
    const size = pageSizeMm(e.pageSize);
    const m = e.margins;
    const contentHeight = Math.max(20, size.height - m.top - m.bottom);
    const bodyFonts = `${cssString(e.fonts.latin)}, ${cssString(e.fonts.body)}, serif`;
    const headingFonts = `${cssString(e.fonts.latin)}, ${cssString(e.fonts.heading)}, serif`;
    const codeFonts = `${cssString(e.fonts.code)}, ${cssString(e.fonts.body)}, monospace`;
    // Word's "1.5 lines" is 1.5 × the font's own line height, which for CJK
    // fonts is about 1.2em — hence the factor.
    const lineHeight = round(Math.max(1, e.lineSpacing) * 1.2);
    const pageBox: string[] = [];
    if (e.pageNumbers) pageBox.push('  @bottom-center { content: counter(page); font-size: 9pt; }');
    if (e.header === 'title' && config.title) {
      pageBox.push(
        `  @top-center { content: ${cssString(config.title)}; font-size: 9pt; color: #595959; }`,
      );
    }
    const alerts = ALERT_TYPES.map(
      (type) =>
        `.callout-${type} { border-left-color: #${ALERT_COLORS[type]}; }\n.callout-${type} .callout-title { color: #${ALERT_COLORS[type]}; }`,
    ).join('\n');

    return `@page {
  size: ${size.width}mm ${size.height}mm;
  margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
${pageBox.join('\n')}
}
@page front {
  @top-center { content: none; }
  @bottom-center { content: none; }
}
:root { color-scheme: light; }
html { background: #fff; color: #000; }
body {
  font-family: ${bodyFonts};
  font-size: ${e.fontSize}pt;
  line-height: ${lineHeight};
  margin: 0;
  text-rendering: optimizeLegibility;
  font-kerning: normal;
}
@media screen {
  body { max-width: ${round(size.width - m.left - m.right)}mm; margin: 2em auto 6em; padding: 0 1.5em; }
  .title-page, .toc, .chapter { border-bottom: 1px dashed #ccc; padding-bottom: 2em; margin-bottom: 2em; }
}
h1, h2, h3, h4, h5, h6 {
  font-family: ${headingFonts};
  font-weight: bold;
  line-height: 1.3;
  break-after: avoid;
  page-break-after: avoid;
}
.chapter h1 { font-size: 1.75em; text-align: center; margin: 2em 0 1.5em; }
.chapter h2 { font-size: 1.4em; margin: 1.5em 0 0.5em; }
.chapter h3 { font-size: 1.2em; margin: 1em 0 0.5em; }
.chapter h4, .chapter h5, .chapter h6 { font-size: 1.05em; margin: 0.75em 0 0.25em; }
p { margin: 0 0 ${e.paragraphSpacing}pt; text-align: justify; orphans: 2; widows: 2; }
.chapter p { text-indent: ${e.firstLineIndent}em; }
.chapter li p, .chapter blockquote p, .chapter td p, .chapter th p, .chapter .footnotes p,
.chapter figure p, .chapter p.scene-break, .chapter p.callout-title { text-indent: 0; }
.title-page {
  page: front;
  break-after: page;
  page-break-after: always;
  min-height: calc(${contentHeight}mm - 2mm);
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}
.book-title { font-size: 2.4em; margin: 0 0 1em; }
.book-subtitle { font-size: 1.5em; margin: 0 0 1em; text-indent: 0; text-align: center; }
.book-author { font-size: 1.25em; margin: 3em 0 0; text-indent: 0; text-align: center; }
.toc { page: front; break-after: page; page-break-after: always; }
.toc-title { text-align: center; font-size: 1.75em; margin: 2em 0 1.5em; }
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-list a { color: inherit; text-decoration: none; }
.toc-1 { margin-top: 0.5em; }
.toc-2 { padding-left: 2em; }
.toc-3 { padding-left: 4em; }
${e.chapterPageBreak ? '.chapter { break-before: page; page-break-before: always; }' : '.chapter + .chapter { margin-top: 3em; }'}
.page-break { break-after: page; page-break-after: always; height: 0; }
.scene-break { text-align: center; margin: 1em 0; }
blockquote {
  margin: 0 2em ${Math.max(e.paragraphSpacing, 6)}pt;
  padding-left: 0.8em;
  border-left: 2px solid #a6a6a6;
  color: #404040;
}
.callout {
  margin: 1em 0.5em;
  padding: 0.5em 1em;
  background: #f3f5f8;
  border-left: 4px solid #7f8c9a;
  break-inside: avoid;
}
.callout > :last-child { margin-bottom: 0; }
.callout-title { font-weight: bold; margin-bottom: 0.25em; }
${alerts}
pre {
  font-family: ${codeFonts};
  font-size: 0.85em;
  line-height: 1.35;
  background: #f2f2f2;
  padding: 0.6em 0.8em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0.25em 0 1em;
}
code { font-family: ${codeFonts}; font-size: 0.9em; }
:not(pre) > code { background: #f2f2f2; padding: 0 0.2em; border-radius: 2px; }
ul, ol { margin: 0 0 ${e.paragraphSpacing}pt; padding-left: 2em; }
li > p { margin: 0; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0 1em; font-size: 0.95em; line-height: 1.4; }
th, td { border: 1px solid #808080; padding: 0.25em 0.5em; vertical-align: middle; }
th { background: #f2f2f2; font-weight: bold; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
figure { margin: 1em 0; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: ${round(contentHeight * 0.8)}mm; }
figcaption { font-size: 0.85em; color: #404040; margin-top: 0.3em; text-indent: 0; }
img { max-width: 100%; }
a { color: #0563c1; }
.footnotes { margin-top: 2em; border-top: 1px solid #999; font-size: 0.85em; }
.footnotes-title { font-size: 1em; margin: 0.5em 0; }
.footnotes ol { padding-left: 1.5em; }
sup a[data-footnote-ref] { text-decoration: none; }
@media print {
  a { color: inherit; text-decoration: none; }
  a[data-footnote-backref] { display: none; }
}`;
  }
}

/** Build the manuscript as one self-contained HTML file. */
export async function buildHtml(input: ManuscriptInput): Promise<string> {
  return new HtmlBuilder(input).build();
}
