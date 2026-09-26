import { loadThemeDemo as load, themes as raw } from 'virtual:open-doc/themes';
import type { DesignSystem } from './design';
import type { DocPage } from './sdk';

export type ThemeMeta = {
  id: string;
  name: string;
  description: string;
  /** Frontmatter hint — 'A4' | 'Letter' | … or '' when the theme doesn't say. */
  pageSize: string;
  /** Frontmatter hint — 'light' | 'dark' | '' */
  mode: string;
  body: string;
  hasDemo: boolean;
};

export type ThemeDemoModule = {
  default: DocPage[];
  design?: DesignSystem;
};

export const themes: ThemeMeta[] = raw;

export function findTheme(id: string | undefined): ThemeMeta | undefined {
  if (!id) return undefined;
  return themes.find((t) => t.id === id);
}

export async function loadThemeDemo(id: string): Promise<ThemeDemoModule> {
  return load(id);
}
