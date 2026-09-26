import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

const TABLE_DIVIDER_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/**
 * A theme file is prose written by the `create-theme` skill — headings, prose,
 * lists, and paste-ready code. This renders exactly that much Markdown rather
 * than pulling a parser into the runtime bundle.
 */
export function parseMarkdown(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang = fence[1] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: 'code', lang, text: body.join('\n') });
      continue;
    }

    // A pipe row followed by a divider row is a table. Theme files lean on
    // tables for palettes and type scales, so leaving them as raw text makes
    // the theme page unreadable.
    if (line.trim().startsWith('|') && TABLE_DIVIDER_RE.test(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'list', items });
      continue;
    }

    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>\s?|\||\s*([-*+]|\d+\.)\s)/.test(lines[i])
    ) {
      body.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: 'paragraph', text: body.join(' ') });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={`i${key++}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`i${key++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('](') + 2, -1);
      nodes.push(
        <a key={`i${key++}`} href={href} className="underline underline-offset-2">
          {label}
        </a>,
      );
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-10 mb-3 font-semibold text-xl tracking-tight',
  2: 'mt-8 mb-2.5 font-semibold text-base tracking-tight',
  3: 'mt-6 mb-2 font-medium text-sm',
};

export function Markdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="text-muted-foreground text-sm leading-relaxed">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'heading': {
            const className = HEADING_CLASS[block.level] ?? HEADING_CLASS[3];
            return (
              <p key={key} className={`text-foreground first:mt-0 ${className}`}>
                {renderInline(block.text)}
              </p>
            );
          }
          case 'code':
            return (
              <pre
                key={key}
                className="my-3 overflow-x-auto rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-[11.5px] text-foreground leading-relaxed"
              >
                {block.text}
              </pre>
            );
          case 'list':
            return (
              <ul key={key} className="my-3 list-disc space-y-1 pl-5">
                {block.items.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parsed markdown has no stable id, and the list is re-rendered wholesale
                  <li key={`${key}-${itemIndex}`}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'quote':
            return (
              <blockquote key={key} className="my-3 border-border border-l-2 pl-3 italic">
                {renderInline(block.text)}
              </blockquote>
            );
          case 'table':
            return (
              <div key={key} className="my-4 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {block.head.map((cell, cellIndex) => (
                        <th
                          // biome-ignore lint/suspicious/noArrayIndexKey: column position is the identity
                          key={`h${cellIndex}`}
                          className="border-border border-b px-2 py-1.5 text-left font-medium text-muted-foreground"
                        >
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: row position is the identity
                      <tr key={`r${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td
                            // biome-ignore lint/suspicious/noArrayIndexKey: column position is the identity
                            key={`c${cellIndex}`}
                            className="border-border border-b px-2 py-1.5 align-top text-foreground"
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'rule':
            return <hr key={key} className="my-6 border-border" />;
          default:
            return (
              <p key={key} className="my-3">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
