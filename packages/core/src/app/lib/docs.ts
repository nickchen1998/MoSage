import {
  docCreatedAt as createdAt,
  docIds as ids,
  loadDoc as load,
  docThemes as themes,
} from 'virtual:open-doc/docs';
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
