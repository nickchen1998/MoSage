import { type DesignSystem, defaultDesign } from './design';

const SANS_SYSTEM = '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif';
const SANS_HELV = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF_GEORGIA = 'Georgia, "Times New Roman", serif';
const SERIF_TIMES = '"Times New Roman", Times, serif';
const MONO_SF = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace';

/**
 * Print-safe presets: white or near-white sheets, body type at or above 13px,
 * one accent each. A document that prints is not the place for a dark canvas.
 */
export const designPresets: DesignSystem[] = [
  defaultDesign,
  {
    palette: {
      bg: '#ffffff',
      text: '#111827',
      muted: '#6b7280',
      accent: '#0f766e',
      rule: '#e5e7eb',
    },
    fonts: { heading: SERIF_GEORGIA, body: SANS_SYSTEM, mono: MONO_SF },
    typeScale: { title: 46, h1: 27, h2: 20, h3: 16, body: 14, caption: 10 },
    margin: 84,
    leading: 1.6,
    radius: 4,
  },
  {
    palette: {
      bg: '#fcfbf7',
      text: '#1c1917',
      muted: '#78716c',
      accent: '#9a3412',
      rule: '#e7e2d6',
    },
    fonts: { heading: SERIF_TIMES, body: SERIF_GEORGIA, mono: MONO_SF },
    typeScale: { title: 44, h1: 26, h2: 19, h3: 15, body: 14, caption: 10 },
    margin: 90,
    leading: 1.65,
    radius: 2,
  },
  {
    palette: {
      bg: '#ffffff',
      text: '#0a0a0a',
      muted: '#737373',
      accent: '#dc2626',
      rule: '#e5e5e5',
    },
    fonts: { heading: SANS_HELV, body: SANS_HELV, mono: MONO_SF },
    typeScale: { title: 52, h1: 30, h2: 21, h3: 16, body: 14, caption: 10 },
    margin: 72,
    leading: 1.5,
    radius: 0,
  },
  {
    palette: {
      bg: '#f8fafc',
      text: '#0f172a',
      muted: '#64748b',
      accent: '#1d4ed8',
      rule: '#dbe2ea',
    },
    fonts: { heading: SANS_SYSTEM, body: SANS_SYSTEM, mono: MONO_SF },
    typeScale: { title: 42, h1: 26, h2: 19, h3: 15, body: 13, caption: 10 },
    margin: 76,
    leading: 1.55,
    radius: 8,
  },
  {
    palette: {
      bg: '#ffffff',
      text: '#18181b',
      muted: '#71717a',
      accent: '#7c3aed',
      rule: '#e4e4e7',
    },
    fonts: { heading: SANS_SYSTEM, body: SANS_SYSTEM, mono: MONO_SF },
    typeScale: { title: 48, h1: 28, h2: 20, h3: 16, body: 15, caption: 11 },
    margin: 96,
    leading: 1.62,
    radius: 12,
  },
  {
    palette: {
      bg: '#ffffff',
      text: '#0b1220',
      muted: '#5b6472',
      accent: '#b45309',
      rule: '#e6e8eb',
    },
    fonts: { heading: MONO_SF, body: SANS_SYSTEM, mono: MONO_SF },
    typeScale: { title: 40, h1: 25, h2: 18, h3: 15, body: 13, caption: 10 },
    margin: 70,
    leading: 1.5,
    radius: 3,
  },
];

export function shuffleDesign(current?: DesignSystem | null): DesignSystem {
  if (designPresets.length <= 1) return defaultDesign;
  const currentJson = current ? JSON.stringify(current) : null;
  for (let i = 0; i < 8; i++) {
    const pick = designPresets[Math.floor(Math.random() * designPresets.length)];
    if (pick && JSON.stringify(pick) !== currentJson) return pick;
  }
  return designPresets[0] ?? defaultDesign;
}
