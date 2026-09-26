import type { DocMeta, DocPage } from '@open-document/core';
import type { CSSProperties } from 'react';

export const meta: DocMeta = {
  title: 'Hot Swap',
  createdAt: '2025-12-31T00:00:00.000Z',
};

const sheet: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 76,
  background: '#ffffff',
  color: '#16181d',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
};

const Only: DocPage = () => (
  <div style={sheet}>
    <h1 style={{ fontSize: 28, margin: 0 }}>Hot swap before</h1>
  </div>
);

export default [Only] satisfies DocPage[];
