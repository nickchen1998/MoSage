import {
  docCreatedAt as createdAt,
  docIds as ids,
  loadDoc as load,
  docThemes as themes,
} from 'virtual:mosage/docs';
import { useEffect, useState } from 'react';
import type { DocModule } from './sdk';

export const docIds: string[] = ids;
export const docCreatedAt: Record<string, number> = createdAt;
export const docThemes: Record<string, string> = themes;

export function docsByTheme(themeId: string): string[] {
  return docIds.filter((id) => docThemes[id] === themeId);
}

export async function loadDoc(id: string): Promise<DocModule> {
  return load(id);
}

export function docChangeIncludes(data: unknown, docId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { docId?: unknown; docIds?: unknown };
  if (payload.docId === docId) return true;
  return Array.isArray(payload.docIds) && payload.docIds.includes(docId);
}

/** Every document's title, filled in as the modules load; the id stands in until then. */
export function useDocTitles(): Record<string, string> {
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    for (const id of docIds) {
      loadDoc(id)
        .then((doc) => {
          if (!cancelled) setTitles((prev) => ({ ...prev, [id]: doc.meta?.title ?? id }));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return titles;
}
