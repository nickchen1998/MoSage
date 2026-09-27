# Tables, stats, and charts

Reports are mostly evidence. This file covers the three shapes evidence takes on a page.

## Tables

```tsx
const Th = ({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) => (
  <th
    style={{
      textAlign: align,
      fontFamily: 'var(--od-font-heading)',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--od-muted)',
      borderBottom: '1px solid var(--od-rule)',
      padding: '0 8px 6px',
    }}
  >
    {children}
  </th>
);

const Td = ({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) => (
  <td
    style={{
      textAlign: align,
      fontSize: 12,
      padding: '7px 8px',
      borderBottom: '1px solid var(--od-rule)',
      fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined,
    }}
  >
    {children}
  </td>
);

<table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
  <thead>
    <tr>
      <Th>Service</Th>
      <Th align="right">Requests</Th>
      <Th align="right">p99</Th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <Td>checkout-api</Td>
      <Td align="right">18,402,111</Td>
      <Td align="right">412 ms</Td>
    </tr>
  </tbody>
</table>
```

Rules:

- `borderCollapse: 'collapse'` + `tableLayout: 'fixed'`, always. Auto layout produces columns that shift when the copy changes.
- Numbers right-aligned with `fontVariantNumeric: 'tabular-nums'`. Text left-aligned. Never center either.
- Horizontal rules only. Vertical borders and zebra striping both add noise that print exaggerates.
- Cell font 11–12px, row padding 6–8px → a row costs ~26–30px. Budget accordingly (`references/pagination.md`).
- Portrait A4 tops out around **7 columns**; past that, either drop columns or transpose the table.
- One unit per column, declared in the header (`p99 (ms)`), not repeated in every cell.
- A caption goes **below** the table at `--od-size-caption`, muted, and must stay on the same page as the table.

### Long tables

Split by row groups across pages. Repeat the full header row and mark the continuation in the caption ("Table 3 (continued)"). Never let a header land on one page and its rows on the next.

## Stat rows

A row of 3–4 headline numbers under a section title. Define one component, instantiate it per stat — do **not** `map` over a data array (an explicit instance per stat keeps each number editable on its own):

```tsx
const Stat = ({ value, label, note }: { value: string; label: string; note?: string }) => (
  <div style={{ flex: 1 }}>
    <div style={{ fontFamily: 'var(--od-font-heading)', fontSize: 30, fontWeight: 650, lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
    {note && <div style={{ fontSize: 10, color: 'var(--od-muted)', marginTop: 2 }}>{note}</div>}
  </div>
);

<div style={{ display: 'flex', gap: 24, borderTop: '1px solid var(--od-rule)', paddingTop: 14 }}>
  <Stat value="99.94%" label="Availability" note="target 99.9%" />
  <Stat value="412 ms" label="p99 latency" note="−18% QoQ" />
  <Stat value="$41.2k" label="Monthly spend" note="+6% QoQ" />
</div>
```

Every stat needs a comparison (target, prior period) — a number with nothing to compare against tells the reader nothing.

## Charts

Use **`<Chart>`** for a bar, line, or pie chart of numbers. It draws plain SVG in
the document's own ink and accent, in one render, so the page it lands on is
decided with it at full size; it prints sharp in the PDF and goes into Word as a
picture. Give it a caption and it numbers as a figure, like `<Diagram>`.

```tsx
import { Chart } from 'mosage';
import sales from './assets/references/sales.csv';

<Chart type="bar" data={sales} x="月份" y="營收" unit=" 萬元" caption="每月營收" />
<Chart type="bar" data={sales} x="月份" y={['營收', '成本']} caption="營收與成本" />
<Chart type="bar" data={sales} x="月份" y={['成本', '毛利']} stacked caption="營收組成" />
<Chart type="line" data={sales} x="月份" y={['營收', '成本']} caption="趨勢" />
<Chart type="bar" horizontal data={channels} x="通路" y="占比" unit="%" caption="各通路占比" />
<Chart type="pie" data={channels} x="通路" y="占比" otherLabel="其他" caption="通路組成" />
```

- `data` is rows — a `.csv` import or objects written inline; `x` names the category column, `y` the number column(s). Numbers written as `"1,200"` are read.
- One series is drawn in `--od-accent`; several take a fixed, colour-blind-safe order (restyle a slot with `--od-chart-1` … `--od-chart-8`). Eight series is the ceiling — past it, fold the rest into one or split the chart.
- Pick the form by the question: compare amounts → `bar` (go `horizontal` for long names or many categories); change over time → `line`; parts of a whole → `stacked` bar, or `pie` for a glance at ≤ 6 parts (more fold into `otherLabel`). Never a pie of two slices — write the number.
- A single series prints its values on the marks; several get a legend instead. `labels` turns values on or off; `unit` or `format` shapes them; `names` renames series in the legend.
- `width` (default 640, the A4 text block) and `height` (default 280) are px, like everything on the page. Axes always include zero — a truncated axis in a report is a credibility problem.
- A column `y` names that the data lacks, or empty data, prints `[? Chart: …]` and fails `mosage check`.
- If the numbers must come from the user, don't fabricate them: leave `<ImagePlaceholder hint="Bar chart: monthly incidents, Jan–Sep, from the ops dashboard" height={180} />` and flag it at hand-off.

For a drawing `<Chart>` does not make — an annotated timeline, a map — write
inline SVG sized in absolute px to the text block (642 at A4's 76px margins),
colour it with `var(--od-*)`, label it directly, and keep it vector.

## Callouts

One box style, used sparingly (at most one or two per page):

```tsx
<div
  style={{
    borderLeft: '3px solid var(--od-accent)',
    background: '#f8fafc',
    padding: '12px 14px',
    borderRadius: 'var(--od-radius)',
    fontSize: 12,
  }}
>
  <strong style={{ display: 'block', marginBottom: 4 }}>Recommendation</strong>
  Move the checkout queue to its own cluster before the November peak.
</div>
```

Reserve callouts for recommendations, risks, and definitions. A page where everything is boxed emphasizes nothing.
