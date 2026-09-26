import {
  type DesignSystem,
  type DocPage,
  useDocPageCount,
  useDocPageNumber,
} from '@open-document/core';
import type { CSSProperties, ReactNode } from 'react';

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

const Cover: DocPage = () => (
  <div style={{ ...page, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
    <p
      style={{
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--od-accent)',
        margin: '0 0 16px',
      }}
    >
      Corporate Neutral
    </p>
    <h1 style={{ ...h1, fontSize: 'var(--od-size-title)', margin: '0 0 14px', maxWidth: 520 }}>
      A house style that gets out of the way
    </h1>
    <p style={{ margin: 0, color: 'var(--od-muted)', maxWidth: 460 }}>
      Near-white sheet, one blue accent, hairline rules, 20 mm margins. Built for documents people
      print and mark up.
    </p>
    <div
      style={{
        display: 'flex',
        gap: 48,
        marginTop: 40,
        borderTop: '1px solid var(--od-rule)',
        paddingTop: 14,
        fontSize: 11,
        color: 'var(--od-muted)',
      }}
    >
      <div>
        <div style={{ color: 'var(--od-text)', fontWeight: 600 }}>Page</div>A4 portrait
      </div>
      <div>
        <div style={{ color: 'var(--od-text)', fontWeight: 600 }}>Margin</div>76 px
      </div>
      <div>
        <div style={{ color: 'var(--od-text)', fontWeight: 600 }}>Body</div>14 px / 1.55
      </div>
    </div>
  </div>
);

const Content: DocPage = () => (
  <div style={page}>
    <h1 style={h1}>1. How a content page reads</h1>
    <p style={{ margin: '0 0 14px' }}>
      Body copy sits at 14 px with 1.55 leading — about 92 characters per line inside the 642 px
      text block, which is the width research says people read most comfortably. Paragraphs run two
      to five sentences, and each one carries a single idea.
    </p>

    <h2 style={h2}>1.1 Tables</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <Th>Element</Th>
          <Th>Token</Th>
          <Th align="right">Size</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Td>Section title</Td>
          <Td>--od-size-h1</Td>
          <Td align="right">28 px</Td>
        </tr>
        <tr>
          <Td>Subsection</Td>
          <Td>--od-size-h2</Td>
          <Td align="right">20 px</Td>
        </tr>
        <tr>
          <Td>Body</Td>
          <Td>--od-size-body</Td>
          <Td align="right">14 px</Td>
        </tr>
        <tr>
          <Td>Caption</Td>
          <Td>--od-size-caption</Td>
          <Td align="right">10 px</Td>
        </tr>
      </tbody>
    </table>
    <p style={{ fontSize: 'var(--od-size-caption)', color: 'var(--od-muted)', margin: '8px 0 0' }}>
      Table 1 — The type scale, as it appears on the page.
    </p>

    <div
      style={{
        marginTop: 20,
        borderLeft: '3px solid var(--od-accent)',
        background: '#f6f8fc',
        padding: '12px 14px',
        borderRadius: 'var(--od-radius)',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>Recommendation</strong>
      One callout per page, reserved for recommendations, risks, and assumptions. A page where
      everything is boxed emphasizes nothing.
    </div>

    <Footer label="Corporate Neutral · theme demo" />
  </div>
);

export default [Cover, Content] satisfies DocPage[];
