import { useEffect, useState } from 'react';

export const GLOBAL_SCOPE = '@global';

export type Asset = {
  name: string;
  size: number;
  createdAt: number;
  mtime: number;
  mime: string;
  url: string;
  importPath: string;
  unused: boolean;
};

export type AssetUsages = {
  usages: Array<{ docId: string; count: number }>;
  totalCount: number;
};

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

const base = (scope: string) => `/__assets/${encodeURIComponent(scope)}`;
const fileUrl = (scope: string, name: string) => `${base(scope)}/${encodeURIComponent(name)}`;

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function listAssets(scope: string): Promise<ApiResult<Asset[]>> {
  try {
    const res = await fetch(base(scope));
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    const body = (await res.json()) as { assets: Asset[] };
    return { ok: true, value: body.assets };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

export async function uploadAsset(
  scope: string,
  file: File,
  opts: { overwrite?: boolean } = {},
): Promise<ApiResult<Asset>> {
  try {
    const url = `${fileUrl(scope, file.name)}${opts.overwrite ? '?overwrite=1' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    const body = (await res.json()) as Asset;
    return { ok: true, value: { ...body, unused: true } };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

export async function renameAsset(
  scope: string,
  name: string,
  next: string,
): Promise<ApiResult<string>> {
  try {
    const res = await fetch(fileUrl(scope, name), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: next }),
    });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    const body = (await res.json()) as { name: string };
    return { ok: true, value: body.name };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

export async function deleteAsset(scope: string, name: string): Promise<ApiResult<true>> {
  try {
    const res = await fetch(fileUrl(scope, name), { method: 'DELETE' });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, value: true };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

export async function assetUsages(scope: string, name: string): Promise<ApiResult<AssetUsages>> {
  try {
    const res = await fetch(`${fileUrl(scope, name)}/usages`);
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, value: (await res.json()) as AssetUsages };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

/** Count of global assets, for the sidebar badge. Zero outside dev. */
export function useAssetCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    const read = () => {
      listAssets(GLOBAL_SCOPE).then((result) => {
        if (!cancelled && result.ok) setCount(result.value.length);
      });
    };
    read();
    if (!import.meta.hot) {
      return () => {
        cancelled = true;
      };
    }
    import.meta.hot.on('open-doc:files-changed', read);
    return () => {
      cancelled = true;
      import.meta.hot?.off('open-doc:files-changed', read);
    };
  }, []);

  return count;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewable(mime: string): boolean {
  return mime.startsWith('image/');
}

/** The line an author pastes into a document to use this asset. */
export function importSnippet(asset: Asset): string {
  const stem = asset.name.replace(/\.[^.]+$/, '');
  const ident = stem
    .replace(/[^A-Za-z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, '');
  const safeIdent = /^[A-Za-z_$]/.test(ident) ? ident : `asset${ident}`;
  return `import ${safeIdent} from '${asset.importPath}';`;
}
