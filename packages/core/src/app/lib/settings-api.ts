import { useCallback, useEffect, useState } from 'react';

export type ImageGenerationMode = 'off' | 'codex' | 'openai';
export type ImageQuality = 'low' | 'medium' | 'high';

export type ImageGenerationSettings = {
  mode: ImageGenerationMode;
  model: string;
  quality: ImageQuality;
  documents: Record<string, boolean>;
};

export type ProjectSettings = { imageGeneration: ImageGenerationSettings };

export type KeyStatus =
  | { configured: false }
  | { configured: true; source: 'saved' | 'env'; hint: string };

export type ModelPrice = { textInput: number; imageInput: number; imageOutput: number };

export type SettingsResponse = {
  settings: ProjectSettings;
  openai: KeyStatus;
  choices: {
    modes: ImageGenerationMode[];
    models: string[];
    qualities: ImageQuality[];
    prices: Record<string, ModelPrice>;
    pricesAsOf: string;
  };
};

export type UsageTotals = {
  images: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type UsageEntry = {
  ts: string;
  /** The project's folder name. */
  project: string;
  docId: string;
  imageId: string;
  model: string;
  size: string;
  quality: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type UsageResponse = { totals: UsageTotals; recent: UsageEntry[] };

export type VersionResponse = { current: string; latest: string | null; updateAvailable: boolean };

export type PendingImage = {
  docId: string;
  id: string;
  prompt: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  line: number;
  problem: string | null;
  file: string;
  importPath: string;
  ready: boolean;
  enabled: boolean;
};

export type ImagesResponse = { mode: ImageGenerationMode; prompts: PendingImage[] };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    return { ok: true, value: body };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getSettings = () => call<SettingsResponse>('/__settings');

export const patchImageSettings = (patch: Partial<ImageGenerationSettings>) =>
  call<{ settings: ProjectSettings }>('/__settings', jsonInit('PATCH', { imageGeneration: patch }));

export const saveApiKey = (key: string) =>
  call<{ openai: KeyStatus }>('/__settings/openai-key', jsonInit('PUT', { key }));

export const removeApiKey = () =>
  call<{ openai: KeyStatus }>('/__settings/openai-key', { method: 'DELETE' });

export const getUsage = () => call<UsageResponse>('/__settings/usage');

export const getVersion = () => call<VersionResponse>('/__settings/version');

export const listImagePrompts = (docId?: string) =>
  call<ImagesResponse>(docId ? `/__images?docId=${encodeURIComponent(docId)}` : '/__images');

export const generateImage = (docId: string, id: string) =>
  call<{ file: string; costUsd: number }>('/__images/generate', jsonInit('POST', { docId, id }));

export const placeImage = (docId: string, id: string) =>
  call<{ file: string }>('/__images/place', jsonInit('POST', { docId, id }));

/** Re-runs `load` whenever the dev server reports that settings or files changed. */
export function useLive<T>(load: () => Promise<Result<T>>): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    void load().then((result) => {
      if (result.ok) {
        setData(result.value);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [load]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    reload();
    const hot = import.meta.hot;
    if (!hot) return;
    hot.on('mosage:settings-changed', reload);
    hot.on('mosage:files-changed', reload);
    return () => {
      hot.off('mosage:settings-changed', reload);
      hot.off('mosage:files-changed', reload);
    };
  }, [reload]);

  return { data, error, reload };
}

export function formatUsd(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatTokens(value: number): string {
  return value.toLocaleString('en-US');
}
