import { type CitationSnapshot, collectCitations, getCitations, setCitations } from './citations';
import { collectLabels, getLabels, type LabelSnapshot, setLabels } from './labels';
import { collectOutline, getOutline, type OutlineEntry, setOutline } from './outline';
import type { DocMeta } from './sdk';

export type ScanSnapshot = {
  outline: OutlineEntry[];
  labels: LabelSnapshot;
  citations: CitationSnapshot;
};

/**
 * Reads everything the rendered pages know that the source does not: which
 * headings exist and where they landed, what number each figure, table, and
 * footnote ended up with, and which bibliography the citations resolve against. One call, because the two scans must always describe
 * the same copy of the document — the viewer's pages, or an exporter's private
 * one.
 */
export function scanDocument(root: ParentNode, meta?: DocMeta): void {
  setOutline(collectOutline(root));
  setLabels(collectLabels(root), meta?.labels);
  setCitations(collectCitations(root));
}

export function captureScan(): ScanSnapshot {
  return { outline: getOutline(), labels: getLabels(), citations: getCitations() };
}

export function restoreScan(snapshot: ScanSnapshot): void {
  setOutline(snapshot.outline);
  setLabels(snapshot.labels.entries, snapshot.labels.vocabulary);
  setCitations(snapshot.citations);
}
