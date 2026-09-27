import type { CSSProperties, ReactNode } from 'react';
import {
  BIBLIOGRAPHY_ATTR,
  CITE_ATTR,
  CITE_UNRESOLVED_ATTR,
  type CitationFormat,
  citeText,
  entryRuns,
  orderSources,
  SOURCE_ATTR,
  type Source,
  useCitations,
} from '../lib/citations';

export type CiteProps = {
  /** The source's id, or several for one citation: `['chen2024', 'lin2023']`. */
  id: string | string[];
  /** Where in the source: `12`, `45–47`. */
  page?: string | number;
  /** `Chen (2024)` inside the sentence, rather than `(Chen, 2024)` after it. */
  narrative?: boolean;
  style?: CSSProperties;
  className?: string;
};

/**
 * A citation that resolves against the document's `<Bibliography>` after
 * layout, like `<Ref>`: `[3]` in a numeric bibliography, `(Chen, 2024)` or
 * `（陳大文，2024）` in an author–date one. A source no bibliography lists is
 * printed as `[?id]` and reported by `mosage check`.
 */
export function Cite({ id, page, narrative = false, style, className }: CiteProps) {
  const { format, sources } = useCitations();
  const ids = Array.isArray(id) ? id : [id];
  const cited = ids.map((one) => sources.find((s) => s.id === one));
  const missing = ids.filter((_, i) => !cited[i]);

  if (missing.length > 0) {
    return (
      <span
        {...{ [CITE_ATTR]: ids.join(','), [CITE_UNRESOLVED_ATTR]: missing.join(',') }}
        className={className}
        style={{ color: 'var(--od-accent)', ...style }}
      >
        [?{missing.join(',')}]
      </span>
    );
  }

  const numberOf = (one: string) => sources.findIndex((s) => s.id === one) + 1;
  return (
    <span {...{ [CITE_ATTR]: ids.join(',') }} className={className} style={style}>
      {citeText(cited as Source[], format, numberOf, {
        ...(page !== undefined ? { page: String(page) } : {}),
        narrative,
      })}
    </span>
  );
}

export type BibliographyProps = {
  /** Every work the document cites — inline, or `import refs from './assets/references/refs.bib'`. */
  sources: Source[];
  /**
   * `numeric` numbers sources in the order they are listed here — list them in
   * the order the text first cites them. `author-date` sorts them by author.
   */
  format?: CitationFormat;
  style?: CSSProperties;
  className?: string;
};

const CJK = /[\u2E80-\u9FFF\uF900-\uFAFF]/;
/** Chinese has no italic; a slanted face is a synthesised one, so it is set off in bold. */
const CHINESE_EMPHASIS: CSSProperties = { fontStyle: 'normal', fontWeight: 600 };

/** Room for the widest `[n]` and a space, so every entry's text starts on one line. */
function numberWidth(count: number): string {
  return `${Math.max(2.4, (String(count).length + 2) * 0.62 + 0.6).toFixed(2)}em`;
}

const entryStyle = (indent: string): CSSProperties => ({
  margin: '0 0 8px',
  // A hanging indent: the first line starts at the margin, the rest line up
  // under the text, so the eye runs down the numbers or the names.
  paddingLeft: indent,
  textIndent: `-${indent}`,
  fontSize: 'var(--od-size-body, 14px)',
  lineHeight: 'var(--od-leading, 1.6)',
  overflowWrap: 'anywhere',
});

function entries(sources: Source[], format: CitationFormat): ReactNode[] {
  const ordered = orderSources(sources, format);
  const declaration = JSON.stringify({ format, sources });
  const numeric = format === 'numeric';
  const indent = numeric ? numberWidth(ordered.length) : '2em';
  return ordered.map((source, i) => (
    <p
      key={source.id}
      {...{ [SOURCE_ATTR]: source.id }}
      // The first entry declares the list, so the scan finds it wherever the
      // packer put the entries.
      {...(i === 0 ? { [BIBLIOGRAPHY_ATTR]: declaration } : {})}
      style={entryStyle(indent)}
    >
      {numeric && (
        // The box lines the text up on screen; the en space is what separates
        // them in Word, which keeps the text but not the box's width.
        <span style={{ display: 'inline-block', width: indent, textIndent: 0 }}>
          {`[${i + 1}]`}&ensp;
        </span>
      )}
      {entryRuns(source).map((run, j) =>
        run.emphasis ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: an entry's runs never reorder
          <em key={j} style={CJK.test(run.text) ? CHINESE_EMPHASIS : undefined}>
            {run.text}
          </em>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: an entry's runs never reorder
          <span key={j}>{run.text}</span>
        ),
      )}
    </p>
  ));
}

/**
 * The reference list `<Cite>` resolves against. Inside `flow()` each entry is
 * a block of its own, so a long list breaks across pages like prose.
 */
export function Bibliography({ sources, format = 'numeric', style, className }: BibliographyProps) {
  return (
    <div className={className} style={style}>
      {entries(sources, format)}
    </div>
  );
}

Bibliography.flowBlocks = ({ sources, format = 'numeric' }: BibliographyProps): ReactNode[] =>
  entries(sources, format);
