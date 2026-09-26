// Source transforms behind every edit the web UI makes. Each one re-parses
// the current source and refuses (EditConflict) when the text it was asked to
// touch is no longer there — the agent may have rewritten it in between.

import { stringify as stringifyYaml } from 'yaml';
import { formatMarker, newAnnotationId } from './annotations.ts';
import { parseChapter } from './markdown.ts';

export class EditConflict extends Error {
  constructor(message = 'The chapter changed since it was loaded.') {
    super(message);
    this.name = 'EditConflict';
  }
}

/** Replace `source[start, end)` after checking it still reads `expected`. */
export function replaceRange(
  source: string,
  start: number,
  end: number,
  expected: string,
  text: string,
): string {
  if (source.slice(start, end) !== expected) throw new EditConflict();
  return source.slice(0, start) + text + source.slice(end);
}

/** Find a block by its offset, falling back to its text if offsets moved. */
function locateBlock(source: string, blockStart: number, expected: string) {
  const { blocks } = parseChapter(source);
  const exact = blocks.find(
    (b) => b.start === blockStart && source.slice(b.start, b.end) === expected,
  );
  if (exact) return exact;
  const byText = blocks.filter((b) => source.slice(b.start, b.end) === expected);
  if (byText.length === 1) return byText[0];
  throw new EditConflict();
}

export interface NewComment {
  blockStart: number;
  /** Source text of the block as the client saw it. */
  blockText: string;
  body: string;
  quote?: string;
  by?: 'human' | 'ai';
  now?: Date;
}

export function insertComment(source: string, c: NewComment): { source: string; id: string } {
  const block = locateBlock(source, c.blockStart, c.blockText);
  const id = newAnnotationId('comment');
  const marker = formatMarker(
    'comment',
    {
      id,
      by: c.by ?? 'human',
      at: (c.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      quote: c.quote?.trim().slice(0, 200) ?? '',
    },
    c.body.trim(),
  );
  // Put the marker after existing markers of the block so the oldest note
  // stays on top.
  const at = block.start;
  return { source: `${source.slice(0, at)}${marker}\n${source.slice(at)}`, id };
}

/** Remove a marker and the line break it came with. */
export function removeAnnotation(source: string, id: string): string {
  const { annotations } = parseChapter(source);
  const a = annotations.find((x) => x.id === id);
  if (!a) throw new EditConflict('The note no longer exists.');
  return cutMarker(source, a.start, a.end);
}

function cutMarker(source: string, start: number, end: number): string {
  let cutEnd = end;
  if (source[cutEnd] === '\n') cutEnd++;
  // A marker an agent wrote with blank lines on both sides would leave a
  // double blank line behind; collapse it.
  const before = source.slice(0, start);
  if (source[cutEnd] === '\n' && (before.endsWith('\n\n') || before === '')) cutEnd++;
  return before + source.slice(cutEnd);
}

/** Apply a `mosage:suggest`: its body replaces the next `span` blocks. */
export function acceptSuggestion(source: string, id: string): string {
  const parsed = parseChapter(source);
  const s = parsed.annotations.find((x) => x.id === id);
  if (s?.kind !== 'suggest') throw new EditConflict('The suggestion no longer exists.');
  const replacement = s.body.replace(/^\n+|\s+$/g, '');

  if (s.blockIndex === null || s.span === 0) {
    // Insertion: the suggestion text takes the marker's place.
    let end = s.end;
    if (source[end] === '\n') end++;
    const tail = source.slice(end);
    const sep = tail === '' ? '\n' : tail.startsWith('\n') ? '\n' : '\n\n';
    return source.slice(0, s.start) + replacement + sep + tail;
  }

  const first = parsed.blocks[s.blockIndex];
  const last = parsed.blocks[Math.min(parsed.blocks.length - 1, s.blockIndex + s.span - 1)];
  // Other notes inside the replaced range are kept, above the new text.
  const kept = parsed.annotations
    .filter((a) => a.id !== s.id && a.start >= s.start && a.end <= last.end)
    .map((a) => source.slice(a.start, a.end));
  const prefix = kept.length ? `${kept.join('\n')}\n` : '';
  const start = Math.min(s.start, first.start);
  return source.slice(0, start) + prefix + replacement + source.slice(last.end);
}

/** Set (or with `undefined`, delete) a frontmatter field, keeping the others. */
export function setFrontmatter(source: string, key: string, value: unknown): string {
  const { frontmatter, frontmatterRange } = parseChapter(source);
  const next = { ...frontmatter };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  const body = frontmatterRange ? source.slice(frontmatterRange[1]).replace(/^\n+/, '') : source;
  if (Object.keys(next).length === 0) return body;
  const yaml = stringifyYaml(next, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n${body}`;
}

/** Rewrite the chapter's `#` heading, adding one when it has none. */
export function setTitle(source: string, title: string): string {
  const parsed = parseChapter(source);
  const clean = title.replace(/[ \t\r\n]+/g, ' ').trim();
  const h1 = parsed.blocks.find((b) => b.node.type === 'heading' && b.node.depth === 1);
  if (h1) return `${source.slice(0, h1.start)}# ${clean}${source.slice(h1.end)}`;
  const at = parsed.frontmatterRange ? parsed.frontmatterRange[1] : 0;
  const head = source.slice(0, at);
  const rest = source.slice(at).replace(/^\n+/, '');
  return `${head}${head ? '\n\n' : ''}# ${clean}\n\n${rest}`;
}
