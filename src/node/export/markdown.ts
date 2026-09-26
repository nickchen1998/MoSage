// Markdown chapters → one merged manuscript, for pandoc, another editor, or a
// publisher who wants plain text. The author's Markdown is kept as written;
// only what cannot survive the merge is rewritten: the frontmatter and
// annotation markers go, footnote labels get a per-chapter prefix, and
// relative image links are re-pointed from chapters/ to the output folder.

import { isAbsolute, join, relative, sep } from 'node:path';
import type { Nodes } from 'mdast';
import { isMarker } from '../../shared/annotations.ts';
import { parseMarkdown, stripMarkers } from '../../shared/markdown.ts';
import {
  applyEdits,
  imageCandidates,
  isExternalUrl,
  markdownAlt,
  markdownTitle,
  markdownUrl,
  resolveLocalFile,
  type SourceEdit,
  walk,
} from './common.ts';
import type { ManuscriptInput } from './types.ts';

/** A chapter-relative image URL, re-pointed so it resolves from `outputDir`. */
function rewriteUrl(url: string, root: string, outputDir: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('#') || isExternalUrl(trimmed) || isAbsolute(trimmed)) {
    return url;
  }
  const file = resolveLocalFile(trimmed, root) ?? imageCandidates(trimmed, root)[0];
  if (!file) return url;
  return relative(outputDir, file).split(sep).join('/');
}

function chapterMarkdown(source: string, index: number, root: string, outputDir: string): string {
  const clean = stripMarkers(source);
  const tree = parseMarkdown(clean);
  const prefix = `ch${index + 1}-`;
  const imageRefs = new Set<string>();
  walk(tree, (node) => {
    if (node.type === 'imageReference') imageRefs.add(node.identifier);
  });

  const edits: SourceEdit[] = [];
  const visit = (node: Nodes) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    switch (node.type) {
      case 'yaml':
        edits.push({ start, end, text: '' });
        return;
      case 'html':
        // Markers nested in lists or quotes, which stripMarkers leaves alone.
        if (isMarker(node.value)) {
          edits.push({ start, end: clean[end] === '\n' ? end + 1 : end, text: '' });
        }
        return;
      case 'footnoteReference':
        edits.push({ start, end, text: `[^${prefix}${node.label ?? node.identifier}]` });
        return;
      case 'footnoteDefinition': {
        const label = /^\[\^([^\]]+)\]:/.exec(clean.slice(start, end));
        if (label) {
          edits.push({ start, end: start + label[0].length, text: `[^${prefix}${label[1]}]:` });
        }
        break;
      }
      case 'image': {
        const url = rewriteUrl(node.url, root, outputDir);
        if (url !== node.url) {
          edits.push({
            start,
            end,
            text: `![${markdownAlt(node.alt ?? '')}](${markdownUrl(url)}${markdownTitle(node.title)})`,
          });
        }
        return;
      }
      case 'definition': {
        if (!imageRefs.has(node.identifier)) return;
        const url = rewriteUrl(node.url, root, outputDir);
        if (url !== node.url) {
          edits.push({
            start,
            end,
            text: `[${node.label ?? node.identifier}]: ${markdownUrl(url)}${markdownTitle(node.title)}`,
          });
        }
        return;
      }
    }
    if ('children' in node) for (const child of node.children) visit(child as Nodes);
  };
  visit(tree);
  return applyEdits(clean, edits).trim();
}

/** Build the whole manuscript as one Markdown file. */
export function buildMarkdown(input: ManuscriptInput): string {
  const outputDir = input.outputDir ?? join(input.root, 'output');
  const parts = input.chapters
    .map((c, i) => chapterMarkdown(c.source, i, input.root, outputDir))
    .filter((part) => part !== '');
  return parts.length ? `${parts.join('\n\n')}\n` : '';
}
