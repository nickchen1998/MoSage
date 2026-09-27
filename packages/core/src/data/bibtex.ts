/**
 * BibTeX, read far enough to cite from: what Zotero, EndNote, and Google
 * Scholar export. Entries become the `Source` objects `<Bibliography>` takes;
 * `@string`, `@preamble`, and `@comment` are skipped, and LaTeX markup is
 * reduced to its text.
 */

export type BibSource = {
  id: string;
  type: string;
  author?: string[];
  editor?: string[];
  title?: string;
  year?: string;
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  url?: string;
  doi?: string;
};

const TYPES: Record<string, string> = {
  article: 'article',
  book: 'book',
  inbook: 'chapter',
  incollection: 'chapter',
  inproceedings: 'chapter',
  conference: 'chapter',
  techreport: 'report',
  report: 'report',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  thesis: 'thesis',
  online: 'web',
  electronic: 'web',
  misc: 'other',
};

const ACCENTS: Record<string, string> = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', c: '̧' };

/** `{\"u}ber` → `über`, `{Taiwan}` → `Taiwan`, `\&` → `&`, `--` → `–`. */
export function cleanLatex(value: string): string {
  return value
    .replace(/\\([`'"^~c])\s*\{?([A-Za-z])\}?/g, (_, mark: string, ch: string) =>
      `${ch}${ACCENTS[mark] ?? ''}`.normalize('NFC'),
    )
    .replace(/\\([&%$#_{}])/g, '$1')
    .replace(/\\[a-zA-Z]+\s*/g, '')
    .replace(/[{}]/g, '')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/~/g, '\u00A0');
}

/** `Chen, Da-Wen and {World Health Organization} and 林小明` → three names. */
export function splitNames(value: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] as string;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    // Only a top-level `and` separates names — braces protect one inside a name.
    const and = depth === 0 ? /^\s+and\s+/i.exec(value.slice(i)) : null;
    if (and) {
      names.push(current);
      current = '';
      i += and[0].length - 1;
      continue;
    }
    current += ch;
  }
  names.push(current);
  return names.map(cleanLatex).filter(Boolean);
}

/** The value after `=`: `{…}` with nesting, `"…"`, a bare number or macro, joined by `#`. */
function readValue(
  text: string,
  at: number,
  macros: Map<string, string>,
): { value: string; end: number } {
  let i = at;
  let out = '';
  for (;;) {
    while (/\s/.test(text[i] ?? '')) i++;
    const ch = text[i];
    if (ch === '{') {
      let depth = 1;
      const start = ++i;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      out += text.slice(start, i - 1);
    } else if (ch === '"') {
      const start = ++i;
      let depth = 0;
      while (i < text.length && !(text[i] === '"' && depth === 0)) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      out += text.slice(start, i);
      i++;
    } else {
      const word = /^[^,}#\s]+/.exec(text.slice(i))?.[0] ?? '';
      out += macros.get(word.toLowerCase()) ?? word;
      i += word.length;
    }
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] !== '#') return { value: out, end: i };
    i++;
  }
}

export function parseBibtex(text: string): BibSource[] {
  const sources: BibSource[] = [];
  const macros = new Map<string, string>();
  const entry = /@(\w+)\s*([{(])/g;
  for (let match = entry.exec(text); match; match = entry.exec(text)) {
    const kind = (match[1] ?? '').toLowerCase();
    let i = match.index + match[0].length;
    if (kind === 'string') {
      // `@string{jtw = "Journal of Taiwan Studies"}` — an abbreviation later fields use bare.
      const name = /^\s*([\w-]+)\s*=/.exec(text.slice(i));
      if (name?.[1]) {
        const { value, end } = readValue(text, i + name[0].length, macros);
        macros.set(name[1].toLowerCase(), value);
        entry.lastIndex = end;
      }
      continue;
    }
    if (kind === 'preamble' || kind === 'comment') continue;

    const keyEnd = text.indexOf(',', i);
    if (keyEnd < 0) break;
    const id = text.slice(i, keyEnd).trim();
    i = keyEnd + 1;
    const fields: Record<string, string> = {};
    for (;;) {
      while (/[\s,]/.test(text[i] ?? '')) i++;
      if (i >= text.length || text[i] === '}' || text[i] === ')') break;
      const name = /^[\w-]+/.exec(text.slice(i))?.[0];
      if (!name) break;
      i += name.length;
      while (/\s/.test(text[i] ?? '')) i++;
      if (text[i] !== '=') break;
      const { value, end } = readValue(text, i + 1, macros);
      fields[name.toLowerCase()] = value;
      i = end;
    }
    entry.lastIndex = i;
    if (!id) continue;

    const clean = (name: string) => (fields[name] ? cleanLatex(fields[name]) : undefined);
    const source: BibSource = { id, type: TYPES[kind] ?? 'other' };
    if (fields.author) source.author = splitNames(fields.author);
    if (fields.editor) source.editor = splitNames(fields.editor);
    const assign = (key: keyof BibSource, value: string | undefined) => {
      if (value) (source as Record<string, unknown>)[key] = value;
    };
    assign('title', clean('title'));
    assign('year', clean('year') ?? clean('date')?.slice(0, 4));
    assign('container', clean('journal') ?? clean('journaltitle') ?? clean('booktitle'));
    assign('volume', clean('volume'));
    assign('issue', clean('number') ?? clean('issue'));
    assign('pages', clean('pages'));
    assign(
      'publisher',
      clean('publisher') ?? clean('institution') ?? clean('school') ?? clean('organization'),
    );
    assign('url', fields.url?.trim());
    assign('doi', fields.doi?.trim());
    sources.push(source);
  }
  return sources;
}
