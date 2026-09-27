/**
 * The arithmetic behind `<Chart>`: reading values out of rows, choosing axis
 * ticks, estimating label widths. No DOM — a chart is drawn in one synchronous
 * render so the flow packer measures it at its final size.
 */

export type Row = Record<string, unknown>;

/**
 * Categorical colours, in the order that keeps neighbours apart for colour-blind
 * readers — the order is the safety, so series take slots in sequence and never
 * skip. Validated against white paper; three are light, so charts label their
 * marks rather than rely on colour. A document can restyle a slot through
 * `--od-chart-1` … `--od-chart-8`.
 */
export const CHART_PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
] as const;

export const MAX_SERIES = CHART_PALETTE.length;
/** Past this many slices a pie stops reading as parts of a whole; the rest fold into one. */
export const MAX_SLICES = 6;

/** Series `index` of `count`. A lone series is the document's own accent. */
export function seriesColor(index: number, count: number): string {
  if (count === 1) return 'var(--od-accent, #2563eb)';
  return `var(--od-chart-${index + 1}, ${CHART_PALETTE[index % CHART_PALETTE.length]})`;
}

/** A cell as a number: CSV imports already give numbers; `1,200` and ` 3.5 ` are read too. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/[,\s]/g, '');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function toLabel(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Axis ticks on round numbers — steps of 1, 2, 2.5, or 5 times a power of ten — spanning the data and zero. */
export function niceTicks(
  min: number,
  max: number,
  target = 5,
): { ticks: number[]; min: number; max: number } {
  let lo = Math.min(min, 0);
  let hi = Math.max(max, 0);
  if (lo === hi) hi = lo + 1;
  const raw = (hi - lo) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { ticks, min: lo, max: hi };
}

/** `12345.6` → `12,345.6`: grouped, at most two decimals, with the unit when there is one. */
export function formatValue(value: number, unit = ''): string {
  const text = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return unit ? `${text}${unit}` : text;
}

const WIDE = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

/**
 * How wide a label sets, estimated rather than measured: a measurement would
 * wait on fonts, and a chart whose size changes after the packer placed it
 * lands on the wrong page. CJK is square; Latin and digits run about 0.6em.
 */
export function textWidth(text: string, fontSize: number): number {
  let ems = 0;
  for (const ch of text) ems += WIDE.test(ch) ? 1 : 0.6;
  return ems * fontSize;
}

export type Slice = { label: string; value: number; folded?: boolean };

/** Keeps the largest slices and folds the rest into one, so a pie never needs a seventh colour. */
export function foldSlices(slices: Slice[], otherLabel: string, max = MAX_SLICES): Slice[] {
  const positive = slices.filter((s) => s.value > 0);
  if (positive.length <= max) return positive;
  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const kept = new Set(sorted.slice(0, max - 1));
  const rest = positive.filter((s) => !kept.has(s));
  return [
    ...positive.filter((s) => kept.has(s)),
    { label: otherLabel, value: rest.reduce((sum, s) => sum + s.value, 0), folded: true },
  ];
}

/** A path for a bar whose end away from the baseline is rounded; the baseline end stays square. */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  roundAt: 'top' | 'bottom' | 'right' | 'left',
  radius = 4,
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x2 = x + width;
  const y2 = y + height;
  const f = (n: number) => Number(n.toFixed(2));
  switch (roundAt) {
    case 'top':
      return `M${f(x)},${f(y2)}V${f(y + r)}Q${f(x)},${f(y)} ${f(x + r)},${f(y)}H${f(x2 - r)}Q${f(x2)},${f(y)} ${f(x2)},${f(y + r)}V${f(y2)}Z`;
    case 'bottom':
      return `M${f(x)},${f(y)}V${f(y2 - r)}Q${f(x)},${f(y2)} ${f(x + r)},${f(y2)}H${f(x2 - r)}Q${f(x2)},${f(y2)} ${f(x2)},${f(y2 - r)}V${f(y)}Z`;
    case 'right':
      return `M${f(x)},${f(y)}H${f(x2 - r)}Q${f(x2)},${f(y)} ${f(x2)},${f(y + r)}V${f(y2 - r)}Q${f(x2)},${f(y2)} ${f(x2 - r)},${f(y2)}H${f(x)}Z`;
    case 'left':
      return `M${f(x2)},${f(y)}H${f(x + r)}Q${f(x)},${f(y)} ${f(x)},${f(y + r)}V${f(y2 - r)}Q${f(x)},${f(y2)} ${f(x + r)},${f(y2)}H${f(x2)}Z`;
  }
}
