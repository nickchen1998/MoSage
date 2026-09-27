import { useEffect, useState } from 'react';
import { msg } from './i18n';

/**
 * How large the app's own text is, as a multiple of the browser default. Only
 * the chrome is sized in rem, so this never touches a sheet: pages are laid out
 * in px, and print resets the root size (styles.css) before a PDF is made.
 */
export const UI_SCALES = [
  { value: 0.9, label: msg('Compact') },
  { value: 1, label: msg('Default') },
  { value: 1.1, label: msg('Large') },
  { value: 1.25, label: msg('Larger') },
  { value: 1.5, label: msg('Largest') },
] as const;

export const DEFAULT_UI_SCALE = 1.1;

const STORAGE_KEY = 'mosage:ui-scale';
const EVENT = 'mosage:ui-scale';

function isScale(value: number): boolean {
  return UI_SCALES.some((option) => option.value === value);
}

export function readUiScale(): number {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return isScale(stored) ? stored : DEFAULT_UI_SCALE;
  } catch {
    return DEFAULT_UI_SCALE;
  }
}

export function applyUiScale(scale: number): void {
  document.documentElement.style.setProperty('--ui-scale', String(scale));
}

export function setUiScale(scale: number): void {
  if (!isScale(scale)) return;
  try {
    localStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    // Private windows can refuse storage; the change still applies to this tab.
  }
  applyUiScale(scale);
  window.dispatchEvent(new Event(EVENT));
}

/** The current scale, following changes from the settings page and from other tabs. */
export function useUiScale(): number {
  const [scale, setScale] = useState(readUiScale);
  useEffect(() => {
    const sync = () => {
      const next = readUiScale();
      applyUiScale(next);
      setScale(next);
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return scale;
}
