import { createElement, Fragment, type ReactNode, useSyncExternalStore } from 'react';
import { ZH_TW } from './i18n-zh-tw';

/**
 * The viewer's own words, in English or Traditional Chinese. Only the chrome
 * is translated — a document's text, and what the framework prints on its
 * pages (captions, citations, a chart's labels), is the author's.
 *
 * The English string is the key, so a call site reads as what it shows, and a
 * string with no translation yet still says something.
 */

export type Locale = 'en' | 'zh-TW';
export type LanguageChoice = 'auto' | Locale;

export const LANGUAGE_CHOICES: Array<{ value: LanguageChoice; label: string }> = [
  { value: 'auto', label: msg('Same as the browser') },
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
];

const STORAGE_KEY = 'mosage:ui-language';

function isChoice(value: unknown): value is LanguageChoice {
  return value === 'auto' || value === 'en' || value === 'zh-TW';
}

function readLanguage(): LanguageChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isChoice(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

/** `auto` follows the browser's first language, so a second language listed "just in case" does not take over. */
export function resolveLocale(choice: LanguageChoice, languages: readonly string[]): Locale {
  if (choice !== 'auto') return choice;
  return /^zh\b/i.test(languages[0] ?? '') ? 'zh-TW' : 'en';
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages ?? [navigator.language];
}

const inBrowser = typeof window !== 'undefined';
let choice: LanguageChoice = inBrowser ? readLanguage() : 'en';
let locale: Locale = resolveLocale(choice, browserLanguages());
const listeners = new Set<() => void>();

// `<html lang>` stays as it is: pages set no language of their own, so it picks
// the CJK glyphs a sheet is measured with, and the chrome's language must not
// move a page break.
function apply(next: LanguageChoice): void {
  choice = next;
  locale = resolveLocale(next, browserLanguages());
  for (const listener of listeners) listener();
}

export function setLanguage(next: LanguageChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private windows can refuse storage; the change still applies to this tab.
  }
  apply(next);
}

if (inBrowser) {
  const sync = () => apply(readLanguage());
  window.addEventListener('storage', sync);
  window.addEventListener('languagechange', sync);
}

export type Vars = Record<string, string | number>;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

function lookup(target: Locale, key: string): string {
  return target === 'zh-TW' ? (ZH_TW[key] ?? key) : key;
}

/**
 * Marks a string in a constant — a list of options — as one to translate. The
 * translation happens where it is shown, with `t(option.label)`; the marker is
 * what lets the dictionary test find it.
 */
export function msg(key: string): string {
  return key;
}

/** A translation whose placeholders are elements — `{file}` as a `<code>`. */
function richFill(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in nodes ? createElement(Fragment, { key: i }, nodes[name]) : part;
  });
}

export type Translate = (key: string, vars?: Vars) => string;
export type Translator = Translate & {
  rich: (key: string, nodes: Record<string, ReactNode>) => ReactNode[];
};

function translator(target: Locale): Translator {
  const fn = ((key: string, vars?: Vars) => fill(lookup(target, key), vars)) as Translator;
  fn.rich = (key, nodes) => richFill(lookup(target, key), nodes);
  return fn;
}

// One per locale, so a component can list `t` in a hook's dependencies.
const TRANSLATORS: Record<Locale, Translator> = {
  en: translator('en'),
  'zh-TW': translator('zh-TW'),
};

export const english: Translator = TRANSLATORS.en;
export const chinese: Translator = TRANSLATORS['zh-TW'];

/** For what runs outside a render — a confirm dialog, an error set from a callback. */
export function t(key: string, vars?: Vars): string {
  return TRANSLATORS[locale](key, vars);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The setting as chosen, `auto` included — for the control that changes it. */
export function useLanguage(): LanguageChoice {
  return useSyncExternalStore(
    subscribe,
    () => choice,
    () => 'en' as LanguageChoice,
  );
}

/** `t` for a component: it re-renders when the language changes. */
export function useT(): Translator {
  const current = useSyncExternalStore(
    subscribe,
    () => locale,
    () => 'en' as Locale,
  );
  return TRANSLATORS[current];
}
