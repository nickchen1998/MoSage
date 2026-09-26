import type { DesignSystem, DocPage } from '@open-document/core';
import type { CSSProperties } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#16181d',
    muted: '#6b7280',
    accent: '#2563eb',
    rule: '#e5e7eb',
  },
  fonts: {
    heading: 'system-ui, sans-serif',
    body: 'system-ui, sans-serif',
    mono: 'ui-monospace, Menlo, monospace',
  },
  typeScale: { title: 44, h1: 28, h2: 20, h3: 16, body: 14, caption: 10 },
  margin: 76,
  leading: 1.55,
  radius: 6,
};

const sheet: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 'var(--od-margin)',
  background: 'var(--od-bg)',
  color: 'var(--od-text)',
  fontFamily: 'var(--od-font-body)',
  fontSize: 'var(--od-size-body)',
};

const Cover: DocPage = () => (
  <div style={sheet}>
    <h1 style={{ fontSize: 'var(--od-size-title)', margin: 0 }}>Plain theme demo</h1>
    <p style={{ color: 'var(--od-muted)' }}>One page, no decoration.</p>
  </div>
);

export default [Cover] satisfies DocPage[];
