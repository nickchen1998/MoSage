import buildManifest from 'virtual:open-doc/folders';
import { useCallback, useEffect, useState } from 'react';
import type { Folder, FolderIcon, FoldersManifest } from './sdk';

const EMPTY: FoldersManifest = { folders: [], assignments: {} };

async function getManifest(): Promise<FoldersManifest> {
  // In dev the manifest is mutable, so read it live from the API — the sidebar
  // must reflect edits immediately. A static build has no server, so it falls
  // back to the snapshot the virtual module baked in from docs/.folders.json.
  if (import.meta.env.DEV) {
    const res = await fetch('/__folders');
    if (!res.ok) throw new Error(`GET /__folders ${res.status}`);
    const raw = (await res.json()) as Partial<FoldersManifest>;
    return { folders: raw.folders ?? [], assignments: raw.assignments ?? {} };
  }
  return { folders: buildManifest.folders ?? [], assignments: buildManifest.assignments ?? {} };
}

async function expectOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  let detail = `${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) detail = body.error;
  } catch {}
  throw new Error(`${label}: ${detail}`);
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export type UseFoldersResult = {
  manifest: FoldersManifest;
  loading: boolean;
  create: (name: string, icon: FolderIcon) => Promise<Folder>;
  update: (id: string, patch: { name?: string; icon?: FolderIcon }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
  assign: (docId: string, folderId: string | null) => Promise<void>;
  renameDoc: (docId: string, title: string) => Promise<void>;
  duplicateDoc: (docId: string, newId?: string) => Promise<string>;
  deleteDoc: (docId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useFolders(): UseFoldersResult {
  const [manifest, setManifest] = useState<FoldersManifest>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setManifest(await getManifest());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getManifest()
      .then((m) => {
        if (cancelled) return;
        setManifest(m);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = () => {
      refresh().catch(() => {});
    };
    import.meta.hot.on('open-doc:files-changed', handler);
    return () => {
      import.meta.hot?.off('open-doc:files-changed', handler);
    };
  }, [refresh]);

  const create = useCallback(
    async (name: string, icon: FolderIcon) => {
      const res = await fetch('/__folders', jsonInit('POST', { name, icon }));
      await expectOk(res, 'Create folder failed');
      const folder = (await res.json()) as Folder;
      await refresh();
      return folder;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: { name?: string; icon?: FolderIcon }) => {
      await expectOk(
        await fetch(`/__folders/${id}`, jsonInit('PATCH', patch)),
        'Update folder failed',
      );
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await expectOk(await fetch(`/__folders/${id}`, { method: 'DELETE' }), 'Delete folder failed');
      await refresh();
    },
    [refresh],
  );

  const reorder = useCallback(
    async (ids: string[]) => {
      const prev = manifest;
      const byId = new Map(prev.folders.map((f) => [f.id, f]));
      const next = ids.map((id) => byId.get(id)).filter((f): f is Folder => Boolean(f));
      if (next.length !== prev.folders.length) return;
      setManifest({ ...prev, folders: next });
      try {
        await expectOk(
          await fetch('/__folders/reorder', jsonInit('PUT', { ids })),
          'Reorder failed',
        );
      } catch (err) {
        setManifest(prev);
        throw err;
      }
    },
    [manifest],
  );

  const assign = useCallback(
    async (docId: string, folderId: string | null) => {
      await expectOk(
        await fetch('/__folders/assign', jsonInit('PUT', { docId, folderId })),
        'Move failed',
      );
      await refresh();
    },
    [refresh],
  );

  const renameDoc = useCallback(
    async (docId: string, title: string) => {
      await expectOk(
        await fetch(`/__docs/${docId}`, jsonInit('PATCH', { title })),
        'Rename failed',
      );
      await refresh();
    },
    [refresh],
  );

  const duplicateDoc = useCallback(
    async (docId: string, newId?: string) => {
      const init: RequestInit =
        newId === undefined ? { method: 'POST' } : jsonInit('POST', { newId });
      const res = await fetch(`/__docs/${docId}/duplicate`, init);
      await expectOk(res, 'Duplicate failed');
      const body = (await res.json()) as { docId?: unknown };
      await refresh();
      if (typeof body.docId !== 'string') throw new Error('duplicate response missing docId');
      return body.docId;
    },
    [refresh],
  );

  const deleteDoc = useCallback(
    async (docId: string) => {
      await expectOk(await fetch(`/__docs/${docId}`, { method: 'DELETE' }), 'Delete failed');
      await refresh();
    },
    [refresh],
  );

  return {
    manifest,
    loading,
    create,
    update,
    remove,
    reorder,
    assign,
    renameDoc,
    duplicateDoc,
    deleteDoc,
    refresh,
  };
}
