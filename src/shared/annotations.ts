// Annotations live in the chapter source as HTML comments, so they are
// invisible to every Markdown renderer and survive any editor:
//
//   <!-- mosage:comment id=c-1a2b3c4d by=human at=2026-09-26T08:00:00Z quote="這一句"
//   請改得更口語一點
//   -->
//   The paragraph the comment is about.
//
// A marker belongs to the block that follows it. `mosage:suggest` carries a
// proposed replacement for the next `span` blocks (default 1; 0 = insert).

export type AnnotationKind = 'comment' | 'suggest';

export interface MarkerData {
  kind: AnnotationKind;
  attrs: Record<string, string>;
  /** Comment text, or the replacement Markdown of a suggestion. */
  body: string;
}

export interface Annotation extends MarkerData {
  id: string;
  /** `human` or `ai`. */
  by: string;
  at?: string;
  quote?: string;
  note?: string;
  span: number;
  /** Offsets of the marker (the whole HTML comment) in the source. */
  start: number;
  end: number;
  /** Content block the marker is attached to; null when nothing follows it. */
  blockIndex: number | null;
}

const MARKER_RE = /^<!--[ \t]*mosage:(comment|suggest)\b([\s\S]*?)-->[ \t]*$/;
const ATTR_RE = /^[ \t]*([A-Za-z][\w-]*)=("(?:[^"\\\n]|\\.)*"|[^\s"]+)/;

export function isMarker(html: string): boolean {
  return MARKER_RE.test(html.trim());
}

function unquote(value: string): string {
  if (!value.startsWith('"')) return value;
  return value.slice(1, -1).replace(/\\(.)/g, (_, ch: string) => (ch === 'n' ? '\n' : ch));
}

/** Parse one HTML comment. Returns null when it is not a MoSage marker. */
export function parseMarker(html: string): MarkerData | null {
  const match = MARKER_RE.exec(html.trim());
  if (!match) return null;
  const kind = match[1] as AnnotationKind;
  const rest = match[2];
  const newline = rest.indexOf('\n');
  let header = newline === -1 ? rest : rest.slice(0, newline);
  const tail = newline === -1 ? '' : rest.slice(newline + 1);

  const attrs: Record<string, string> = {};
  for (;;) {
    const attr = ATTR_RE.exec(header);
    if (!attr) break;
    attrs[attr[1]] = unquote(attr[2]);
    header = header.slice(attr[0].length);
  }
  // Whatever is left on the header line starts the body, so a one-line
  // `<!-- mosage:comment by=ai 這裡需要資料來源 -->` works too.
  const body = [header.trim(), tail].filter((s) => s.trim() !== '').join('\n');
  return { kind, attrs, body: body.replace(/^\s*\n/, '').replace(/\s+$/, '') };
}

function quoteAttr(value: string): string {
  if (value !== '' && /^[^\s"=<>`'\\]+$/.test(value) && !value.includes('--')) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/--/g, '-\\-')}"`;
}

/** Serialize a marker. Attribute order is kept as given. */
export function formatMarker(
  kind: AnnotationKind,
  attrs: Record<string, string>,
  body: string,
): string {
  const head = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${quoteAttr(v)}`)
    .join(' ');
  // `-->` would end the HTML comment early.
  const safeBody = body.replace(/-->/g, '-- >').trim();
  return `<!-- mosage:${kind}${head ? ` ${head}` : ''}\n${safeBody}\n-->`;
}

/** 32-bit FNV-1a, hex. Stable ids for markers an agent wrote without one. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function newAnnotationId(kind: AnnotationKind): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${kind === 'comment' ? 'c' : 's'}-${random.slice(0, 8)}`;
}

/** Build the full annotation record, deriving an id when the marker has none. */
export function toAnnotation(
  data: MarkerData,
  position: { start: number; end: number; blockIndex: number | null },
  seen: Set<string>,
): Annotation {
  let id = data.attrs.id;
  if (!id) {
    const base = `${data.kind === 'comment' ? 'c' : 's'}-${hash(`${data.kind}\n${data.attrs.quote ?? ''}\n${data.body}`)}`;
    id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
  }
  seen.add(id);
  const span = Number.parseInt(data.attrs.span ?? '', 10);
  return {
    ...data,
    id,
    by: (data.attrs.by ?? (data.kind === 'suggest' ? 'ai' : 'human')).toLowerCase(),
    at: data.attrs.at,
    quote: data.attrs.quote,
    note: data.attrs.note,
    span: Number.isFinite(span) && span >= 0 ? span : 1,
    ...position,
  };
}
