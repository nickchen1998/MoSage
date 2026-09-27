/**
 * Just enough XML to read the parts of a Word file: elements, attributes, and
 * text, with the five named entities and numeric references. No DTDs, no
 * namespaces resolved — WordprocessingML always spells its prefixes the same
 * way, so `w:p` is matched as written.
 */

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlChild[] };
export type XmlChild = XmlNode | string;

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED[ref] ?? match;
  });
}

const ATTR_RE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(text: string): XmlNode {
  const root: XmlNode = { name: '#document', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('<', i);
    const top = stack[stack.length - 1] as XmlNode;
    if (open < 0) {
      const tail = text.slice(i);
      if (tail.trim()) top.children.push(decodeEntities(tail));
      break;
    }
    if (open > i) top.children.push(decodeEntities(text.slice(i, open)));

    if (text.startsWith('<!--', open)) {
      i = text.indexOf('-->', open) + 3;
      if (i < 3) break;
      continue;
    }
    if (text.startsWith('<![CDATA[', open)) {
      const end = text.indexOf(']]>', open);
      top.children.push(text.slice(open + 9, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text[open + 1] === '?' || text[open + 1] === '!') {
      i = text.indexOf('>', open) + 1;
      if (i === 0) break;
      continue;
    }

    const close = text.indexOf('>', open);
    if (close < 0) break;
    const tag = text.slice(open + 1, close);
    i = close + 1;

    if (tag[0] === '/') {
      const name = tag.slice(1).trim();
      // Pop to the matching element; a stray closing tag is ignored.
      for (let depth = stack.length - 1; depth > 0; depth--) {
        if ((stack[depth] as XmlNode).name === name) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }

    const selfClosing = tag.endsWith('/');
    const body = selfClosing ? tag.slice(0, -1) : tag;
    const nameEnd = body.search(/\s|$/);
    const node: XmlNode = { name: body.slice(0, nameEnd), attrs: {}, children: [] };
    for (const match of body.slice(nameEnd).matchAll(ATTR_RE)) {
      node.attrs[match[1] as string] = decodeEntities(match[2] ?? match[3] ?? '');
    }
    top.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  const element = root.children.find((child): child is XmlNode => typeof child !== 'string');
  return element ?? root;
}

export function elements(node: XmlNode | undefined, name?: string): XmlNode[] {
  if (!node) return [];
  return node.children.filter(
    (child): child is XmlNode =>
      typeof child !== 'string' && (name === undefined || child.name === name),
  );
}

export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c): c is XmlNode => typeof c !== 'string' && c.name === name);
}

/** Every descendant with this name, in document order. */
export function descendants(node: XmlNode | undefined, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (typeof c === 'string') continue;
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  if (node) walk(node);
  return out;
}

/** All the text under a node, as written. */
export function textOf(node: XmlNode): string {
  return node.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}
