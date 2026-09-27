import type { CSSProperties, ReactNode } from 'react';
import {
  barPath,
  foldSlices,
  formatValue,
  MAX_SERIES,
  niceTicks,
  type Row,
  type Slice,
  seriesColor,
  textWidth,
  toLabel,
  toNumber,
} from '../lib/chart';
import type { LabelKind } from '../lib/labels';
import { Figure } from './numbering';

export const CHART_ATTR = 'data-od-chart';
export const CHART_ERROR_ATTR = 'data-od-chart-error';

export type ChartType = 'bar' | 'line' | 'pie';

export type ChartProps = {
  type: ChartType;
  /** One object per category — a CSV import, or rows written inline. */
  data: Row[];
  /** The column that names each category: the x axis, or each slice of a pie. */
  x: string;
  /** The column(s) holding the numbers. Several make several series; a pie takes one. */
  y: string | string[];
  /** What the legend calls a series, when its column name is not what a reader should see. */
  names?: Record<string, string>;
  /** Bars run sideways — for long category names or many categories. */
  horizontal?: boolean;
  /** Series stack into one bar per category — part-to-whole across categories. */
  stacked?: boolean;
  /** Appended to every value: `%`, ` 萬元`. */
  unit?: string;
  format?: (value: number) => string;
  /** Values printed on the marks. On by default for a single series. */
  labels?: boolean;
  /** Drawn width in CSS px; the chart shrinks to a narrower column. Default 640. */
  width?: number;
  /** Drawn height in CSS px. */
  height?: number;
  /** The slice that collects a pie's smallest parts once there are more than six. */
  otherLabel?: string;
  /** Caption text. Given one, the chart is numbered like any other figure. */
  caption?: ReactNode;
  captionText?: string;
  kind?: LabelKind;
  id?: string;
  /** What a screen reader and the PDF's tags announce. Defaults to a summary of the data. */
  title?: string;
  style?: CSSProperties;
  className?: string;
};

const FONT = 12;
const LINE = 18;
const GAP = 2;
const BAR_MAX = 24;
const INK = 'var(--od-text, #16181d)';
const MUTED = 'var(--od-muted, #6b7280)';
const GRID = 'var(--od-rule, #e5e7eb)';
const BASELINE = 'color-mix(in srgb, var(--od-text, #16181d) 35%, transparent)';
const SURFACE = 'var(--od-bg, #ffffff)';
const FOLDED = 'color-mix(in srgb, var(--od-muted, #6b7280) 55%, var(--od-bg, #ffffff))';
const FAMILY = 'var(--od-font-body, system-ui, sans-serif)';

const textProps = {
  fontFamily: FAMILY,
  fontSize: FONT,
  style: { fontVariantNumeric: 'tabular-nums' } as CSSProperties,
};

/** Keys for the parts of a drawing, which never reorder: a part's place is its identity. */
function keyer(): () => string {
  let n = 0;
  return () => `m${n++}`;
}

type Series = { key: string; name: string; color: string; values: Array<number | null> };

type Plan = {
  categories: string[];
  series: Series[];
  fmt: (value: number) => string;
  width: number;
  height: number;
  labels: boolean;
};

type Legend = { height: number; node: ReactNode };

function legendFor(items: Array<{ name: string; color: string }>, width: number): Legend {
  const key = keyer();
  const rows: Array<Array<{ name: string; color: string; x: number }>> = [[]];
  let x = 0;
  for (const item of items) {
    const w = 10 + 6 + textWidth(item.name, FONT) + 16;
    if (x > 0 && x + w > width) {
      rows.push([]);
      x = 0;
    }
    rows[rows.length - 1]?.push({ ...item, x });
    x += w;
  }
  const node = rows.flatMap((row, r) =>
    row.map((item) => (
      <g key={key()} transform={`translate(${item.x}, ${r * LINE})`}>
        <rect y={3} width={10} height={10} rx={2} fill={item.color} />
        <text x={16} y={12} fill={INK} {...textProps}>
          {item.name}
        </text>
      </g>
    )),
  );
  return { height: rows.length * LINE + 8, node };
}

function tickCount(length: number): number {
  return Math.max(3, Math.min(6, Math.round(length / 56)));
}

function summaryOf(plan: Plan): string {
  const parts = plan.series.map((s) => {
    const values = plan.categories
      .slice(0, 24)
      .map((c, i) => `${c} ${s.values[i] === null ? '—' : plan.fmt(s.values[i] as number)}`)
      .join(', ');
    return plan.series.length > 1 ? `${s.name}: ${values}` : values;
  });
  return parts.join('; ');
}

/** Stack extents per category: positives climb from zero, negatives fall from it. */
function stackRange(series: Series[], index: number): { pos: number; neg: number } {
  let pos = 0;
  let neg = 0;
  for (const s of series) {
    const v = s.values[index] ?? 0;
    if (v >= 0) pos += v;
    else neg += v;
  }
  return { pos, neg };
}

function extent(plan: Plan, stacked: boolean): { min: number; max: number } {
  let min = 0;
  let max = 0;
  plan.categories.forEach((_, i) => {
    if (stacked) {
      const { pos, neg } = stackRange(plan.series, i);
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    } else {
      for (const s of plan.series) {
        const v = s.values[i];
        if (v === null) continue;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
    }
  });
  return { min, max };
}

function ColumnChart({ plan, stacked }: { plan: Plan; stacked: boolean }) {
  const key = keyer();
  const { categories, series, fmt, width, height } = plan;
  const legend = series.length > 1 ? legendFor(series, width) : null;
  const { min, max } = extent(plan, stacked);

  const labelWidths = categories.map((c) => textWidth(c, FONT));
  const top = (legend?.height ?? 0) + (plan.labels ? 18 : 8);
  const provisional = niceTicks(min, max, 5);
  const left = Math.max(...provisional.ticks.map((t) => textWidth(fmt(t), FONT))) + 10;
  const plotW = width - left - 8;
  const band = plotW / Math.max(1, categories.length);
  const rotate = Math.max(0, ...labelWidths) > band - 6;
  const bottom = rotate ? Math.max(...labelWidths) * 0.64 + FONT + 10 : FONT + 12;
  const plotH = Math.max(40, height - top - bottom);
  const axis = niceTicks(min, max, tickCount(plotH));
  const y = (v: number) => top + ((axis.max - v) / (axis.max - axis.min || 1)) * plotH;

  const k = stacked ? 1 : series.length;
  const group = Math.min(band * 0.72, k * BAR_MAX + (k - 1) * GAP);
  const barW = (group - (k - 1) * GAP) / k;

  const marks: ReactNode[] = [];
  const values: ReactNode[] = [];
  categories.forEach((_, i) => {
    const center = left + band * (i + 0.5);
    if (stacked) {
      let pos = 0;
      let neg = 0;
      const { pos: posTotal, neg: negTotal } = stackRange(series, i);
      series.forEach((s) => {
        const v = s.values[i];
        if (!v) return;
        const from = v > 0 ? pos : neg;
        const to = from + v;
        if (v > 0) pos = to;
        else neg = to;
        const outermost = v > 0 ? to === posTotal : to === negTotal;
        const yTop = y(Math.max(from, to));
        const yBottom = y(Math.min(from, to));
        // The gap between segments is taken from each segment's outer end.
        const h = Math.max(0, yBottom - yTop - (outermost ? 0 : GAP));
        const yStart = v > 0 ? yBottom - h : yTop;
        marks.push(
          <path
            key={key()}
            d={
              outermost
                ? barPath(center - barW / 2, yStart, barW, h, v > 0 ? 'top' : 'bottom')
                : `M${center - barW / 2},${yStart}h${barW}v${h}h${-barW}Z`
            }
            fill={s.color}
          />,
        );
      });
      if (plan.labels && posTotal > 0) {
        values.push(
          <text
            key={key()}
            x={center}
            y={y(posTotal) - 6}
            textAnchor="middle"
            fill={INK}
            {...textProps}
          >
            {fmt(posTotal)}
          </text>,
        );
      }
      return;
    }
    series.forEach((s, j) => {
      const v = s.values[i];
      if (v === null || v === undefined) return;
      const x0 = center - group / 2 + j * (barW + GAP);
      const y0 = y(Math.max(v, 0));
      const h = Math.abs(y(v) - y(0));
      marks.push(
        <path key={key()} d={barPath(x0, y0, barW, h, v >= 0 ? 'top' : 'bottom')} fill={s.color} />,
      );
      if (plan.labels) {
        values.push(
          <text
            key={key()}
            x={x0 + barW / 2}
            y={v >= 0 ? y(v) - 6 : y(v) + FONT + 4}
            textAnchor="middle"
            fill={INK}
            {...textProps}
          >
            {fmt(v)}
          </text>,
        );
      }
    });
  });

  return (
    <>
      {legend && <g>{legend.node}</g>}
      {axis.ticks.map((t) => (
        <g key={key()}>
          <line
            x1={left}
            x2={width - 8}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? BASELINE : GRID}
            strokeWidth={1}
          />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fill={MUTED} {...textProps}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {marks}
      {values}
      {categories.map((c, i) => {
        const cx = left + band * (i + 0.5);
        const cy = top + plotH + FONT + 6;
        return rotate ? (
          <text
            key={key()}
            x={cx}
            y={cy - 4}
            textAnchor="end"
            transform={`rotate(-40 ${cx} ${cy - 4})`}
            fill={INK}
            {...textProps}
          >
            {c}
          </text>
        ) : (
          <text key={key()} x={cx} y={cy} textAnchor="middle" fill={INK} {...textProps}>
            {c}
          </text>
        );
      })}
    </>
  );
}

function barRowHeight(k: number, stacked: boolean): number {
  const bars = stacked ? 1 : k;
  return Math.max(28, bars * 16 + (bars - 1) * GAP + 12);
}

function autoHorizontalHeight(plan: Plan, stacked: boolean): number {
  const legend = plan.series.length > 1 ? legendFor(plan.series, plan.width).height : 0;
  return legend + plan.categories.length * barRowHeight(plan.series.length, stacked) + FONT + 22;
}

function BarChart({ plan, stacked }: { plan: Plan; stacked: boolean }) {
  const key = keyer();
  const { categories, series, fmt, width, height } = plan;
  const legend = series.length > 1 ? legendFor(series, width) : null;
  const { min, max } = extent(plan, stacked);

  const top = (legend?.height ?? 0) + 4;
  const labelCap = width * 0.36;
  const left = Math.min(labelCap, Math.max(...categories.map((c) => textWidth(c, FONT)))) + 12;
  const provisional = niceTicks(min, max, 5);
  const valueRoom = plan.labels
    ? Math.max(...provisional.ticks.map((t) => textWidth(fmt(t), FONT))) + 10
    : 12;
  const bottom = FONT + 14;
  const plotW = Math.max(60, width - left - valueRoom);
  const plotH = Math.max(40, height - top - bottom);
  const axis = niceTicks(min, max, tickCount(plotW));
  const x = (v: number) => left + ((v - axis.min) / (axis.max - axis.min || 1)) * plotW;
  const band = plotH / Math.max(1, categories.length);

  const k = stacked ? 1 : series.length;
  const group = Math.min(band * 0.72, k * BAR_MAX + (k - 1) * GAP);
  const barH = (group - (k - 1) * GAP) / k;

  const marks: ReactNode[] = [];
  const values: ReactNode[] = [];
  categories.forEach((_, i) => {
    const center = top + band * (i + 0.5);
    if (stacked) {
      let pos = 0;
      let neg = 0;
      const { pos: posTotal, neg: negTotal } = stackRange(series, i);
      series.forEach((s) => {
        const v = s.values[i];
        if (!v) return;
        const from = v > 0 ? pos : neg;
        const to = from + v;
        if (v > 0) pos = to;
        else neg = to;
        const outermost = v > 0 ? to === posTotal : to === negTotal;
        const x0 = x(Math.min(from, to));
        const w = Math.max(0, x(Math.max(from, to)) - x0 - (outermost ? 0 : GAP));
        const xStart = v > 0 ? x0 : x0 + (x(Math.max(from, to)) - x0 - w);
        marks.push(
          <path
            key={key()}
            d={
              outermost
                ? barPath(xStart, center - barH / 2, w, barH, v > 0 ? 'right' : 'left')
                : `M${xStart},${center - barH / 2}h${w}v${barH}h${-w}Z`
            }
            fill={s.color}
          />,
        );
      });
      if (plan.labels && posTotal > 0) {
        values.push(
          <text key={key()} x={x(posTotal) + 6} y={center + 4} fill={INK} {...textProps}>
            {fmt(posTotal)}
          </text>,
        );
      }
      return;
    }
    series.forEach((s, j) => {
      const v = s.values[i];
      if (v === null || v === undefined) return;
      const y0 = center - group / 2 + j * (barH + GAP);
      const x0 = x(Math.min(v, 0));
      const w = Math.abs(x(v) - x(0));
      marks.push(
        <path key={key()} d={barPath(x0, y0, w, barH, v >= 0 ? 'right' : 'left')} fill={s.color} />,
      );
      if (plan.labels) {
        values.push(
          <text
            key={key()}
            x={v >= 0 ? x(v) + 6 : x(v) - 6}
            y={y0 + barH / 2 + 4}
            textAnchor={v >= 0 ? 'start' : 'end'}
            fill={INK}
            {...textProps}
          >
            {fmt(v)}
          </text>,
        );
      }
    });
  });

  return (
    <>
      {legend && <g>{legend.node}</g>}
      {axis.ticks.map((t) => (
        <g key={key()}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={top}
            y2={top + plotH}
            stroke={t === 0 ? BASELINE : GRID}
            strokeWidth={1}
          />
          <text x={x(t)} y={top + plotH + FONT + 8} textAnchor="middle" fill={MUTED} {...textProps}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {marks}
      {values}
      {categories.map((c, i) => (
        <text
          key={key()}
          x={left - 10}
          y={top + band * (i + 0.5) + 4}
          textAnchor="end"
          fill={INK}
          {...textProps}
        >
          {c}
        </text>
      ))}
    </>
  );
}

function LineChart({ plan }: { plan: Plan }) {
  const key = keyer();
  const { categories, series, fmt, width, height } = plan;
  const legend = series.length > 1 ? legendFor(series, width) : null;
  const { min, max } = extent(plan, false);
  const n = categories.length;

  const lastValue = (s: Series) => {
    for (let i = n - 1; i >= 0; i--)
      if (s.values[i] !== null) return { i, v: s.values[i] as number };
    return null;
  };
  const top = (legend?.height ?? 0) + 10;
  const provisional = niceTicks(min, max, 5);
  const left = Math.max(...provisional.ticks.map((t) => textWidth(fmt(t), FONT))) + 10;
  const endLabels = plan.labels
    ? series.map((s) => lastValue(s)).map((e) => (e ? fmt(e.v) : ''))
    : [];
  const right = plan.labels ? Math.max(0, ...endLabels.map((t) => textWidth(t, FONT))) + 14 : 10;
  const plotW = width - left - right;
  const band = plotW / Math.max(1, n);
  const labelWidths = categories.map((c) => textWidth(c, FONT));
  const rotate = Math.max(0, ...labelWidths) > band - 6;
  const bottom = rotate ? Math.max(...labelWidths) * 0.64 + FONT + 10 : FONT + 12;
  const plotH = Math.max(40, height - top - bottom);
  const axis = niceTicks(min, max, tickCount(plotH));
  const y = (v: number) => top + ((axis.max - v) / (axis.max - axis.min || 1)) * plotH;
  const xAt = (i: number) => left + band * (i + 0.5);

  const ends = series.map((s) => {
    const last = lastValue(s);
    return last ? { s, x: xAt(last.i), y: y(last.v), text: fmt(last.v) } : null;
  });
  // End labels that would collide say nothing clearly; the legend carries identity then.
  const endYs = ends
    .filter(Boolean)
    .map((e) => (e as { y: number }).y)
    .sort((a, b) => a - b);
  const crowded = endYs.some((v, i) => i > 0 && v - (endYs[i - 1] as number) < FONT + 2);
  const dots = n <= 12;

  return (
    <>
      {legend && <g>{legend.node}</g>}
      {axis.ticks.map((t) => (
        <g key={key()}>
          <line
            x1={left}
            x2={left + plotW}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? BASELINE : GRID}
            strokeWidth={1}
          />
          <text x={left - 8} y={y(t) + 4} textAnchor="end" fill={MUTED} {...textProps}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {series.map((s) => {
        let d = '';
        let pen = false;
        s.values.forEach((v, i) => {
          if (v === null) {
            pen = false;
            return;
          }
          d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(2)},${y(v).toFixed(2)}`;
          pen = true;
        });
        return (
          <path
            key={key()}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {series.map((s, j) =>
        s.values.map((v, i) => {
          if (v === null) return null;
          const isEnd = ends[j]?.x === xAt(i);
          if (!dots && !isEnd) return null;
          return (
            <circle
              key={key()}
              cx={xAt(i)}
              cy={y(v)}
              r={4}
              fill={s.color}
              stroke={SURFACE}
              strokeWidth={2}
            />
          );
        }),
      )}
      {plan.labels &&
        !crowded &&
        ends.map((e) =>
          e ? (
            <text key={key()} x={e.x + 10} y={e.y + 4} fill={INK} {...textProps}>
              {e.text}
            </text>
          ) : null,
        )}
      {categories.map((c, i) => {
        const cx = xAt(i);
        const cy = top + plotH + FONT + 6;
        return rotate ? (
          <text
            key={key()}
            x={cx}
            y={cy - 4}
            textAnchor="end"
            transform={`rotate(-40 ${cx} ${cy - 4})`}
            fill={INK}
            {...textProps}
          >
            {c}
          </text>
        ) : (
          <text key={key()} x={cx} y={cy} textAnchor="middle" fill={INK} {...textProps}>
            {c}
          </text>
        );
      })}
    </>
  );
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const point = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  const large = to - from > Math.PI ? 1 : 0;
  const f = (n: number | undefined) => Number((n ?? 0).toFixed(2));
  return `M${f(cx)},${f(cy)}L${f(x1)},${f(y1)}A${f(r)},${f(r)} 0 ${large} 1 ${f(x2)},${f(y2)}Z`;
}

function PieChart({
  slices,
  fmt,
  values,
  width,
  height,
}: {
  slices: Slice[];
  fmt: (value: number) => string;
  /** Print each slice's value beside its share. */
  values: boolean;
  width: number;
  height: number;
}) {
  const key = keyer();
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const r = Math.max(24, Math.min(height / 2 - 8, width * 0.22));
  const cx = r + 8;
  const cy = height / 2;
  const colored = slices.map((s, i) => ({
    ...s,
    color: s.folded ? FOLDED : seriesColor(i, Math.max(2, slices.length)),
  }));
  let angle = 0;
  const legendTop = cy - (colored.length * (LINE + 4)) / 2 + 4;
  const legendX = cx + r + 28;
  const share = (s: Slice) => `${Math.round((s.value / total) * 100)}%`;
  const valueX =
    16 + Math.max(...colored.map((s) => textWidth(s.label, FONT))) + 16 + textWidth('100%', FONT);

  return (
    <>
      {colored.map((s) => {
        const from = angle;
        const to = angle + (s.value / total) * Math.PI * 2;
        angle = to;
        return colored.length === 1 ? (
          <circle key={key()} cx={cx} cy={cy} r={r} fill={s.color} />
        ) : (
          <path
            key={key()}
            d={arc(cx, cy, r, from, to)}
            fill={s.color}
            stroke={SURFACE}
            strokeWidth={GAP}
            strokeLinejoin="round"
          />
        );
      })}
      {colored.map((s, i) => (
        <g key={key()} transform={`translate(${legendX}, ${legendTop + i * (LINE + 4)})`}>
          <rect y={3} width={10} height={10} rx={2} fill={s.color} />
          <text x={16} y={12} fill={INK} {...textProps}>
            {s.label}
          </text>
          <text x={valueX} y={12} textAnchor="end" fill={INK} {...textProps}>
            {share(s)}
          </text>
          {values && (
            <text x={valueX + 12} y={12} fill={MUTED} {...textProps}>
              {fmt(s.value)}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

function problemWith(props: ChartProps, keys: string[]): string | null {
  if (!Array.isArray(props.data) || props.data.length === 0) return 'data is empty';
  const columns = new Set(props.data.flatMap((row) => Object.keys(row ?? {})));
  if (!columns.has(props.x)) return `no column "${props.x}" for x`;
  const missing = keys.find((key) => !columns.has(key));
  if (missing) return `no column "${missing}" for y`;
  if (keys.length > MAX_SERIES)
    return `${keys.length} series is more than ${MAX_SERIES} colours can tell apart — fold the rest into one, or split the chart`;
  if (props.type === 'pie' && keys.length !== 1) return 'a pie takes exactly one y column';
  return null;
}

/**
 * A bar, line, or pie chart drawn from rows, in the document's own ink and
 * accent. It is plain SVG drawn in one render — no measuring, no loading — so
 * the page it lands on is decided with it already at full size, and it prints
 * crisp in the PDF. Word gets it as a picture, like a `<Diagram>`.
 */
export function Chart(props: ChartProps) {
  const { type, data, x, caption, captionText, kind = 'figure', id, style, className } = props;
  const keys = Array.isArray(props.y) ? props.y : [props.y];
  const width = props.width ?? 640;
  const fmt = props.format ?? ((value: number) => formatValue(value, props.unit));

  const problem = problemWith(props, keys);
  if (problem) {
    // Visible on the page and reported by `mosage check`, like an unresolved `<Ref>`.
    return (
      <p
        {...{ [CHART_ERROR_ATTR]: problem }}
        style={{ margin: '0 0 16px', color: 'var(--od-accent, #2563eb)', fontSize: FONT }}
      >
        [? Chart: {problem}]
      </p>
    );
  }

  const categories = data.map((row) => toLabel(row[x]));
  const series: Series[] = keys.map((key, i) => ({
    key,
    name: props.names?.[key] ?? key,
    color: seriesColor(i, keys.length),
    values: data.map((row) => toNumber(row[key])),
  }));
  const plan: Plan = {
    categories,
    series,
    fmt,
    width,
    height: 0,
    labels: props.labels ?? (keys.length === 1 && categories.length <= 24),
  };
  const stacked = Boolean(props.stacked) && keys.length > 1;
  plan.height =
    props.height ??
    (type === 'pie'
      ? 240
      : type === 'bar' && props.horizontal
        ? autoHorizontalHeight(plan, stacked)
        : 280);

  const slices =
    type === 'pie'
      ? foldSlices(
          categories.map((label, i) => ({ label, value: series[0]?.values[i] ?? 0 })),
          props.otherLabel ?? 'Other',
        )
      : [];
  const label =
    props.title ??
    (type === 'pie' ? slices.map((s) => `${s.label} ${fmt(s.value)}`).join(', ') : summaryOf(plan));

  const drawing = (
    <svg
      {...{ [CHART_ATTR]: type }}
      role="img"
      aria-label={label}
      width={width}
      height={plan.height}
      viewBox={`0 0 ${width} ${plan.height}`}
      className={caption ? undefined : className}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: width,
        height: 'auto',
        margin: '0 auto',
        overflow: 'visible',
        ...(caption ? undefined : style),
      }}
    >
      <title>{label}</title>
      {type === 'pie' ? (
        <PieChart
          slices={slices}
          fmt={fmt}
          values={props.labels === true}
          width={width}
          height={plan.height}
        />
      ) : type === 'line' ? (
        <LineChart plan={plan} />
      ) : props.horizontal ? (
        <BarChart plan={plan} stacked={stacked} />
      ) : (
        <ColumnChart plan={plan} stacked={stacked} />
      )}
    </svg>
  );

  if (!caption) return drawing;
  return (
    <Figure
      {...(id ? { id } : {})}
      caption={caption}
      {...(captionText ? { captionText } : {})}
      kind={kind}
      className={className}
      {...(style ? { style } : {})}
    >
      {drawing}
    </Figure>
  );
}
