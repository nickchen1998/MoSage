export type DesignPalette = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  rule: string;
};

export type DesignFonts = {
  heading: string;
  body: string;
  mono: string;
};

export type DesignTypeScale = {
  title: number;
  h1: number;
  h2: number;
  h3: number;
  body: number;
  caption: number;
};

export type DesignSystem = {
  palette: DesignPalette;
  fonts: DesignFonts;
  typeScale: DesignTypeScale;
  /** Page margin in CSS px — the printable text block's inset from the sheet edge. */
  margin: number;
  /** Body line-height multiplier. Headings tighten this themselves. */
  leading: number;
  radius: number;
};

export function designToCssVars(d: DesignSystem): Record<string, string> {
  return {
    '--od-bg': d.palette.bg,
    '--od-text': d.palette.text,
    '--od-muted': d.palette.muted,
    '--od-accent': d.palette.accent,
    '--od-rule': d.palette.rule,
    '--od-font-heading': d.fonts.heading,
    '--od-font-body': d.fonts.body,
    '--od-font-mono': d.fonts.mono,
    '--od-size-title': `${d.typeScale.title}px`,
    '--od-size-h1': `${d.typeScale.h1}px`,
    '--od-size-h2': `${d.typeScale.h2}px`,
    '--od-size-h3': `${d.typeScale.h3}px`,
    '--od-size-body': `${d.typeScale.body}px`,
    '--od-size-caption': `${d.typeScale.caption}px`,
    '--od-margin': `${d.margin}px`,
    '--od-leading': String(d.leading),
    '--od-radius': `${d.radius}px`,
  };
}

export function cssVarsToString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
}

export const defaultDesign: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#16181d',
    muted: '#6b7280',
    accent: '#2563eb',
    rule: '#e5e7eb',
  },
  fonts: {
    heading: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  },
  // px at 96dpi — 1pt ≈ 1.333px, so body 14px reads as ~10.5pt on paper.
  typeScale: {
    title: 44,
    h1: 28,
    h2: 20,
    h3: 16,
    body: 14,
    caption: 10,
  },
  margin: 76,
  leading: 1.55,
  radius: 6,
};
