import { createElement, type ReactNode } from 'react';
import { FlowPage } from '../components/flow-page';
import { type DocEntry, isFlowSection } from './flow';
import { english, type Translate } from './i18n';
import type { DocModule } from './sdk';

/**
 * Page 1 of a document without running the flow measurement — a thumbnail only
 * needs what fits above the fold, and the page shell clips the rest.
 */
export function coverContent(doc: DocModule | null | undefined): ReactNode {
  const entry = (doc?.default as DocEntry[] | undefined)?.[0];
  if (!entry) return null;
  if (!isFlowSection(entry)) return createElement(entry);
  return createElement(FlowPage, {
    section: entry,
    design: doc?.design,
    blockIndices: entry.blocks.map((_, index) => index),
  });
}

/** "9 pages" for fixed docs; flow docs read "3 sections" until they are opened. */
export function pageCountLabel(doc: DocModule | null | undefined, t: Translate = english): string {
  const entries = (doc?.default as DocEntry[] | undefined) ?? [];
  const flowCount = entries.filter(isFlowSection).length;
  if (flowCount === 0) {
    return entries.length === 1 ? t('1 page') : t('{count} pages', { count: entries.length });
  }
  const fixed = entries.length - flowCount;
  return fixed > 0 ? t('{count} + flow', { count: fixed }) : t('flow');
}
