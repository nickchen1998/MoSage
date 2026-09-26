import {
  type DocEntry,
  type DocMeta,
  type DocPage,
  flow,
  useDocPageCount,
  useDocPageNumber,
} from '@open-document/core';
import type { CSSProperties } from 'react';

export const meta: DocMeta = {
  title: 'Flow Report',
  createdAt: '2026-01-01T00:00:00.000Z',
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

const body: CSSProperties = { margin: '0 0 14px', lineHeight: 1.55 };

const Cover: DocPage = () => (
  <div style={sheet}>
    <h1 style={{ fontSize: 44, margin: 0 }}>Flow Report</h1>
    <p style={body}>A fixed cover in front of a paginated body.</p>
  </div>
);

const Footer = () => (
  <div style={{ fontSize: 10, color: '#6b7280' }}>
    Flow Report — page {useDocPageNumber()} of {useDocPageCount()}
  </div>
);

// Enough measured content that the packer has to break it across sheets. The
// count is deliberate: at ~57px per paragraph the body outruns a single A4
// text block (1123 - 2×76 ≈ 971px) several times over.
const paragraphs = Array.from({ length: 40 }, (_, i) => (
  <p key={i} style={body}>
    Flow paragraph {i + 1}. The framework measures this block in the real DOM and decides which
    sheet it lands on, so nothing here is hand-placed.
  </p>
));

const Body = flow(
  <>
    <h2 style={{ fontSize: 20, margin: '0 0 12px' }}>Measured body</h2>
    {paragraphs}
  </>,
  { footer: Footer },
);

export default [Cover, Body] satisfies DocEntry[];
