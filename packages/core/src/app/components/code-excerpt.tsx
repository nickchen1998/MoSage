import { type CSSProperties, type ReactNode, useId } from 'react';
import {
  type CodeSource,
  type ExcerptStatus,
  excerptLink,
  excerptStatus,
  formatRange,
  type LineRange,
  parseRange,
  parseRanges,
} from '../lib/code';
import { PRINTED_SHA_LENGTH } from '../lib/code-remote';
import {
  LABEL_ATTR,
  LABEL_DETAIL_ATTR,
  LABEL_ID_ATTR,
  LABEL_TEXT_ATTR,
  type LabelEntry,
  type LabelVocabulary,
  useDocLabel,
  useDocLabels,
  useLabelVocabulary,
} from '../lib/labels';
import { LIST_OF_ATTR, REF_ATTR, REF_PAGE_ATTR } from './numbering';

export const CODE_ATTR = 'data-od-code';
export const CODE_STATUS_ATTR = 'data-od-code-status';
export const CODE_ERROR_ATTR = 'data-od-code-error';

/** What an excerpt publishes through its label, for `<CodeList>` and the viewer's code panel. */
export type CodeDetail = {
  path: string;
  lines: string;
  status: ExcerptStatus;
  href?: string;
  printed?: string;
  sha?: string;
  repo?: string;
  host?: string;
  at?: string;
};

export function codeDetail(entry: LabelEntry): CodeDetail | null {
  const d = entry.detail;
  if (!d?.path || !d.status) return null;
  return d as unknown as CodeDetail;
}

export type CodeExcerptProps = {
  /** The module from `import src from '../../code/etl/transform.py?code'`. */
  src: CodeSource;
  /** `"12-38"`. The whole file when omitted. */
  lines?: string;
  /** Lines inside `lines` to leave out, as `"22-31"` or `"22-31, 40-44"`. */
  omit?: string;
  caption?: ReactNode;
  /** Plain-text caption for `<CodeList>` when `caption` carries markup. */
  captionText?: string;
  /** Stable id, so `<Ref to>` can point at it. Generated when omitted. */
  id?: string;
  style?: CSSProperties;
};

const fill = (template: string, range: LineRange) =>
  template.replace('{range}', formatRange(range));

function problemWith(
  src: CodeSource,
  lines: string | undefined,
  omit: string | undefined,
): { range: LineRange; omitted: LineRange[] } | string {
  const total = src.lines.length;
  const range = lines === undefined ? { start: 1, end: Math.max(1, total) } : parseRange(lines);
  if (!range) return `lines="${lines}" is not a line range`;
  if (range.end > total)
    return `${src.path} has ${total} lines; lines="${lines}" runs past the end`;
  const omitted = omit === undefined ? [] : parseRanges(omit);
  if (!omitted) return `omit="${omit}" is not a list of line ranges`;
  if (omitted.some((r) => r.start < range.start || r.end > range.end)) {
    return `omit="${omit}" must fall inside lines ${formatRange(range)}`;
  }
  return { range, omitted };
}

// A document without a `design` const sets none of these.
const T = {
  text: 'var(--od-text, #16181d)',
  muted: 'var(--od-muted, #6b7280)',
  accent: 'var(--od-accent, #2563eb)',
  rule: 'var(--od-rule, #e5e7eb)',
  bg: 'var(--od-bg, #ffffff)',
  mono: 'var(--od-font-mono, ui-monospace, "SF Mono", Menlo, monospace)',
  body: 'var(--od-font-body, inherit)',
  caption: 'var(--od-size-caption, 12px)',
  bodySize: 'var(--od-size-body, 14px)',
  code: 'calc(var(--od-size-body, 14px) - 2px)',
  radius: 'var(--od-radius, 6px)',
};

const rowStyle: CSSProperties = { display: 'flex', margin: 0 };

/**
 * Lines of a file in `code/`, numbered as they are in the file, with a link to
 * that exact version on GitHub or GitLab. A reader following the link lands
 * on the lines the page shows; the link is fixed to the pushed commit, so it
 * keeps showing them after the code moves on.
 *
 * Numbered like a figure — `<Ref to>` works, and `<CodeList>` lists them.
 */
export function CodeExcerpt({
  src,
  lines,
  omit,
  caption,
  captionText,
  id,
  style,
}: CodeExcerptProps) {
  const generated = useId();
  const labelId = id ?? generated;
  const entry = useDocLabel(labelId);
  const vocabulary = useLabelVocabulary();

  const parsed = problemWith(src, lines, omit);
  if (typeof parsed === 'string') {
    // Visible on the page and reported by `mosage check`, like an unresolved `<Ref>`.
    return (
      <p
        {...{ [CODE_ERROR_ATTR]: parsed }}
        style={{
          margin: '0 0 16px',
          color: T.accent,
          fontFamily: T.mono,
          fontSize: T.caption,
        }}
      >
        [? {parsed}]
      </p>
    );
  }

  const { range, omitted } = parsed;
  const status = excerptStatus(src, range);
  const link = status === 'new' ? null : excerptLink(src, lines === undefined ? null : range);
  const text =
    captionText ??
    (typeof caption === 'string' || typeof caption === 'number' ? String(caption) : src.path);
  const detail: CodeDetail = {
    path: src.path,
    lines: formatRange(range),
    status,
    ...(link ? { href: link.href, printed: link.printed, sha: link.sha } : {}),
    ...(src.remote ? { repo: src.remote.webUrl, host: src.remote.host } : {}),
    ...(src.pushed?.at ? { at: src.pushed.at } : {}),
  };

  const digits = String(range.end).length;
  const numberStyle: CSSProperties = {
    flex: 'none',
    width: `${digits + 1}ch`,
    paddingRight: 12,
    textAlign: 'right',
    color: T.muted,
    userSelect: 'none',
  };
  const rows: ReactNode[] = [];
  for (let n = range.start; n <= range.end; n++) {
    const gap = omitted.find((r) => r.start === n);
    if (gap) {
      rows.push(
        <p
          key={`gap-${n}`}
          style={{
            ...rowStyle,
            margin: '2px 0',
            borderTop: `1px dashed ${T.rule}`,
            borderBottom: `1px dashed ${T.rule}`,
            color: T.muted,
          }}
        >
          <span style={numberStyle}>⋮</span>
          <span style={{ fontFamily: T.body, fontSize: T.caption }}>
            {fill(vocabulary.codeOmitted, gap)}
          </span>
        </p>,
      );
      n = gap.end;
      continue;
    }
    rows.push(
      <p key={n} style={rowStyle}>
        <span style={numberStyle}>{n}</span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            paddingRight: 12,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            tabSize: 4,
          }}
        >
          {src.lines[n - 1] || ' '}
        </span>
      </p>,
    );
  }

  return (
    <figure
      {...{
        [LABEL_ATTR]: 'code',
        [LABEL_ID_ATTR]: labelId,
        [LABEL_TEXT_ATTR]: text,
        [LABEL_DETAIL_ATTR]: JSON.stringify(detail),
        [CODE_ATTR]: src.path,
        [CODE_STATUS_ATTR]: status,
      }}
      style={{ margin: '0 0 16px', ...style }}
    >
      <div
        style={{
          border: `1px solid ${T.rule}`,
          borderRadius: T.radius,
          background: `color-mix(in srgb, ${T.text} 3%, ${T.bg})`,
          overflow: 'hidden',
        }}
      >
        <p
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            margin: 0,
            padding: '6px 12px',
            borderBottom: `1px solid ${T.rule}`,
            background: T.bg,
            fontSize: T.caption,
            color: T.muted,
          }}
        >
          <span style={{ fontFamily: T.mono, fontWeight: 500, color: T.text }}>{src.path}</span>
          <span style={{ flex: 1 }}>{fill(vocabulary.codeLines, range)}</span>
          {link && (
            <span style={{ fontFamily: T.mono }}>{link.sha.slice(0, PRINTED_SHA_LENGTH)}</span>
          )}
        </p>
        <div
          style={{
            padding: '6px 0',
            fontFamily: T.mono,
            fontSize: T.code,
            lineHeight: 1.6,
            color: T.text,
          }}
        >
          {rows}
        </div>
      </div>
      <figcaption
        style={{
          margin: '6px 0 0',
          fontSize: T.caption,
          lineHeight: 1.5,
          color: T.muted,
        }}
      >
        <span style={{ fontWeight: 600, color: T.text }}>
          {vocabulary.code} {entry?.number ?? ''}
        </span>
        {caption ? <span> — {caption}</span> : null}
        {link && <br />}
        {link && (
          <a
            href={link.href}
            style={{
              fontFamily: T.mono,
              color: T.muted,
              textDecoration: 'none',
              wordBreak: 'break-all',
            }}
          >
            {link.printed}
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export type CodeListProps = {
  style?: CSSProperties;
  className?: string;
};

function repositoryLine(entries: LabelEntry[]): CodeDetail | null {
  for (const entry of entries) {
    const d = codeDetail(entry);
    if (d?.repo && d.sha) return d;
  }
  return null;
}

/**
 * Every code excerpt in the document with its file, page and link — the
 * appendix a printed copy needs, since paper cannot be clicked. Fills in once
 * the pages are scanned, like `<ListOf>`.
 */
export function CodeList({ style, className }: CodeListProps) {
  const entries = useDocLabels('code');
  const vocabulary: LabelVocabulary = useLabelVocabulary();
  const repo = repositoryLine(entries);

  return (
    <div
      {...{ [LIST_OF_ATTR]: 'code' }}
      className={className}
      style={{
        fontFamily: T.body,
        fontSize: T.bodySize,
        color: T.text,
        ...style,
      }}
    >
      {repo?.repo && repo.sha && (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: T.caption,
            color: T.muted,
          }}
        >
          <a
            href={repo.repo}
            style={{
              fontFamily: T.mono,
              color: T.text,
              textDecoration: 'none',
            }}
          >
            {repo.repo.replace(/^https?:\/\//, '')}
          </a>
          <span> · </span>
          <span style={{ fontFamily: T.mono }}>{repo.sha.slice(0, PRINTED_SHA_LENGTH)}</span>
          {repo.at && <span> · {repo.at.slice(0, 10)}</span>}
        </p>
      )}
      {entries.map((entry) => {
        const d = codeDetail(entry);
        return (
          <div
            key={entry.id}
            {...{ [REF_ATTR]: entry.id }}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              padding: '6px 0',
              borderBottom: `1px solid ${T.rule}`,
            }}
          >
            <span style={{ flex: 'none', color: T.muted }}>
              {vocabulary.code} {entry.number}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block' }}>{entry.text}</span>
              {d && (
                <span
                  style={{
                    display: 'block',
                    fontSize: T.caption,
                    color: T.muted,
                  }}
                >
                  <span style={{ fontFamily: T.mono, color: T.text }}>{d.path}</span>{' '}
                  {vocabulary.codeLines.replace('{range}', d.lines)}
                </span>
              )}
              {d?.href && d.printed && (
                <a
                  href={d.href}
                  style={{
                    display: 'block',
                    fontFamily: T.mono,
                    fontSize: T.caption,
                    color: T.muted,
                    textDecoration: 'none',
                    wordBreak: 'break-all',
                  }}
                >
                  {d.printed}
                </a>
              )}
            </span>
            <span {...{ [REF_PAGE_ATTR]: '' }} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {entry.page}
            </span>
          </div>
        );
      })}
    </div>
  );
}
