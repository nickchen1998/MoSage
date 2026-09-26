// Read a Markdown (or plain text) manuscript: images it points at are copied
// into assets/imported/ and re-linked relative to chapters/.

import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Nodes } from 'mdast';
import { parseMarkdown } from '../../shared/markdown.ts';
import {
  applyEdits,
  isExternalUrl,
  markdownAlt,
  markdownTitle,
  markdownUrl,
  type SourceEdit,
  walk,
} from '../export/common.ts';
import type { ImportTarget } from '../export/types.ts';

export interface ImportLog {
  assets: string[];
  warnings: string[];
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

/** A file name without characters that trouble Markdown links or file systems. */
export function safeName(name: string): string {
  return (
    name
      .normalize('NFC')
      .replace(/[\s()[\]<>{}#%?*:|"'\\/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
}

async function sameContent(a: string, b: string): Promise<boolean> {
  if (statSync(a).size !== statSync(b).size) return false;
  const hash = async (p: string) =>
    createHash('sha1')
      .update(await readFile(p))
      .digest('hex');
  return (await hash(a)) === (await hash(b));
}

/** Copy `file` into `dir`, reusing an identical copy and never overwriting a different file. */
async function copyInto(file: string, dir: string): Promise<{ path: string; copied: boolean }> {
  await mkdir(dir, { recursive: true });
  const ext = extname(file).toLowerCase();
  const stem = safeName(basename(file, extname(file)));
  for (let n = 1; ; n++) {
    const dest = join(dir, `${stem}${n > 1 ? `-${n}` : ''}${ext}`);
    if (!existsSync(dest)) {
      await copyFile(file, dest);
      return { path: dest, copied: true };
    }
    if (await sameContent(file, dest)) return { path: dest, copied: false };
  }
}

function localPath(url: string, baseDir: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^file:/i.test(trimmed)) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      return null;
    }
  }
  if (isExternalUrl(trimmed)) return null;
  let path = trimmed.replace(/[?#].*$/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep it as written
  }
  return isAbsolute(path) ? path : resolve(baseDir, path);
}

/**
 * The Markdown of `file`, frontmatter removed, with local images copied into
 * `<root>/assets/imported/` and their links rewritten for chapters/.
 */
export async function readMarkdownFile(
  file: string,
  target: ImportTarget,
  log: ImportLog,
): Promise<string> {
  const source = (await readFile(file, 'utf8')).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const tree = parseMarkdown(source);
  const baseDir = dirname(file);
  const assetsDir = join(target.root, 'assets', 'imported');
  const imageRefs = new Set<string>();
  walk(tree, (node) => {
    if (node.type === 'imageReference') imageRefs.add(node.identifier);
  });

  const copies = new Map<string, string | null>();
  const relink = async (url: string): Promise<string | null> => {
    const path = localPath(url, baseDir);
    if (!path) return null;
    if (copies.has(path)) return copies.get(path) ?? null;
    let link: string | null = null;
    if (existsSync(path) && statSync(path).isFile()) {
      const { path: dest, copied } = await copyInto(path, assetsDir);
      if (copied) log.assets.push(posix(relative(target.root, dest)));
      link = posix(relative(target.chaptersDir, dest));
    } else {
      log.warnings.push(`找不到圖片：${url}（連結保持原樣）`);
    }
    copies.set(path, link);
    return link;
  };

  const edits: SourceEdit[] = [];
  const links: { url: string; edit: (url: string) => SourceEdit }[] = [];
  const visit = (node: Nodes) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if (node.type === 'yaml') {
      edits.push({ start, end, text: '' });
    } else if (node.type === 'image') {
      links.push({
        url: node.url,
        edit: (url) => ({
          start,
          end,
          text: `![${markdownAlt(node.alt ?? '')}](${markdownUrl(url)}${markdownTitle(node.title)})`,
        }),
      });
    } else if (node.type === 'definition') {
      if (!imageRefs.has(node.identifier)) return;
      links.push({
        url: node.url,
        edit: (url) => ({
          start,
          end,
          text: `[${node.label ?? node.identifier}]: ${markdownUrl(url)}${markdownTitle(node.title)}`,
        }),
      });
    } else if ('children' in node) {
      for (const child of node.children) visit(child as Nodes);
    }
  };
  visit(tree);
  // One at a time, so two links to the same file share one copy.
  for (const link of links) {
    const url = await relink(link.url);
    if (url !== null) edits.push(link.edit(url));
  }
  return applyEdits(source, edits);
}
