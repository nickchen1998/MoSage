// Markdown chapters → a Word document built on real, named styles (Normal,
// Body Text, heading 1–4, Quote, Code, caption, …) so a publisher or a thesis
// committee can restyle the whole book from Word's style pane.

import {
  AlignmentType,
  Bookmark,
  BookmarkEnd,
  BookmarkStart,
  BorderStyle,
  Document,
  DocumentDefaults,
  ExternalHyperlink,
  type FileChild,
  Footer,
  FootnoteReferenceRun,
  Header,
  type IBorderOptions,
  type IFontAttributesProperties,
  ImageRun,
  InternalHyperlink,
  type IParagraphOptions,
  type IParagraphStyleOptions,
  type ISectionOptions,
  LevelFormat,
  LineRuleType,
  NumberFormat,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  type ParagraphChild,
  SectionType,
  ShadingType,
  StyleForCharacter,
  StyleForParagraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  XmlAttributeComponent,
} from 'docx';
import type {
  Code,
  Definition,
  FootnoteDefinition,
  FootnoteReference,
  Heading,
  List,
  Paragraph as MdParagraph,
  Table as MdTable,
  Nodes,
  PhrasingContent,
  Root,
} from 'mdast';
import { type BookConfig, type ExportConfig, pageSizeMm } from '../../shared/config.ts';
import { isPageBreak, textOf } from '../../shared/markdown.ts';
import {
  ALERT_COLORS,
  type AlertType,
  collectDefinitions,
  collectFootnotes,
  imagePlaceholder,
  imageUrls,
  isCjkLanguage,
  joinSoftBreaks,
  type Labels,
  type LoadedImage,
  labelsFor,
  loadImages,
  prepareChapter,
  readAlert,
} from './common.ts';
import type { ManuscriptInput } from './types.ts';

const TWIPS_PER_MM = 1440 / 25.4;
const PX_PER_MM = 96 / 25.4;
/** 1 px at 96 dpi = 15 twips. */
const TWIPS_PER_PX = 15;
const DOCX_IMAGE_TYPES = new Set(['png', 'jpg', 'gif', 'bmp']);
const BULLETS = ['•', '◦', '▪'];
const ORDERED_FORMATS = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

/** Styles with no space above; after a table they get some. */
const NO_SPACE_BEFORE = new Set(['BodyText', 'ListParagraph', 'ListContinue', 'Quote', 'Callout']);

const twips = (mm: number) => Math.round(mm * TWIPS_PER_MM);
const halfPoints = (pt: number) => Math.max(2, Math.round(pt * 2));

// Characters XML 1.0 does not allow; Word refuses to open a file containing them.
const INVALID_XML_RE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: these are exactly the characters to drop
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function xmlText(text: string): string {
  return text.replace(INVALID_XML_RE, '');
}

/**
 * A bookmark with a unique `w:id`. docx's Bookmark gives every bookmark id 1
 * (it creates a fresh counter per instance), which Word may reject.
 */
function bookmark(name: string, id: number, children: ParagraphChild[]): Bookmark {
  const mark = new Bookmark({ id: name, children });
  Object.assign(mark, { start: new BookmarkStart(name, id), end: new BookmarkEnd(id) });
  return mark;
}

/** `w:default="1"` on the Normal style — docx only writes it through this attribute set. */
class DefaultStyleAttributes extends XmlAttributeComponent<{
  type: string;
  styleId: string;
  default: boolean;
}> {
  protected readonly xmlKeys = { type: 'w:type', styleId: 'w:styleId', default: 'w:default' };
}

/** A paragraph style Word applies to every paragraph that names no style. */
class DefaultParagraphStyle extends StyleForParagraph {
  constructor(options: IParagraphStyleOptions) {
    super(options);
    this.root[0] = new DefaultStyleAttributes({
      type: 'paragraph',
      styleId: options.id,
      default: true,
    });
  }
}

interface Fmt {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  underline?: boolean;
  superScript?: boolean;
  subScript?: boolean;
  highlight?: boolean;
  code?: boolean;
  link?: boolean;
}

const HTML_FORMAT: Record<string, keyof Fmt> = {
  b: 'bold',
  strong: 'bold',
  i: 'italics',
  em: 'italics',
  u: 'underline',
  ins: 'underline',
  s: 'strike',
  del: 'strike',
  strike: 'strike',
  sup: 'superScript',
  sub: 'subScript',
  mark: 'highlight',
  code: 'code',
  kbd: 'code',
};

interface BlockCtx {
  /** Style of ordinary paragraphs in this container. */
  style: string;
  /** Left indent (twips) the container adds, e.g. the text position of a list item. */
  indent: number;
  /** Level the next nested list starts at. */
  listLevel: number;
  /** Left border of callout content. */
  border?: IBorderOptions;
  /** Main text (headings, figures, page breaks) rather than a footnote or table cell. */
  body: boolean;
  inFootnote: boolean;
  /** Widest an image may be, in px. */
  maxImagePx?: number;
}

interface TocEntry {
  level: number;
  title: string;
  anchor: string;
}

interface OrderedList {
  reference: string;
  level: number;
  start: number;
}

type AnyStyle = StyleForParagraph | StyleForCharacter | DocumentDefaults;

class DocxBuilder {
  private readonly e: ExportConfig;
  private readonly labels: Labels;
  private readonly charTwips: number;
  private readonly contentWidth: number;
  private readonly contentHeight: number;
  private readonly contentWidthPx: number;
  private readonly contentHeightPx: number;
  private readonly quoteIndent: number;
  private readonly calloutIndent: number;

  private images = new Map<string, LoadedImage | null>();
  private definitions = new Map<string, Definition>();
  private footnoteDefs = new Map<string, FootnoteDefinition>();
  private readonly footnotes: Record<string, { children: Paragraph[] }> = {};
  private footnoteCount = 0;
  private readonly orderedLists: OrderedList[] = [];
  private readonly toc: TocEntry[] = [];
  private bookmarkCount = 0;
  /** A page break is due before the next body paragraph. */
  private breakNext = false;
  /** The last body block was a table: the next paragraph needs air above it. */
  private afterTable = false;

  constructor(private readonly input: ManuscriptInput) {
    const config = input.config;
    this.e = config.export;
    this.labels = labelsFor(config.language);
    const size = pageSizeMm(this.e.pageSize);
    const m = this.e.margins;
    const widthMm = Math.max(20, size.width - m.left - m.right);
    const heightMm = Math.max(20, size.height - m.top - m.bottom);
    this.charTwips = Math.round(this.e.fontSize * 20);
    this.contentWidth = twips(widthMm);
    this.contentHeight = twips(heightMm);
    this.contentWidthPx = widthMm * PX_PER_MM;
    this.contentHeightPx = heightMm * PX_PER_MM;
    this.quoteIndent = this.charTwips * 2;
    this.calloutIndent = Math.round(this.charTwips / 2);
  }

  private get config(): BookConfig {
    return this.input.config;
  }

  async build(): Promise<Buffer> {
    const trees = this.input.chapters.map((c) => prepareChapter(c.source));
    this.images = await loadImages(
      trees.flatMap((t) => imageUrls(t)),
      this.input.root,
    );

    const perChapter = this.e.header === 'chapter';
    const bodyCtx: BlockCtx = {
      style: 'BodyText',
      indent: 0,
      listLevel: 0,
      body: true,
      inFootnote: false,
    };
    const chapters: { title: string; children: FileChild[] }[] = [];
    trees.forEach((tree, i) => {
      this.definitions = collectDefinitions(tree);
      this.footnoteDefs = collectFootnotes(tree);
      if (i > 0 && this.e.chapterPageBreak) this.breakNext = !perChapter;
      chapters.push({
        title: this.chapterTitle(tree, this.input.chapters[i].id),
        children: this.blocks(tree.children, bodyCtx),
      });
    });
    this.breakNext = false;

    const doc = new Document({
      title: this.config.title || undefined,
      subject: this.config.subtitle || undefined,
      creator: this.config.author || 'MoSage',
      lastModifiedBy: 'MoSage',
      description: 'Exported by MoSage',
      features: this.e.toc ? { updateFields: true } : undefined,
      // A justified line that ends in a manual line break is not stretched.
      compatibility: { doNotExpandShiftReturn: true },
      styles: { importedStyles: this.styles() },
      numbering: { config: this.numbering() },
      footnotes: this.footnotes,
      sections: this.sections(chapters),
    });
    return Packer.toBuffer(doc);
  }

  // -------------------------------------------------------------------------
  // Sections

  private sections(chapters: { title: string; children: FileChild[] }[]): ISectionOptions[] {
    const size = pageSizeMm(this.e.pageSize);
    const m = this.e.margins;
    const page = {
      size: {
        width: twips(size.width),
        height: twips(size.height),
        orientation: PageOrientation.PORTRAIT,
      },
      margin: {
        top: twips(m.top),
        bottom: twips(m.bottom),
        left: twips(m.left),
        right: twips(m.right),
        header: twips(Math.min(12.5, m.top / 2)),
        footer: twips(Math.min(12.5, m.bottom / 2)),
      },
    };
    const sections: ISectionOptions[] = [];

    if (this.e.titlePage) {
      sections.push({
        properties: { page },
        children: this.titlePage(),
      });
    }
    if (this.e.toc) {
      sections.push({
        properties: { page, type: SectionType.NEXT_PAGE },
        children: this.tableOfContents(),
      });
    }

    const footers = this.e.pageNumbers
      ? {
          default: new Footer({
            children: [
              new Paragraph({
                style: 'Footer',
                children: [new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        }
      : undefined;
    const header = (text: string) =>
      text.trim()
        ? {
            default: new Header({
              children: [
                new Paragraph({ style: 'Header', children: [new TextRun(xmlText(text))] }),
              ],
            }),
          }
        : undefined;
    const firstPage = { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } };
    const nonEmpty = (children: FileChild[]) => (children.length ? children : [new Paragraph({})]);

    if (this.e.header === 'chapter') {
      chapters.forEach((chapter, i) => {
        sections.push({
          properties: {
            page: i === 0 ? firstPage : page,
            type:
              i === 0 || this.e.chapterPageBreak ? SectionType.NEXT_PAGE : SectionType.CONTINUOUS,
          },
          headers: header(chapter.title),
          footers,
          children: nonEmpty(chapter.children),
        });
      });
    } else if (chapters.length || !sections.length) {
      sections.push({
        properties: { page: firstPage, type: SectionType.NEXT_PAGE },
        headers: this.e.header === 'title' ? header(this.config.title) : undefined,
        footers,
        children: nonEmpty(chapters.flatMap((c) => c.children)),
      });
    }
    return sections;
  }

  private titlePage(): Paragraph[] {
    const c = this.config;
    const out = [
      new Paragraph({
        style: 'Title',
        children: [new TextRun(xmlText(c.title || this.labels.untitled))],
      }),
    ];
    if (c.subtitle.trim()) {
      out.push(new Paragraph({ style: 'Subtitle', children: [new TextRun(xmlText(c.subtitle))] }));
    }
    if (c.author.trim()) {
      out.push(new Paragraph({ style: 'Author', children: [new TextRun(xmlText(c.author))] }));
    }
    return out;
  }

  private tableOfContents(): FileChild[] {
    // Word rebuilds the table, page numbers included, when the file is opened
    // (updateFields). Until then — and in viewers that never update fields,
    // such as LibreOffice — these linked titles stand in for it.
    const entries = this.toc.map(
      (entry) =>
        new Paragraph({
          style: `TOC${entry.level}`,
          children: [
            new InternalHyperlink({
              anchor: entry.anchor,
              children: [new TextRun(xmlText(entry.title))],
            }),
          ],
        }),
    );
    return [
      new Paragraph({ style: 'TOCHeading', children: [new TextRun(this.labels.contents)] }),
      new TableOfContents(this.labels.contents, {
        hyperlink: true,
        headingStyleRange: '1-3',
        hideTabAndPageNumbersInWebView: true,
        useAppliedParagraphOutlineLevel: true,
        contentChildren: entries,
      }),
    ];
  }

  private chapterTitle(tree: Root, id: string): string {
    const h1 = tree.children.find((n): n is Heading => n.type === 'heading' && n.depth === 1);
    const title = h1 ? joinSoftBreaks(textOf(h1)).trim() : '';
    return title || id.replace(/\.md$/i, '');
  }

  // -------------------------------------------------------------------------
  // Blocks

  private paragraph(ctx: BlockCtx, options: IParagraphOptions & { style: string }): Paragraph {
    let extra: IParagraphOptions = {};
    if (ctx.body && this.breakNext) {
      extra = { ...extra, pageBreakBefore: true };
      this.breakNext = false;
    }
    if (ctx.body && this.afterTable) {
      this.afterTable = false;
      // Only for styles without space above of their own (not headings, figures…).
      if (!options.spacing && NO_SPACE_BEFORE.has(options.style)) {
        extra = { ...extra, spacing: { before: Math.round(this.charTwips * 0.75) } };
      }
    }
    if (!options.numbering && !options.indent && ctx.indent > 0) {
      extra = { ...extra, indent: { left: ctx.indent + this.styleIndent(options.style) } };
    }
    if (!options.numbering && ctx.border && options.style === 'Callout') {
      extra = { ...extra, border: { left: ctx.border } };
    }
    return new Paragraph({ ...options, ...extra });
  }

  private styleIndent(style: string): number {
    if (style === 'Quote') return this.quoteIndent;
    if (style === 'Callout') return this.calloutIndent;
    return 0;
  }

  private blocks(nodes: readonly Nodes[], ctx: BlockCtx): FileChild[] {
    const out: FileChild[] = [];
    for (const node of nodes) {
      for (const child of this.block(node, ctx)) {
        // Word merges two adjacent tables into one.
        if (child instanceof Table && out.at(-1) instanceof Table) {
          out.push(new Paragraph({ style: ctx.style }));
        }
        out.push(child);
      }
    }
    return out;
  }

  private block(node: Nodes, ctx: BlockCtx): FileChild[] {
    switch (node.type) {
      case 'paragraph':
        return this.paragraphBlock(node, ctx);
      case 'heading':
        return [this.heading(node, ctx)];
      case 'thematicBreak':
        return [
          this.paragraph(ctx, {
            style: ctx.body ? 'SceneBreak' : ctx.style,
            alignment: ctx.body ? undefined : AlignmentType.CENTER,
            children: [this.textRun(this.e.sceneBreak, {})],
          }),
        ];
      case 'blockquote': {
        const alert = readAlert(node);
        if (alert) return this.callout(alert.type, alert.children, ctx);
        if (!ctx.body) return this.blocks(node.children, ctx);
        const quoteCtx =
          ctx.style === 'Quote'
            ? { ...ctx, indent: ctx.indent + this.quoteIndent }
            : { ...ctx, style: 'Quote', border: undefined };
        return this.blocks(node.children, quoteCtx);
      }
      case 'list':
        return this.list(node, ctx);
      case 'code':
        return [this.codeBlock(node, ctx)];
      case 'table':
        return this.table(node, ctx);
      case 'html':
        if (ctx.body && isPageBreak(node)) this.breakNext = true;
        return [];
      case 'definition':
      case 'footnoteDefinition':
      case 'yaml':
        return [];
      default: {
        const text = joinSoftBreaks(textOf(node)).trim();
        return text
          ? [this.paragraph(ctx, { style: ctx.style, children: [this.textRun(text, {})] })]
          : [];
      }
    }
  }

  private paragraphBlock(node: MdParagraph, ctx: BlockCtx): FileChild[] {
    const figure = this.figureOf(node);
    if (figure && ctx.body) return this.figure(figure, ctx);
    return [
      this.paragraph(ctx, { style: ctx.style, children: this.inlines(node.children, {}, ctx) }),
    ];
  }

  /** The image of a paragraph that holds nothing else. */
  private figureOf(node: MdParagraph): { url: string; alt: string; title?: string } | null {
    const content = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
    if (content.length !== 1) return null;
    const only = content[0];
    if (only.type === 'image') {
      return { url: only.url, alt: only.alt ?? '', title: only.title ?? undefined };
    }
    if (only.type === 'imageReference') {
      const def = this.definitions.get(only.identifier);
      if (def) return { url: def.url, alt: only.alt ?? '', title: def.title ?? undefined };
    }
    return null;
  }

  private figure(img: { url: string; alt: string; title?: string }, ctx: BlockCtx): FileChild[] {
    const alt = joinSoftBreaks(img.alt).trim();
    const run = this.imageRun(img.url, alt, img.title, ctx);
    if (!run) {
      return [
        this.paragraph(ctx, {
          style: 'Figure',
          children: [this.textRun(imagePlaceholder(alt, this.labels), {})],
        }),
      ];
    }
    const out = [
      this.paragraph(ctx, { style: 'Figure', keepNext: alt ? true : undefined, children: [run] }),
    ];
    if (alt) out.push(this.paragraph(ctx, { style: 'Caption', children: [this.textRun(alt, {})] }));
    return out;
  }

  private heading(node: Heading, ctx: BlockCtx): Paragraph {
    if (!ctx.body) {
      return this.paragraph(ctx, {
        style: ctx.style,
        children: this.inlines(node.children, { bold: true }, ctx),
      });
    }
    let children = this.inlines(node.children, {}, ctx);
    const title = joinSoftBreaks(textOf(node)).trim();
    if (node.depth <= 3 && title) {
      const id = ++this.bookmarkCount;
      const anchor = `_Toc${String(id).padStart(8, '0')}`;
      this.toc.push({ level: node.depth, title, anchor });
      children = [bookmark(anchor, id, children)];
    }
    return this.paragraph(
      { ...ctx, border: undefined },
      { style: `Heading${Math.min(node.depth, 4)}`, children },
    );
  }

  private callout(type: AlertType, children: Nodes[], ctx: BlockCtx): FileChild[] {
    if (!ctx.body) {
      return [
        this.paragraph(ctx, {
          style: ctx.style,
          children: [this.textRun(this.labels.alerts[type], { bold: true })],
        }),
        ...this.blocks(children, ctx),
      ];
    }
    const border: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 24,
      color: ALERT_COLORS[type],
      space: 8,
    };
    const inner: BlockCtx = { ...ctx, style: 'Callout', border };
    return [
      this.paragraph(inner, {
        style: 'Callout',
        keepNext: true,
        children: [this.textRun(this.labels.alerts[type], { bold: true })],
      }),
      ...this.blocks(children, inner),
    ];
  }

  private codeBlock(node: Code, ctx: BlockCtx): Paragraph {
    const lines = node.value.replace(/\t/g, '    ').split(/\r?\n/);
    const code = !ctx.body;
    const children = lines.map(
      (line, i) =>
        new TextRun({
          text: xmlText(line),
          break: i > 0 ? 1 : undefined,
          style: code ? 'InlineCode' : undefined,
        }),
    );
    return this.paragraph(ctx, { style: ctx.body ? 'Code' : ctx.style, children });
  }

  private listLeft(level: number): number {
    return this.charTwips * 2 * (level + 1);
  }

  private get hanging(): number {
    return Math.round(this.charTwips * 1.5);
  }

  private list(node: List, ctx: BlockCtx): FileChild[] {
    const level = Math.min(ctx.listLevel, 8);
    let reference = 'bullet';
    if (node.ordered) {
      reference = `ordered-${this.orderedLists.length + 1}`;
      this.orderedLists.push({ reference, level, start: node.start ?? 1 });
    }
    const style = ctx.body ? 'ListParagraph' : ctx.style;
    const itemCtx: BlockCtx = {
      ...ctx,
      // Later paragraphs of an item: no bullet, aligned with the item's text.
      style: ctx.body ? 'ListContinue' : ctx.style,
      listLevel: level + 1,
      indent: this.listLeft(level),
      border: undefined,
    };
    const numbering = { reference, level };
    const out: FileChild[] = [];
    for (const item of node.children) {
      const box = item.checked === true ? '☑ ' : item.checked === false ? '☐ ' : '';
      const lead = box ? [this.textRun(box, {})] : [];
      let numbered = false;
      for (const child of item.children) {
        if (!numbered) {
          numbered = true;
          if (child.type === 'paragraph') {
            out.push(
              this.paragraph(ctx, {
                style,
                numbering,
                children: [...lead, ...this.inlines(child.children, {}, itemCtx)],
              }),
            );
            continue;
          }
          out.push(this.paragraph(ctx, { style, numbering, children: lead }));
        }
        out.push(...this.blocks([child], itemCtx));
      }
      if (!numbered) out.push(this.paragraph(ctx, { style, numbering, children: lead }));
    }
    return out;
  }

  private table(node: MdTable, ctx: BlockCtx): FileChild[] {
    const rows = node.children;
    if (!rows.length) return [];
    const out: FileChild[] = [];
    // A page break due before this table goes on an empty paragraph.
    if (ctx.body && this.breakNext) out.push(this.paragraph(ctx, { style: ctx.style }));
    const cols = Math.max(1, ...rows.map((r) => r.children.length));
    const available = Math.max(this.contentWidth - ctx.indent, 1440);
    const widths = columnWidths(node, cols, available);
    const cellCtx: BlockCtx = {
      style: 'TableText',
      indent: 0,
      listLevel: 0,
      body: false,
      inFootnote: ctx.inFootnote,
      maxImagePx: (available / TWIPS_PER_PX / cols) * 0.9,
    };
    const thin: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
    const tableRows = rows.map(
      (row, r) =>
        new TableRow({
          tableHeader: r === 0 ? true : undefined,
          children: Array.from({ length: cols }, (_, c) => {
            const cell = row.children[c];
            const align = node.align?.[c];
            return new TableCell({
              width: { size: widths[c], type: WidthType.DXA },
              verticalAlign: VerticalAlignTable.CENTER,
              shading:
                r === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
              children: [
                new Paragraph({
                  style: 'TableText',
                  alignment:
                    align === 'center'
                      ? AlignmentType.CENTER
                      : align === 'right'
                        ? AlignmentType.RIGHT
                        : align === 'left'
                          ? AlignmentType.LEFT
                          : undefined,
                  children: cell
                    ? this.inlines(cell.children, r === 0 ? { bold: true } : {}, cellCtx)
                    : [],
                }),
              ],
            });
          }),
        }),
    );
    out.push(
      new Table({
        rows: tableRows,
        width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths: widths,
        layout: TableLayoutType.FIXED,
        indent: ctx.indent > 0 ? { size: ctx.indent, type: WidthType.DXA } : undefined,
        margins: { top: 40, bottom: 40, left: 100, right: 100 },
        borders: {
          top: thin,
          bottom: thin,
          left: thin,
          right: thin,
          insideHorizontal: thin,
          insideVertical: thin,
        },
      }),
    );
    if (ctx.body) this.afterTable = true;
    return out;
  }

  // -------------------------------------------------------------------------
  // Inline content

  private textRun(text: string, fmt: Fmt): TextRun {
    return new TextRun({
      text: xmlText(text),
      bold: fmt.bold || undefined,
      italics: fmt.italics || undefined,
      strike: fmt.strike || undefined,
      superScript: fmt.superScript || undefined,
      subScript: fmt.subScript || undefined,
      underline: fmt.underline ? {} : undefined,
      highlight: fmt.highlight ? 'yellow' : undefined,
      style: fmt.code ? 'InlineCode' : fmt.link ? 'Hyperlink' : undefined,
    });
  }

  private inlines(nodes: readonly PhrasingContent[], fmt: Fmt, ctx: BlockCtx): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    let local: Fmt = { ...fmt };
    for (const node of nodes) {
      switch (node.type) {
        case 'text': {
          const text = joinSoftBreaks(node.value);
          if (text) out.push(this.textRun(text, local));
          break;
        }
        case 'emphasis':
          out.push(...this.inlines(node.children, { ...local, italics: true }, ctx));
          break;
        case 'strong':
          out.push(...this.inlines(node.children, { ...local, bold: true }, ctx));
          break;
        case 'delete':
          out.push(...this.inlines(node.children, { ...local, strike: true }, ctx));
          break;
        case 'inlineCode':
          out.push(this.textRun(node.value, { ...local, code: true }));
          break;
        case 'break':
          out.push(new TextRun({ break: 1 }));
          break;
        case 'link':
          out.push(...this.link(node.url, node.children, local, ctx));
          break;
        case 'linkReference': {
          const def = this.definitions.get(node.identifier);
          if (def) out.push(...this.link(def.url, node.children, local, ctx));
          else out.push(...this.inlines(node.children, local, ctx));
          break;
        }
        case 'image':
          out.push(this.inlineImage(node.url, node.alt ?? '', node.title ?? undefined, local, ctx));
          break;
        case 'imageReference': {
          const def = this.definitions.get(node.identifier);
          if (def) {
            out.push(this.inlineImage(def.url, node.alt ?? '', def.title ?? undefined, local, ctx));
          } else if (node.alt) {
            out.push(this.textRun(node.alt, local));
          }
          break;
        }
        case 'footnoteReference':
          out.push(this.footnoteRef(node, ctx));
          break;
        case 'html':
          local = this.inlineHtml(node.value, local, fmt, out);
          break;
        default: {
          const text = joinSoftBreaks(textOf(node));
          if (text) out.push(this.textRun(text, local));
        }
      }
    }
    return out;
  }

  /** `<br>` becomes a line break; `<sup>`, `<u>`, `<mark>`… toggle formatting; other tags vanish. */
  private inlineHtml(value: string, local: Fmt, parent: Fmt, out: ParagraphChild[]): Fmt {
    const tag = /^<\s*(\/)?\s*([a-z][a-z0-9]*)\b[^>]*>$/i.exec(value.trim());
    if (!tag) return local;
    const name = tag[2].toLowerCase();
    if (name === 'br') {
      out.push(new TextRun({ break: 1 }));
      return local;
    }
    const key = HTML_FORMAT[name];
    if (!key) return local;
    return { ...local, [key]: tag[1] ? parent[key] : true };
  }

  private link(
    url: string,
    children: PhrasingContent[],
    fmt: Fmt,
    ctx: BlockCtx,
  ): ParagraphChild[] {
    const href = url.trim();
    if (!/^https?:\/\//i.test(href)) return this.inlines(children, fmt, ctx);
    const inner = this.inlines(children, { ...fmt, link: true }, ctx);
    return [
      new ExternalHyperlink({
        link: href,
        children: inner.length ? inner : [this.textRun(href, { ...fmt, link: true })],
      }),
    ];
  }

  private inlineImage(
    url: string,
    alt: string,
    title: string | undefined,
    fmt: Fmt,
    ctx: BlockCtx,
  ): ParagraphChild {
    const text = joinSoftBreaks(alt).trim();
    return (
      this.imageRun(url, text, title, ctx) ?? this.textRun(imagePlaceholder(text, this.labels), fmt)
    );
  }

  private imageRun(
    url: string,
    alt: string,
    title: string | undefined,
    ctx: BlockCtx,
  ): ImageRun | null {
    const image = this.images.get(url);
    if (!image || !DOCX_IMAGE_TYPES.has(image.type) || !image.width || !image.height) return null;
    const maxWidth = Math.max(
      24,
      Math.min(
        ctx.maxImagePx ?? Number.POSITIVE_INFINITY,
        this.contentWidthPx - ctx.indent / TWIPS_PER_PX,
      ),
    );
    const maxHeight = this.contentHeightPx * 0.8;
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    return new ImageRun({
      type: image.type as 'png' | 'jpg' | 'gif' | 'bmp',
      data: image.data,
      transformation: {
        width: Math.max(1, Math.round(image.width * scale)),
        height: Math.max(1, Math.round(image.height * scale)),
      },
      altText: {
        name: xmlText(image.name),
        description: xmlText(alt),
        title: xmlText(title ?? alt),
      },
    });
  }

  private footnoteRef(node: FootnoteReference, ctx: BlockCtx): ParagraphChild {
    const def = this.footnoteDefs.get(node.identifier);
    // Word has no footnotes inside footnotes.
    if (!def || ctx.inFootnote) {
      return this.textRun(
        def ? (node.label ?? node.identifier) : `[^${node.label ?? node.identifier}]`,
        {
          superScript: Boolean(def),
        },
      );
    }
    const id = ++this.footnoteCount;
    const noteCtx: BlockCtx = {
      style: 'FootnoteText',
      indent: 0,
      listLevel: 0,
      body: false,
      inFootnote: true,
    };
    const paragraphs = this.blocks(def.children, noteCtx).filter(
      (b): b is Paragraph => b instanceof Paragraph,
    );
    if (!paragraphs.length) paragraphs.push(new Paragraph({ style: 'FootnoteText' }));
    paragraphs[0].addRunToFront(new TextRun(' '));
    this.footnotes[id] = { children: paragraphs };
    return new FootnoteReferenceRun(id);
  }

  // -------------------------------------------------------------------------
  // Styles and numbering

  private numbering() {
    const indent = (level: number) => ({
      paragraph: { indent: { left: this.listLeft(level), hanging: this.hanging } },
    });
    const levels = Array.from({ length: 9 }, (_, level) => level);
    return [
      {
        reference: 'bullet',
        levels: levels.map((level) => ({
          level,
          format: LevelFormat.BULLET,
          text: BULLETS[level % BULLETS.length],
          alignment: AlignmentType.LEFT,
          style: indent(level),
        })),
      },
      ...this.orderedLists.map((list) => ({
        reference: list.reference,
        levels: levels.map((level) => ({
          level,
          format: ORDERED_FORMATS[level % ORDERED_FORMATS.length],
          text: `%${level + 1}.`,
          start: level === list.level ? list.start : 1,
          alignment: AlignmentType.LEFT,
          style: indent(level),
        })),
      })),
    ];
  }

  private styles(): AnyStyle[] {
    const e = this.e;
    const ch = this.charTwips;
    const size = halfPoints(e.fontSize);
    const after = Math.round(e.paragraphSpacing * 20);
    const cjk = isCjkLanguage(this.config.language);
    const hint = cjk ? 'eastAsia' : undefined;
    const font = (eastAsia: string, latin = e.fonts.latin): IFontAttributesProperties => ({
      ascii: latin,
      hAnsi: latin,
      cs: latin,
      eastAsia,
      hint,
    });
    const bodyFont = font(e.fonts.body);
    const headingFont = font(e.fonts.heading);
    const codeFont = font(e.fonts.body, e.fonts.code);
    const language = cjk
      ? { value: 'en-US', eastAsia: this.config.language }
      : { value: this.config.language || 'en-US', eastAsia: 'zh-TW' };
    const single = { line: 240, lineRule: LineRuleType.AUTO };
    const headingLine = { line: 288, lineRule: LineRuleType.AUTO };

    const style = (
      id: string,
      name: string,
      options: Omit<IParagraphStyleOptions, 'id' | 'name'>,
    ): StyleForParagraph =>
      new StyleForParagraph({ id, name, basedOn: 'Normal', quickFormat: true, ...options });

    const heading = (level: number, factor: number, before: number, afterSpace: number) =>
      style(`Heading${level}`, `heading ${level}`, {
        next: 'BodyText',
        run: { font: headingFont, size: halfPoints(e.fontSize * factor), bold: true },
        paragraph: {
          keepNext: true,
          keepLines: true,
          outlineLevel: level - 1,
          alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { ...headingLine, before: Math.round(before), after: Math.round(afterSpace) },
        },
      });

    const toc = (level: number) =>
      style(`TOC${level}`, `toc ${level}`, {
        next: 'Normal',
        quickFormat: false,
        paragraph: {
          indent: { left: ch * 2 * (level - 1) },
          spacing: { before: level === 1 ? Math.round(ch / 2) : 0, after: 0 },
        },
      });

    return [
      new DocumentDefaults({
        run: { font: bodyFont, size, sizeComplexScript: size, language },
        paragraph: {
          spacing: { line: Math.round(240 * e.lineSpacing), lineRule: LineRuleType.AUTO },
        },
      }),
      new DefaultParagraphStyle({
        id: 'Normal',
        name: 'Normal',
        quickFormat: true,
        run: { font: bodyFont, size, sizeComplexScript: size, language },
        paragraph: {
          spacing: {
            line: Math.round(240 * e.lineSpacing),
            lineRule: LineRuleType.AUTO,
            before: 0,
            after: 0,
          },
        },
      }),
      style('BodyText', 'Body Text', {
        next: 'BodyText',
        paragraph: {
          alignment: AlignmentType.BOTH,
          indent: { firstLine: Math.round(e.firstLineIndent * ch) },
          spacing: { after },
        },
      }),
      heading(1, 1.75, ch * 2, ch * 1.5),
      heading(2, 1.4, ch * 1.5, ch * 0.5),
      heading(3, 1.2, ch, ch * 0.5),
      heading(4, 1.05, ch * 0.75, ch * 0.25),
      style('Title', 'Title', {
        next: 'Subtitle',
        run: { font: headingFont, size: halfPoints(e.fontSize * 2.4), bold: true },
        paragraph: {
          alignment: AlignmentType.CENTER,
          // About a quarter down the page; section vAlign is ignored by LibreOffice.
          spacing: { ...headingLine, before: Math.round(this.contentHeight * 0.25), after: ch * 2 },
        },
      }),
      style('Subtitle', 'Subtitle', {
        next: 'Author',
        run: { font: headingFont, size: halfPoints(e.fontSize * 1.5) },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { ...headingLine, after: ch } },
      }),
      style('Author', 'Author', {
        run: { size: halfPoints(e.fontSize * 1.25) },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: ch * 4, after: ch } },
      }),
      style('TOCHeading', 'TOC Heading', {
        next: 'Normal',
        run: { font: headingFont, size: halfPoints(e.fontSize * 1.75), bold: true },
        paragraph: {
          alignment: AlignmentType.CENTER,
          keepNext: true,
          spacing: { ...headingLine, before: ch * 2, after: ch * 1.5 },
        },
      }),
      toc(1),
      toc(2),
      toc(3),
      style('ListParagraph', 'List Paragraph', {
        paragraph: { alignment: AlignmentType.BOTH, contextualSpacing: true, spacing: { after } },
      }),
      style('ListContinue', 'List Continue', {
        paragraph: {
          alignment: AlignmentType.BOTH,
          indent: { left: this.listLeft(0) },
          spacing: { after },
        },
      }),
      style('Quote', 'Quote', {
        next: 'BodyText',
        run: { color: '404040' },
        paragraph: {
          alignment: AlignmentType.BOTH,
          indent: { left: this.quoteIndent, right: this.quoteIndent },
          spacing: { after: Math.max(after, 120) },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'A6A6A6', space: 8 } },
        },
      }),
      style('Callout', 'Callout', {
        next: 'BodyText',
        paragraph: {
          alignment: AlignmentType.BOTH,
          contextualSpacing: true,
          indent: { left: this.calloutIndent, right: this.calloutIndent },
          spacing: { after: Math.max(after, 120) },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F5F8' },
          border: { left: { style: BorderStyle.SINGLE, size: 24, color: '7F8C9A', space: 8 } },
        },
      }),
      style('Code', 'Code', {
        next: 'BodyText',
        run: { font: codeFont, size: halfPoints(e.fontSize * 0.85), noProof: true },
        paragraph: {
          alignment: AlignmentType.LEFT,
          spacing: { ...single, before: 60, after: Math.max(after, 120) },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' },
        },
      }),
      style('Figure', 'Figure', {
        next: 'Caption',
        paragraph: {
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 60 },
        },
      }),
      style('Caption', 'caption', {
        next: 'BodyText',
        run: { size: halfPoints(e.fontSize * 0.85), color: '404040' },
        paragraph: {
          alignment: AlignmentType.CENTER,
          keepLines: true,
          spacing: { ...single, after: Math.max(after, 120) },
        },
      }),
      style('SceneBreak', 'Scene Break', {
        next: 'BodyText',
        paragraph: {
          alignment: AlignmentType.CENTER,
          spacing: { before: ch, after: ch + after },
        },
      }),
      style('TableText', 'Table Text', {
        quickFormat: false,
        paragraph: { spacing: { ...single, before: 40, after: 40 } },
      }),
      style('FootnoteText', 'footnote text', {
        quickFormat: false,
        run: { size: halfPoints(Math.max(8, e.fontSize - 2)) },
        paragraph: { alignment: AlignmentType.BOTH, spacing: { ...single, after: 0 } },
      }),
      style('Header', 'header', {
        quickFormat: false,
        run: { size: halfPoints(e.fontSize * 0.75), color: '595959' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { ...single, after: 0 } },
      }),
      style('Footer', 'footer', {
        quickFormat: false,
        run: { size: halfPoints(e.fontSize * 0.75) },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { ...single, after: 0 } },
      }),
      new StyleForCharacter({
        id: 'Hyperlink',
        name: 'Hyperlink',
        basedOn: 'DefaultParagraphFont',
        run: { color: '0563C1', underline: {} },
      }),
      new StyleForCharacter({
        id: 'FootnoteReference',
        name: 'footnote reference',
        basedOn: 'DefaultParagraphFont',
        run: { superScript: true },
      }),
      new StyleForCharacter({
        id: 'InlineCode',
        name: 'Inline Code',
        basedOn: 'DefaultParagraphFont',
        run: {
          font: codeFont,
          size: halfPoints(e.fontSize * 0.9),
          noProof: true,
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' },
        },
      }),
    ];
  }
}

/** Column widths (twips) roughly proportional to the longest text of each column. */
function columnWidths(table: MdTable, cols: number, available: number): number[] {
  const weights = Array.from({ length: cols }, () => 4);
  for (const row of table.children) {
    row.children.forEach((cell, c) => {
      let width = 0;
      for (const char of textOf(cell)) width += char.charCodeAt(0) > 0x2e7f ? 2 : 1;
      weights[c] = Math.max(weights[c], Math.min(width, 40));
    });
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const minimum = available / cols / 3;
  const raw = weights.map((w) => Math.max(minimum, (available * w) / total));
  const scale = available / raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((w) => Math.floor(w * scale));
  widths[cols - 1] += available - widths.reduce((a, b) => a + b, 0);
  return widths;
}

/** Build the manuscript as a .docx file. */
export async function buildDocx(input: ManuscriptInput): Promise<Buffer> {
  return new DocxBuilder(input).build();
}
