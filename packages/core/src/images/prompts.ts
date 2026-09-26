import { type AstNode, parseSource, walkAst } from '../editing/babel-walk.ts';
import { IMAGES_DIR, validateFolderName } from '../files/assets.ts';

/** File-name-safe: the id becomes `<id>.png` on disk. */
export const IMAGE_PROMPT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** One `<ImagePrompt>` in a document's source — an image still waiting to be drawn. */
export type ImagePromptEntry = {
  id: string;
  prompt: string;
  chapter: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  line: number;
  /** Why this entry cannot be generated as written; null when it can. */
  problem: string | null;
};

type Attr = { name: string; node: AstNode | null; value: string | number | null };

function jsxName(element: AstNode): string | null {
  const opening = element.openingElement as AstNode | undefined;
  const name = opening?.name as AstNode | undefined;
  return name?.type === 'JSXIdentifier' ? (name.name as string) : null;
}

function staticValue(node: AstNode | null | undefined): string | number | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value as string;
  if (node.type === 'NumericLiteral') return node.value as number;
  if (node.type === 'JSXExpressionContainer') return staticValue(node.expression as AstNode);
  if (node.type === 'TemplateLiteral') {
    const quasis = node.quasis as AstNode[];
    if ((node.expressions as AstNode[]).length === 0 && quasis.length === 1) {
      return (quasis[0].value as { cooked: string }).cooked;
    }
  }
  return null;
}

function attributesOf(element: AstNode): Attr[] {
  const opening = element.openingElement as AstNode;
  const out: Attr[] = [];
  for (const attr of opening.attributes as AstNode[]) {
    if (attr.type !== 'JSXAttribute') continue;
    const name = (attr.name as AstNode).name as string;
    const node = (attr.value as AstNode | null) ?? null;
    out.push({ name, node, value: staticValue(node) });
  }
  return out;
}

function promptElements(ast: AstNode): AstNode[] {
  const found: AstNode[] = [];
  walkAst(ast, (node) => {
    if (node.type === 'JSXElement' && jsxName(node) === 'ImagePrompt') found.push(node);
  });
  return found;
}

function readEntry(element: AstNode): ImagePromptEntry {
  const attrs = new Map(attributesOf(element).map((a) => [a.name, a]));
  const text = (key: string) => {
    const v = attrs.get(key)?.value;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const size = (key: string) => {
    const v = attrs.get(key)?.value;
    return typeof v === 'number' && v > 0 ? v : null;
  };
  const id = text('id') ?? '';
  const prompt = text('prompt') ?? '';
  const chapterRaw = text('chapter');
  const chapter = chapterRaw === null ? null : validateFolderName(chapterRaw);

  let problem: string | null = null;
  if (!IMAGE_PROMPT_ID_RE.test(id)) problem = 'id must be lowercase letters, digits and dashes';
  else if (!prompt) problem = 'prompt is empty';
  else if (chapterRaw !== null && chapter === null) problem = 'chapter is not a usable folder name';

  return {
    id,
    prompt,
    chapter,
    alt: text('alt'),
    width: size('width'),
    height: size('height'),
    line: element.loc?.start.line ?? 0,
    problem,
  };
}

export function findImagePrompts(source: string): ImagePromptEntry[] {
  const ast = parseSource(source);
  if (!ast) return [];
  const entries = promptElements(ast).map(readEntry);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.problem) continue;
    if (seen.has(entry.id)) entry.problem = `id "${entry.id}" is used more than once`;
    seen.add(entry.id);
  }
  return entries;
}

/** Where a prompt's image is stored, relative to the document's own folder. */
export function imagePathFor(entry: Pick<ImagePromptEntry, 'id' | 'chapter'>): string {
  return ['assets', IMAGES_DIR, ...(entry.chapter ? [entry.chapter] : []), `${entry.id}.png`].join(
    '/',
  );
}

function identifierFor(id: string, source: string): string {
  const base = `img${id
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('')}`;
  let name = base;
  for (let n = 2; new RegExp(`\\b${name}\\b`).test(source); n++) name = `${base}${n}`;
  return name;
}

function jsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')}'`;
}

function lastImportEnd(ast: AstNode): number {
  const body = (ast.program as { body: AstNode[] }).body;
  let end = 0;
  for (const node of body) if (node.type === 'ImportDeclaration') end = node.end;
  return end;
}

/** Drops `ImagePrompt` from the `mosage` import once nothing uses it any more. */
function dropUnusedImport(source: string): string {
  const ast = parseSource(source);
  if (!ast || promptElements(ast).length > 0) return source;
  const body = (ast.program as { body: AstNode[] }).body;
  for (const node of body) {
    if (node.type !== 'ImportDeclaration') continue;
    if ((node.source as AstNode).value !== 'mosage') continue;
    const specifiers = node.specifiers as AstNode[];
    const index = specifiers.findIndex(
      (s) => s.type === 'ImportSpecifier' && (s.imported as AstNode).name === 'ImagePrompt',
    );
    if (index < 0) continue;
    if (specifiers.length === 1) {
      const end = source[node.end] === '\n' ? node.end + 1 : node.end;
      return source.slice(0, node.start) + source.slice(end);
    }
    const target = specifiers[index];
    // Take the separator on the side that has a neighbour, so `{ a, ImagePrompt }`
    // and `{ ImagePrompt, b }` both come out as clean lists.
    const [from, to] =
      index < specifiers.length - 1
        ? [target.start, specifiers[index + 1].start]
        : [specifiers[index - 1].end, target.end];
    return source.slice(0, from) + source.slice(to);
  }
  return source;
}

/**
 * Replaces the `<ImagePrompt>` with this id by a plain `<img>` of the file now
 * on disk, importing it the way an author would. Returns null when the source
 * has no such prompt.
 */
export function replaceImagePrompt(source: string, id: string, importPath: string): string | null {
  const ast = parseSource(source);
  if (!ast) return null;
  const element = promptElements(ast).find((node) => readEntry(node).id === id);
  if (!element) return null;

  const entry = readEntry(element);
  const attrs = new Map(attributesOf(element).map((a) => [a.name, a]));
  const ident = identifierFor(id, source);

  const style: string[] = [];
  if (entry.width !== null) style.push(`width: ${entry.width}`);
  else style.push("maxWidth: '100%'");
  if (entry.height !== null) style.push(`height: ${entry.height}`, "objectFit: 'cover'");
  style.push("display: 'block'");
  const extra = attrs.get('style')?.node;
  if (extra?.type === 'JSXExpressionContainer') {
    const expr = extra.expression as AstNode;
    style.push(`...${source.slice(expr.start, expr.end)}`);
  }

  const img = `<img src={${ident}} alt=${jsString(entry.alt ?? entry.prompt.slice(0, 120))} style={{ ${style.join(', ')} }} />`;
  const importLine = `import ${ident} from ${jsString(importPath)};\n`;

  // Edit back to front so earlier offsets stay valid.
  const at = lastImportEnd(ast);
  let next = source.slice(0, element.start) + img + source.slice(element.end);
  next =
    at === 0 ? importLine + next : `${next.slice(0, at)}\n${importLine.trimEnd()}${next.slice(at)}`;
  return dropUnusedImport(next);
}
