import { useEffect, useState } from 'react';

export const GLOBAL_SCOPE = '@global';

/** Images, and everything else — a reference the author works from. */
export type AssetKind = 'image' | 'reference';

export type Asset = {
  name: string;
  /** Inside the scope's assets folder, e.g. `images/chart.png`. */
  path: string;
  kind: AssetKind;
  size: number;
  createdAt: number;
  mtime: number;
  mime: string;
  url: string;
  importPath: string;
  unused: boolean;
};

export type AssetList = { assets: Asset[] };

export type AssetUsages = {
  usages: Array<{ docId: string; count: number }>;
  totalCount: number;
};

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const KIND_LABEL: Record<AssetKind, string> = { image: '圖片', reference: '參考文獻' };

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif)$/i;

export function isImageName(name: string): boolean {
  return IMAGE_EXT.test(name);
}

const base = (scope: string) => `/__assets/${encodeURIComponent(scope)}`;
const pathUrl = (scope: string, path: string) =>
  `${base(scope)}/${path.split('/').map(encodeURIComponent).join('/')}`;

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true, value: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function listAssets(scope: string): Promise<ApiResult<AssetList>> {
  return request<AssetList>(base(scope));
}

/** Where a dropped file goes: images into `images/`, anything else into `references/`. */
export function uploadPath(filename: string): string {
  return `${isImageName(filename) ? 'images' : 'references'}/${filename}`;
}

export function uploadAsset(
  scope: string,
  file: File,
  opts: { overwrite?: boolean } = {},
): Promise<ApiResult<Asset>> {
  const url = `${pathUrl(scope, uploadPath(file.name))}${opts.overwrite ? '?overwrite=1' : ''}`;
  return request<Asset>(url, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
}

/** Renames in place. Imports of the file are rewritten to follow it. */
export function renameAsset(scope: string, path: string, name: string) {
  return request<{ path: string; updated: number }>(
    pathUrl(scope, path),
    jsonBody('PATCH', { name }),
  );
}

export function deleteAsset(scope: string, path: string) {
  return request<{ ok: true }>(pathUrl(scope, path), { method: 'DELETE' });
}

export function assetUsages(scope: string, path: string) {
  return request<AssetUsages>(`${pathUrl(scope, path)}/usages`);
}

/** Re-reads a scope whenever files change on disk or through the API. */
export function useAssets(scope: string): {
  list: AssetList | null;
  error: string | null;
  reload: () => void;
} {
  const [list, setList] = useState<AssetList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    void tick;
    listAssets(scope).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setList(result.value);
        setError(null);
      } else {
        setList({ assets: [] });
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scope, tick]);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return;
    const bump = () => setTick((n) => n + 1);
    hot.on('mosage:files-changed', bump);
    return () => hot.off('mosage:files-changed', bump);
  }, []);

  return { list, error, reload: () => setTick((n) => n + 1) };
}

/** Count of project-wide assets, for the sidebar badge. Zero outside dev. */
export function useAssetCount(): number {
  const { list } = useAssets(GLOBAL_SCOPE);
  return list?.assets.length ?? 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PreviewKind = 'image' | 'pdf' | 'table' | 'text' | 'audio' | 'video' | 'none';

export function previewKind(asset: Pick<Asset, 'mime' | 'name'>): PreviewKind {
  const { mime } = asset;
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('text/csv') || mime.startsWith('text/tab-separated-values')) return 'table';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'none';
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
