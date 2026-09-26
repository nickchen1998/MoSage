// mdast → React. We render the tree ourselves (instead of react-markdown) so
// every top-level block keeps its source offsets for editing and comments.

import type {
  FootnoteDefinition,
  Heading,
  List,
  ListItem,
  Nodes,
  Root,
  RootContent,
  Table,
} from 'mdast';
import { createContext, Fragment, type ReactNode, useContext } from 'react';
import { isPageBreak, textOf } from '../../../src/shared/markdown.ts';
import { chapterFileUrl } from '../api.ts';

export interface RenderContext {
  book: string;
  /** Footnote identifier → display number, in order of first reference. */
  footnotes: Map<string, number>;
  /** Text to highlight (quotes of open comments). */
  highlights: string[];
  /** Prefix for element ids, so several chapters can share a page. */
  idPrefix: string;
}

const Ctx = createContext<RenderContext>({
  book: '',
  footnotes: new Map(),
  highlights: [],
  idPrefix: '',
});

const ALERTS: Record<string, string> = {
  NOTE: '注意',
  TIP: '提示',
  IMPORTANT: '重要',
  WARNING: '警告',
  CAUTION: '小心',
};

/** Number footnotes by first reference, like the Word export does. */
export function collectFootnotes(tree: Root): Map<string, number> {
  const map = new Map<string, number>();
  const walk = (node: Nodes) => {
    if (node.type === 'footnoteReference' && !map.has(node.identifier)) {
      map.set(node.identifier, map.size + 1);
    }
    if ('children' in node) for (const child of node.children as Nodes[]) walk(child);
  };
  walk(tree);
  return map;
}

export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}

function Highlighted({ text }: { text: string }) {
  const { highlights } = useContext(Ctx);
  const quotes = highlights.filter((q) => q && text.includes(q));
  if (quotes.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let best = -1;
    let quote = '';
    for (const q of quotes) {
      const at = rest.indexOf(q);
      if (at !== -1 && (best === -1 || at < best)) {
        best = at;
        quote = q;
      }
    }
    if (best === -1) {
      parts.push(rest);
      break;
    }
    if (best > 0) parts.push(rest.slice(0, best));
    parts.push(
      <mark key={key++} className="quote-mark">
        {quote}
      </mark>,
    );
    rest = rest.slice(best + quote.length);
  }
  return <>{parts}</>;
}

function Children({ nodes }: { nodes: readonly Nodes[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Node key={i} node={n} />
      ))}
    </>
  );
}

function alertOf(node: Nodes): { kind: string; rest: Nodes[] } | null {
  if (node.type !== 'blockquote') return null;
  const first = node.children[0];
  if (first?.type !== 'paragraph') return null;
  const lead = first.children[0];
  if (lead?.type !== 'text') return null;
  const m = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/i.exec(lead.value);
  if (!m) return null;
  const remaining = lead.value.slice(m[0].length);
  const firstChildren = [
    ...(remaining ? [{ ...lead, value: remaining }] : []),
    ...first.children.slice(1),
  ];
  const rest: Nodes[] = [
    ...(firstChildren.length ? [{ ...first, children: firstChildren } as Nodes] : []),
    ...node.children.slice(1),
  ];
  return { kind: m[1].toUpperCase(), rest };
}

function ListView({ node }: { node: List }) {
  const items = node.children.map((item: ListItem, i) => (
    <li key={i} className={item.checked === null || item.checked === undefined ? '' : 'task'}>
      {item.checked !== null && item.checked !== undefined && (
        <input type="checkbox" checked={item.checked} readOnly />
      )}
      {/* Tight lists render their paragraphs inline, like the Word export. */}
      {item.children.map((child, j) =>
        child.type === 'paragraph' && !node.spread ? (
          <Fragment key={j}>
            <Children nodes={child.children} />
            {j < item.children.length - 1 && <br />}
          </Fragment>
        ) : (
          <Node key={j} node={child} />
        ),
      )}
    </li>
  ));
  return node.ordered ? <ol start={node.start ?? undefined}>{items}</ol> : <ul>{items}</ul>;
}

function TableView({ node }: { node: Table }) {
  const [head, ...body] = node.children;
  const align = (i: number) => node.align?.[i] ?? undefined;
  return (
    <div className="table-wrap">
      <table>
        {head && (
          <thead>
            <tr>
              {head.children.map((cell, i) => (
                <th key={i} style={{ textAlign: align(i) }}>
                  <Children nodes={cell.children} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.children.map((cell, i) => (
                <td key={i} style={{ textAlign: align(i) }}>
                  <Children nodes={cell.children} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Node({ node }: { node: Nodes }): ReactNode {
  const ctx = useContext(Ctx);
  switch (node.type) {
    case 'root':
      return <Children nodes={node.children} />;
    case 'paragraph': {
      const only = node.children.length === 1 ? node.children[0] : null;
      if (only?.type === 'image') {
        return (
          <figure>
            <img src={chapterFileUrl(ctx.book, only.url)} alt={only.alt ?? ''} loading="lazy" />
            {only.alt && <figcaption>{only.alt}</figcaption>}
          </figure>
        );
      }
      return (
        <p>
          <Children nodes={node.children} />
        </p>
      );
    }
    case 'heading': {
      const Tag = `h${Math.min(node.depth, 6)}` as 'h1';
      return (
        <Tag id={`${ctx.idPrefix}${slug(textOf(node as Heading))}`}>
          <Children nodes={node.children} />
        </Tag>
      );
    }
    case 'text':
      return <Highlighted text={node.value} />;
    case 'emphasis':
      return (
        <em>
          <Children nodes={node.children} />
        </em>
      );
    case 'strong':
      return (
        <strong>
          <Children nodes={node.children} />
        </strong>
      );
    case 'delete':
      return (
        <del>
          <Children nodes={node.children} />
        </del>
      );
    case 'inlineCode':
      return <code>{node.value}</code>;
    case 'break':
      return <br />;
    case 'link':
      return (
        <a href={node.url} target="_blank" rel="noreferrer" title={node.title ?? undefined}>
          <Children nodes={node.children} />
        </a>
      );
    case 'image':
      return (
        <img
          className="inline-image"
          src={chapterFileUrl(ctx.book, node.url)}
          alt={node.alt ?? ''}
          loading="lazy"
        />
      );
    case 'code':
      return (
        <pre className="code-block" data-lang={node.lang ?? undefined}>
          <code>{node.value}</code>
        </pre>
      );
    case 'blockquote': {
      const alert = alertOf(node);
      if (alert) {
        return (
          <aside className={`callout callout-${alert.kind.toLowerCase()}`}>
            <div className="callout-label">{ALERTS[alert.kind]}</div>
            <Children nodes={alert.rest} />
          </aside>
        );
      }
      return (
        <blockquote>
          <Children nodes={node.children} />
        </blockquote>
      );
    }
    case 'list':
      return <ListView node={node} />;
    case 'listItem':
      return (
        <li>
          <Children nodes={node.children} />
        </li>
      );
    case 'table':
      return <TableView node={node} />;
    case 'thematicBreak':
      return <div className="scene-break">＊　＊　＊</div>;
    case 'footnoteReference': {
      const n = ctx.footnotes.get(node.identifier);
      return (
        <sup className="fn-ref">
          <a href={`#${ctx.idPrefix}fn-${node.identifier}`}>{n ?? '?'}</a>
        </sup>
      );
    }
    case 'footnoteDefinition':
      return null;
    case 'html':
      if (isPageBreak(node as RootContent)) return <div className="page-break">分頁</div>;
      return null;
    case 'yaml':
      return null;
    default:
      return 'children' in node ? <Children nodes={node.children as Nodes[]} /> : null;
  }
}

export function RenderProvider({ value, children }: { value: RenderContext; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The chapter's footnotes, printed at its end like endnotes. */
export function Footnotes({ tree }: { tree: Root }) {
  const ctx = useContext(Ctx);
  const defs = tree.children.filter(
    (n): n is FootnoteDefinition => n.type === 'footnoteDefinition',
  );
  if (defs.length === 0) return null;
  const sorted = [...defs].sort(
    (a, b) => (ctx.footnotes.get(a.identifier) ?? 999) - (ctx.footnotes.get(b.identifier) ?? 999),
  );
  return (
    <section className="footnotes">
      <ol>
        {sorted.map((d) => (
          <li
            key={d.identifier}
            id={`${ctx.idPrefix}fn-${d.identifier}`}
            value={ctx.footnotes.get(d.identifier)}
          >
            <Children nodes={d.children} />
          </li>
        ))}
      </ol>
    </section>
  );
}
