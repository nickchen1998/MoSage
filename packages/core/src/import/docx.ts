import { strFromU8, unzipSync } from 'fflate';
import type { Block, Inline, ParsedMarkdown, TableAlign } from './markdown.ts';
import { child, descendants, elements, parseXml, textOf, type XmlNode } from './xml.ts';

/**
 * Reads a Word document into the same blocks a markdown import makes, so the
 * result is written by the same generator and comes out as an ordinary
 * document. What a report is made of survives — headings, paragraphs with
 * bold and italic, lists, tables, pictures, footnotes, links, quotes. What
 * Word draws for itself does not: its styling gives way to the document's
 * design, its contents field to MoSage's own, and a chart, a text box, or an
 * equation is counted in `skipped` so the caller can say what to redo.
 */

export type DocxMedia = { path: string; filename: string; bytes: Uint8Array };

export type ParsedDocx = ParsedMarkdown & {
  /** Pictures the blocks refer to, keyed by their path inside the package. */
  media: Map<string, DocxMedia>;
  /** What could not be brought across, by kind: `{ chart: 2 }`. */
  skipped: Record<string, number>;
};

type StyleInfo = { name: string; level: number | null; based?: string };

type Segment = {
  text?: string;
  bold: boolean;
  italic: boolean;
  href?: string;
  image?: { src: string; alt: string };
  footnote?: Inline[];
  break?: boolean;
};

type ListFormat = { ordered: boolean; start: number };

type Context = {
  files: Record<string, Uint8Array>;
  rels: Map<string, { target: string; external: boolean }>;
  styles: Map<string, StyleInfo>;
  numbering: (numId: string, level: number) => ListFormat;
  footnotes: Map<string, XmlNode>;
  media: Map<string, DocxMedia>;
  skipped: Record<string, number>;
};

const W = (name: string) => `w:${name}`;

function read(files: Record<string, Uint8Array>, path: string): XmlNode | undefined {
  const bytes = files[path];
  return bytes ? parseXml(strFromU8(bytes)) : undefined;
}

function val(node: XmlNode | undefined): string | undefined {
  return node?.attrs['w:val'];
}

/** `<w:b/>` is on; `<w:b w:val="0"/>` or `false` turns it off. */
function isOn(node: XmlNode | undefined): boolean {
  if (!node) return false;
  const v = val(node);
  return v === undefined || !['0', 'false', 'off', 'none'].includes(v);
}

function readRels(files: Record<string, Uint8Array>): Context['rels'] {
  const rels = new Map<string, { target: string; external: boolean }>();
  for (const rel of elements(read(files, 'word/_rels/document.xml.rels'), 'Relationship')) {
    const id = rel.attrs.Id;
    const target = rel.attrs.Target;
    if (!id || !target) continue;
    rels.set(id, { target, external: rel.attrs.TargetMode === 'External' });
  }
  return rels;
}

function readStyles(files: Record<string, Uint8Array>): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();
  for (const style of elements(read(files, 'word/styles.xml'), W('style'))) {
    const id = style.attrs['w:styleId'];
    if (!id) continue;
    // The name is Word's own English one whatever the UI language: a Chinese
    // Word calls its heading style `1`, but names it `heading 1`.
    const name = (val(child(style, W('name'))) ?? id).toLowerCase();
    const outline = val(child(child(style, W('pPr')), W('outlineLvl')));
    const heading = /^heading\s*(\d)$/.exec(name);
    const level = heading ? Number(heading[1]) : outline !== undefined ? Number(outline) + 1 : null;
    const based = val(child(style, W('basedOn')));
    styles.set(id, {
      name,
      level: level !== null && level <= 6 ? level : null,
      ...(based ? { based } : {}),
    });
  }
  return styles;
}

function readNumbering(files: Record<string, Uint8Array>): Context['numbering'] {
  const root = read(files, 'word/numbering.xml');
  const abstracts = new Map<string, XmlNode>();
  for (const abs of elements(root, W('abstractNum'))) {
    const id = abs.attrs['w:abstractNumId'];
    if (id) abstracts.set(id, abs);
  }
  const nums = new Map<string, string>();
  for (const num of elements(root, W('num'))) {
    const id = num.attrs['w:numId'];
    const abs = val(child(num, W('abstractNumId')));
    if (id && abs) nums.set(id, abs);
  }
  return (numId, level) => {
    const abs = abstracts.get(nums.get(numId) ?? '');
    const lvl = elements(abs, W('lvl')).find((l) => l.attrs['w:ilvl'] === String(level));
    const format = val(child(lvl, W('numFmt'))) ?? 'bullet';
    const start = Number(val(child(lvl, W('start'))) ?? 1);
    return {
      ordered: format !== 'bullet' && format !== 'none',
      start: Number.isFinite(start) ? start : 1,
    };
  };
}

function readFootnotes(files: Record<string, Uint8Array>): Map<string, XmlNode> {
  const notes = new Map<string, XmlNode>();
  for (const note of elements(read(files, 'word/footnotes.xml'), W('footnote'))) {
    const id = note.attrs['w:id'];
    // Word's separators are footnotes too, typed so they are not content.
    if (id && !note.attrs['w:type']) notes.set(id, note);
  }
  return notes;
}

function styleOf(ctx: Context, p: XmlNode): StyleInfo | undefined {
  const id = val(child(child(p, W('pPr')), W('pStyle')));
  return id ? ctx.styles.get(id) : undefined;
}

/** A named style, looking through the styles it is based on. */
function styleIs(
  ctx: Context,
  style: StyleInfo | undefined,
  test: (name: string) => boolean,
): boolean {
  let current = style;
  for (let depth = 0; current && depth < 8; depth++) {
    if (test(current.name)) return true;
    current = current.based ? ctx.styles.get(current.based) : undefined;
  }
  return false;
}

function headingLevel(ctx: Context, p: XmlNode, style: StyleInfo | undefined): number | null {
  const direct = val(child(child(p, W('pPr')), W('outlineLvl')));
  if (direct !== undefined && Number(direct) < 6) return Number(direct) + 1;
  let current = style;
  for (let depth = 0; current && depth < 8; depth++) {
    if (current.level !== null) return current.level;
    current = current.based ? ctx.styles.get(current.based) : undefined;
  }
  return null;
}

function mediaFor(ctx: Context, relId: string | undefined): string | null {
  const rel = relId ? ctx.rels.get(relId) : undefined;
  if (!rel || rel.external) return null;
  const path = rel.target.startsWith('/') ? rel.target.slice(1) : `word/${rel.target}`;
  const bytes = ctx.files[path];
  if (!bytes) return null;
  if (!ctx.media.has(path)) {
    ctx.media.set(path, { path, filename: path.split('/').pop() ?? path, bytes });
  }
  return path;
}

function skip(ctx: Context, kind: string): void {
  ctx.skipped[kind] = (ctx.skipped[kind] ?? 0) + 1;
}

/** A `<w:drawing>`: a picture becomes one; a chart, diagram, or shape is counted and dropped. */
function drawing(ctx: Context, node: XmlNode): Segment | null {
  const blip = descendants(node, 'a:blip')[0];
  if (blip) {
    const src = mediaFor(ctx, blip.attrs['r:embed']);
    if (!src) return null;
    const props = descendants(node, 'wp:docPr')[0];
    const alt = props?.attrs.descr || props?.attrs.title || '';
    return { image: { src, alt }, bold: false, italic: false };
  }
  const data = descendants(node, 'a:graphicData')[0]?.attrs.uri ?? '';
  skip(ctx, /chart/.test(data) ? 'chart' : /diagram/.test(data) ? 'diagram' : 'shape');
  return null;
}

function runSegments(ctx: Context, run: XmlNode, href: string | undefined): Segment[] {
  const props = child(run, W('rPr'));
  const bold = isOn(child(props, W('b')));
  const italic = isOn(child(props, W('i')));
  const base = { bold, italic, ...(href ? { href } : {}) };
  const out: Segment[] = [];
  for (const node of elements(run)) {
    switch (node.name) {
      case 'w:t':
        out.push({ ...base, text: textOf(node) });
        break;
      case 'w:tab':
        out.push({ ...base, text: ' ' });
        break;
      case 'w:br':
      case 'w:cr':
        // A page break is Word deciding the layout; MoSage's packer does that.
        if (node.attrs['w:type'] !== 'page') out.push({ ...base, break: true });
        break;
      case 'w:noBreakHyphen':
        out.push({ ...base, text: '-' });
        break;
      case 'w:drawing': {
        const image = drawing(ctx, node);
        if (image) out.push(image);
        break;
      }
      case 'w:pict': {
        const data = descendants(node, 'v:imagedata')[0];
        const src = data ? mediaFor(ctx, data.attrs['r:id']) : null;
        if (src)
          out.push({
            image: { src, alt: data?.attrs['o:title'] ?? '' },
            bold: false,
            italic: false,
          });
        else if (descendants(node, 'w:txbxContent').length > 0) skip(ctx, 'text box');
        break;
      }
      case 'w:object':
        skip(ctx, 'embedded object');
        break;
      case 'w:footnoteReference': {
        const note = ctx.footnotes.get(node.attrs['w:id'] ?? '');
        if (note) {
          const inlines = elements(note, W('p')).flatMap((p, i) => [
            ...(i > 0 ? [{ type: 'break' as const }] : []),
            ...paragraphInlines(ctx, p),
          ]);
          out.push({ ...base, footnote: inlines });
        }
        break;
      }
      case 'mc:AlternateContent': {
        // The modern form sits in a Choice, the one older readers use in the Fallback.
        const choice = child(node, 'mc:Choice');
        const drawingNode = choice ? descendants(choice, 'w:drawing')[0] : undefined;
        if (drawingNode) {
          const image = drawing(ctx, drawingNode);
          if (image) out.push(image);
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function inlineSegments(ctx: Context, parent: XmlNode, href?: string): Segment[] {
  const out: Segment[] = [];
  let inField = false;
  for (const node of elements(parent)) {
    switch (node.name) {
      case 'w:r': {
        // A field's code (`TOC \o "1-3"`, `PAGE`) sits between its begin and
        // separate marks; only its result, after `separate`, is text.
        const mark = child(node, W('fldChar'))?.attrs['w:fldCharType'];
        if (mark === 'begin') inField = true;
        if (mark === 'separate' || mark === 'end') inField = false;
        if (!inField && !child(node, W('instrText'))) out.push(...runSegments(ctx, node, href));
        break;
      }
      case 'w:hyperlink': {
        const rel = ctx.rels.get(node.attrs['r:id'] ?? '');
        out.push(...inlineSegments(ctx, node, rel?.external ? rel.target : href));
        break;
      }
      case 'w:ins':
      case 'w:smartTag':
      case 'w:fldSimple':
      case 'w:customXml':
        out.push(...inlineSegments(ctx, node, href));
        break;
      case 'w:sdt':
        out.push(...inlineSegments(ctx, child(node, W('sdtContent')) ?? node, href));
        break;
      case 'm:oMath':
      case 'm:oMathPara':
        skip(ctx, 'equation');
        break;
      default:
        break;
    }
  }
  return out;
}

/** Runs with the same formatting become one piece of text; bold and italic wrap it. */
function toInlines(segments: Segment[]): Inline[] {
  const out: Inline[] = [];
  let pending: Segment | null = null;
  const flush = () => {
    if (!pending?.text) {
      pending = null;
      return;
    }
    let node: Inline = { type: 'text', value: pending.text };
    if (pending.italic) node = { type: 'em', children: [node] };
    if (pending.bold) node = { type: 'strong', children: [node] };
    const last = out[out.length - 1];
    if (pending.href) {
      if (last?.type === 'link' && last.href === pending.href) last.children.push(node);
      else out.push({ type: 'link', href: pending.href, children: [node] });
    } else out.push(node);
    pending = null;
  };
  for (const segment of segments) {
    if (segment.image) {
      flush();
      out.push({ type: 'image', src: segment.image.src, alt: segment.image.alt });
    } else if (segment.footnote) {
      flush();
      out.push({ type: 'footnote', children: segment.footnote });
    } else if (segment.break) {
      flush();
      out.push({ type: 'break' });
    } else if (
      pending &&
      pending.bold === segment.bold &&
      pending.italic === segment.italic &&
      pending.href === segment.href
    ) {
      pending.text = `${pending.text ?? ''}${segment.text ?? ''}`;
    } else {
      flush();
      pending = { ...segment };
    }
  }
  flush();
  return out;
}

function paragraphInlines(ctx: Context, p: XmlNode): Inline[] {
  const inlines = toInlines(inlineSegments(ctx, p));
  // Leading and trailing breaks and spaces are Word spacing, not content.
  while (inlines[0]?.type === 'break') inlines.shift();
  while (inlines[inlines.length - 1]?.type === 'break') inlines.pop();
  const first = inlines[0];
  if (first?.type === 'text') first.value = first.value.replace(/^\s+/, '');
  const last = inlines[inlines.length - 1];
  if (last?.type === 'text') last.value = last.value.replace(/\s+$/, '');
  return inlines.filter((node) => node.type !== 'text' || node.value !== '');
}

function plainText(inlines: Inline[]): string {
  return inlines
    .map((node) =>
      node.type === 'text'
        ? node.value
        : node.type === 'strong' || node.type === 'em' || node.type === 'link'
          ? plainText(node.children)
          : '',
    )
    .join('');
}

function cellInlines(ctx: Context, cell: XmlNode): Inline[] {
  const paragraphs = descendants(cell, W('p'))
    .map((p) => paragraphInlines(ctx, p))
    .filter((p) => p.length > 0);
  return paragraphs.flatMap((inlines, i) => [
    ...(i > 0 ? [{ type: 'break' as const }] : []),
    ...inlines,
  ]);
}

function table(ctx: Context, tbl: XmlNode): Block | null {
  const rows: Inline[][][] = [];
  // Each body cell's paragraph alignment, by column — a column of figures set
  // flush right in Word stays flush right.
  const votes: Array<Record<string, number>> = [];
  for (const [r, tr] of elements(tbl, W('tr')).entries()) {
    const row: Inline[][] = [];
    for (const tc of elements(tr, W('tc'))) {
      const props = child(tc, W('tcPr'));
      const span = Number(val(child(props, W('gridSpan'))) ?? 1);
      // A merged cell's continuation carries nothing of its own.
      const merged = child(props, W('vMerge'));
      const continued = merged !== undefined && val(merged) !== 'restart';
      const content = continued ? [] : cellInlines(ctx, tc);
      if (r > 0 && span === 1 && content.length > 0) {
        const jc = val(child(child(descendants(tc, W('p'))[0], W('pPr')), W('jc'))) ?? 'left';
        const column = votes[row.length] ?? {};
        column[jc] = (column[jc] ?? 0) + 1;
        votes[row.length] = column;
      }
      row.push(content);
      for (let extra = 1; extra < span; extra++) row.push([]);
    }
    rows.push(row);
  }
  if (rows.length === 0) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const pad = (row: Inline[][]) => [
    ...row,
    ...Array.from({ length: width - row.length }, () => []),
  ];
  const align: TableAlign[] = Array.from({ length: width }, (_, i) => {
    const column = votes[i] ?? {};
    const [top] = Object.entries(column).sort((x, y) => y[1] - x[1]);
    const jc = top?.[0];
    return jc === 'right' || jc === 'end' ? 'right' : jc === 'center' ? 'center' : null;
  });
  const [head, ...body] = rows.map(pad);
  return { type: 'table', head: head ?? [], rows: body, align };
}

/** Consecutive numbered paragraphs, nested by their level, as markdown lists. */
function buildList(items: Array<{ level: number; format: ListFormat; inlines: Inline[] }>): Block {
  const root: Block & { type: 'list' } = {
    type: 'list',
    ordered: items[0]?.format.ordered ?? false,
    start: items[0]?.format.start ?? 1,
    items: [],
  };
  const stack: Array<{ list: Block & { type: 'list' }; level: number }> = [
    { list: root, level: items[0]?.level ?? 0 },
  ];
  for (const item of items) {
    while (stack.length > 1 && item.level < (stack[stack.length - 1] as { level: number }).level)
      stack.pop();
    let top = stack[stack.length - 1] as { list: Block & { type: 'list' }; level: number };
    if (item.level > top.level) {
      const nested: Block & { type: 'list' } = {
        type: 'list',
        ordered: item.format.ordered,
        start: item.format.start,
        items: [],
      };
      const parentItem = top.list.items[top.list.items.length - 1];
      if (parentItem) parentItem.push(nested);
      else top.list.items.push([nested]);
      stack.push({ list: nested, level: item.level });
      top = stack[stack.length - 1] as { list: Block & { type: 'list' }; level: number };
    }
    top.list.items.push([{ type: 'paragraph', children: item.inlines }]);
  }
  return root;
}

export function parseDocx(bytes: Uint8Array): ParsedDocx {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('not a Word file (.docx): the package could not be opened');
  }
  const document = read(files, 'word/document.xml');
  const body = child(document, W('body'));
  if (!body) throw new Error('not a Word file (.docx): word/document.xml is missing');

  const ctx: Context = {
    files,
    rels: readRels(files),
    styles: readStyles(files),
    numbering: readNumbering(files),
    footnotes: readFootnotes(files),
    media: new Map(),
    skipped: {},
  };

  const frontmatter: Record<string, string> = {};
  const core = read(files, 'docProps/core.xml');
  const coreTitle = child(core, 'dc:title');
  if (coreTitle && textOf(coreTitle).trim()) frontmatter.title = textOf(coreTitle).trim();

  const blocks: Block[] = [];
  let list: Array<{ level: number; format: ListFormat; inlines: Inline[] }> = [];
  let code: string[] = [];
  const flushList = () => {
    if (list.length > 0) blocks.push(buildList(list));
    list = [];
  };
  const flushCode = () => {
    if (code.length > 0) blocks.push({ type: 'code', lang: null, value: code.join('\n') });
    code = [];
  };

  const visit = (nodes: XmlNode[]) => {
    for (const node of nodes) {
      if (node.name === 'w:sdt') {
        visit(elements(child(node, W('sdtContent'))));
        continue;
      }
      if (node.name === 'w:tbl') {
        flushList();
        flushCode();
        const t = table(ctx, node);
        if (t) blocks.push(t);
        continue;
      }
      if (node.name === 'w:sectPr') {
        const size = child(node, W('pgSz'));
        const w = Number(size?.attrs['w:w']);
        const h = Number(size?.attrs['w:h']);
        if (w > h) frontmatter.orientation = 'landscape';
        continue;
      }
      if (node.name !== 'w:p') continue;

      const style = styleOf(ctx, node);
      // Word's own contents list is a field over these styles; MoSage builds its own.
      if (styleIs(ctx, style, (name) => /^(toc|table of contents)/.test(name))) continue;
      const pPr = child(node, W('pPr'));
      const sectPr = child(pPr, W('sectPr'));
      if (sectPr) visit([sectPr]);

      const inlines = paragraphInlines(ctx, node);
      const text = plainText(inlines).trim();

      if (styleIs(ctx, style, (name) => name === 'title')) {
        if (text && !frontmatter.title) frontmatter.title = text;
        if (text) continue;
      }
      if (styleIs(ctx, style, (name) => name === 'subtitle')) {
        if (text && !frontmatter.subtitle) frontmatter.subtitle = text;
        if (text) continue;
      }
      if (
        styleIs(ctx, style, (name) => /^(code|html preformatted|plain text|source code)/.test(name))
      ) {
        flushList();
        code.push(plainText(inlines));
        continue;
      }
      flushCode();
      if (inlines.length === 0) {
        flushList();
        continue;
      }

      const level = headingLevel(ctx, node, style);
      if (level !== null && text) {
        flushList();
        blocks.push({ type: 'heading', level, children: inlines });
        continue;
      }

      const num = child(pPr, W('numPr'));
      const numId = val(child(num, W('numId')));
      if (numId && numId !== '0') {
        const ilvl = Number(val(child(num, W('ilvl'))) ?? 0);
        list.push({ level: ilvl, format: ctx.numbering(numId, ilvl), inlines });
        continue;
      }
      flushList();

      const only = inlines.length === 1 ? inlines[0] : undefined;
      if (only?.type === 'image') {
        blocks.push({ type: 'figure', src: only.src, alt: only.alt });
        continue;
      }
      // A caption under a picture is that picture's caption.
      const previous = blocks[blocks.length - 1];
      if (styleIs(ctx, style, (name) => name === 'caption') && previous?.type === 'figure') {
        previous.alt = text;
        continue;
      }
      if (styleIs(ctx, style, (name) => /quot/.test(name))) {
        blocks.push({ type: 'quote', children: [{ type: 'paragraph', children: inlines }] });
        continue;
      }
      blocks.push({ type: 'paragraph', children: inlines });
    }
  };

  visit(elements(body));
  flushList();
  flushCode();

  return { frontmatter, blocks, media: ctx.media, skipped: ctx.skipped };
}
