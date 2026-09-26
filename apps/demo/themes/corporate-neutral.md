---
name: Corporate Neutral
description: Near-white sheet, one blue accent, hairline rules. The safe house style for internal reviews, board memos, and anything a stakeholder prints.
pageSize: A4
mode: light
---

# Corporate Neutral

## When to use

Internal reports, quarterly reviews, board memos, and proposals that go to people who will skim the summary and print the rest. It is deliberately unremarkable: the reader should notice the argument, not the layout.

Don't use it for marketing collateral or anything meant to feel designed — reach for an editorial theme there.

## Palette

| Role   | Value     | Notes                                |
| ------ | --------- | ------------------------------------ |
| bg     | `#ffffff` | sheet background                     |
| text   | `#16181d` | body copy                            |
| muted  | `#6b7280` | captions, footers, secondary cells   |
| accent | `#1d4ed8` | section numbers, callout rule, series |
| rule   | `#e4e7ec` | table borders, hairlines, dot leaders |

Supporting colors (outside the `DesignSystem` shape, declared as plain constants):

- positive `#15803d` · warning `#b45309` · negative `#b91c1c`

Every status color is paired with a word in the cell — the report gets printed in mono somewhere.

## Typography

- Heading font: system sans — weight 600–650.
- Body font: system sans — weight 400.
- Mono font: `ui-monospace, "SF Mono", Menlo, monospace` — IDs, metrics, code only.
- No webfont. The theme has to render identically on a machine that has never opened this repo.
- Type scale (px at 96dpi): title 44 · h1 28 · h2 20 · h3 16 · body 14 · caption 10.

## Page setup

- Page size: A4 portrait (794 × 1123 px).
- Margin: 76 px on all sides (~20 mm).
- Leading: 1.55.
- Running footer: document title left, `page / total` right, hairline above, 40 px from the bottom edge. Omitted on the cover.
- Cover: bottom-aligned. Wordmark top-left, eyebrow, title, one-sentence standfirst, then a three-column metadata strip on a hairline.

## Design const

```tsx
export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#16181d',
    muted: '#6b7280',
    accent: '#1d4ed8',
    rule: '#e4e7ec',
  },
  fonts: {
    heading: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 44, h1: 28, h2: 20, h3: 16, body: 14, caption: 10 },
  margin: 76,
  leading: 1.55,
  radius: 6,
};
```

## Fixed components

### Page shell + headings

```tsx
const page: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 'var(--od-margin)',
  background: 'var(--od-bg)',
  color: 'var(--od-text)',
  fontFamily: 'var(--od-font-body)',
  fontSize: 'var(--od-size-body)',
  lineHeight: 'var(--od-leading)',
  position: 'relative',
};

const h1: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h1)',
  lineHeight: 1.2,
  fontWeight: 650,
  letterSpacing: '-0.015em',
  margin: '0 0 18px',
};

const h2: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h2)',
  lineHeight: 1.25,
  fontWeight: 600,
  margin: '26px 0 10px',
};
```

### Running footer

```tsx
const Footer = ({ label }: { label: string }) => {
  const n = useDocPageNumber();
  const total = useDocPageCount();
  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 40,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 'var(--od-size-caption)',
        color: 'var(--od-muted)',
        borderTop: '1px solid var(--od-rule)',
        paddingTop: 8,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {n} / {total}
      </span>
    </div>
  );
};
```

### Table

```tsx
const Th = ({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) => (
  <th
    style={{
      textAlign: align,
      fontFamily: 'var(--od-font-heading)',
      fontSize: 11,
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
```

### Callout

```tsx
const Callout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div
    style={{
      borderLeft: '3px solid var(--od-accent)',
      background: '#f6f8fc',
      padding: '12px 14px',
      borderRadius: 'var(--od-radius)',
      fontSize: 12,
      lineHeight: 1.5,
    }}
  >
    <strong style={{ display: 'block', marginBottom: 4 }}>{title}</strong>
    {children}
  </div>
);
```

## Rules

- Sections are numbered (`1.`, `1.1`). Front matter (summary, method) and appendices are not.
- Horizontal table rules only — no vertical borders, no zebra striping.
- One callout per page at most, reserved for recommendations, risks, and assumptions.
- Figures and tables get a numbered caption below (`Table 2 — …`), muted, on the same page as the object.
- The cover is the only page without a running footer.
- No decorative imagery. Charts are inline SVG in the accent color; a second series uses the muted grey, not a second hue.
