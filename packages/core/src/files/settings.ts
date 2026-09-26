import fs from 'node:fs/promises';
import path from 'node:path';
import { type CodeHost, isCodeHost } from '../app/lib/code-remote.ts';
import { DEFAULT_IMAGE_MODEL, type ImageModel, isImageModel } from '../images/pricing.ts';
import { DOC_ID_RE } from '../vite/mosage-plugin.ts';

/**
 * `off` — no generated images. `codex` — the writing agent leaves a prompt in
 * place of each image and Codex draws them later. `openai` — MoSage calls the
 * OpenAI Images API itself with the key saved on this machine.
 */
export const IMAGE_GENERATION_MODES = ['off', 'codex', 'openai'] as const;
export type ImageGenerationMode = (typeof IMAGE_GENERATION_MODES)[number];

export const IMAGE_QUALITIES = ['low', 'medium', 'high'] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export type ImageGenerationSettings = {
  mode: ImageGenerationMode;
  model: ImageModel;
  quality: ImageQuality;
  /** docId → whether that document uses generated images. Unlisted means yes. */
  documents: Record<string, boolean>;
};

export type CodeSettings = {
  /**
   * Where `code/` is pushed. Kept here because `code/` is its own repository
   * and stays out of the project's: a fresh clone of the project uses this to
   * bring it back.
   */
  remote: string | null;
  /** For a self-hosted server whose domain names neither GitHub nor GitLab. */
  host: CodeHost | null;
};

/** Project-wide choices, committed with the project in `.mosage/settings.json`. */
export type ProjectSettings = {
  imageGeneration: ImageGenerationSettings;
  code: CodeSettings;
};

export function defaultSettings(): ProjectSettings {
  return {
    imageGeneration: { mode: 'off', model: DEFAULT_IMAGE_MODEL, quality: 'medium', documents: {} },
    code: { remote: null, host: null },
  };
}

export function settingsPath(userCwd: string): string {
  return path.join(userCwd, '.mosage', 'settings.json');
}

function isMode(v: unknown): v is ImageGenerationMode {
  return typeof v === 'string' && (IMAGE_GENERATION_MODES as readonly string[]).includes(v);
}

function isQuality(v: unknown): v is ImageQuality {
  return typeof v === 'string' && (IMAGE_QUALITIES as readonly string[]).includes(v);
}

function readDocuments(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [docId, enabled] of Object.entries(v)) {
    if (DOC_ID_RE.test(docId) && typeof enabled === 'boolean') out[docId] = enabled;
  }
  return out;
}

/** Whatever the file holds, a complete and valid settings object — unknown values fall back. */
export function normalizeSettings(raw: unknown): ProjectSettings {
  const base = defaultSettings();
  const input = raw as {
    imageGeneration?: Record<string, unknown>;
    code?: Record<string, unknown>;
  } | null;
  const image = input?.imageGeneration;
  const code = input?.code;
  return {
    imageGeneration:
      image && typeof image === 'object'
        ? {
            mode: isMode(image.mode) ? image.mode : base.imageGeneration.mode,
            model: isImageModel(image.model) ? image.model : base.imageGeneration.model,
            quality: isQuality(image.quality) ? image.quality : base.imageGeneration.quality,
            documents: readDocuments(image.documents),
          }
        : base.imageGeneration,
    code:
      code && typeof code === 'object'
        ? {
            remote:
              typeof code.remote === 'string' && code.remote.trim() ? code.remote.trim() : null,
            host: isCodeHost(code.host) ? code.host : null,
          }
        : base.code,
  };
}

/**
 * Applies a partial update from the settings page. Returns null when any field
 * it names is invalid, so a bad request changes nothing rather than half of it.
 */
export function applySettingsPatch(
  current: ProjectSettings,
  patch: unknown,
): ProjectSettings | null {
  const image = (patch as { imageGeneration?: Record<string, unknown> } | null)?.imageGeneration;
  if (!image || typeof image !== 'object') return null;
  const next = structuredClone(current);
  if ('mode' in image) {
    if (!isMode(image.mode)) return null;
    next.imageGeneration.mode = image.mode;
  }
  if ('model' in image) {
    if (!isImageModel(image.model)) return null;
    next.imageGeneration.model = image.model;
  }
  if ('quality' in image) {
    if (!isQuality(image.quality)) return null;
    next.imageGeneration.quality = image.quality;
  }
  if ('documents' in image) {
    const docs = image.documents;
    if (!docs || typeof docs !== 'object' || Array.isArray(docs)) return null;
    for (const [docId, enabled] of Object.entries(docs)) {
      if (!DOC_ID_RE.test(docId) || typeof enabled !== 'boolean') return null;
      next.imageGeneration.documents[docId] = enabled;
    }
  }
  return next;
}

export function usesGeneratedImages(settings: ProjectSettings, docId: string): boolean {
  const image = settings.imageGeneration;
  return image.mode !== 'off' && image.documents[docId] !== false;
}

export async function readSettings(userCwd: string): Promise<ProjectSettings> {
  try {
    return normalizeSettings(JSON.parse(await fs.readFile(settingsPath(userCwd), 'utf8')));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultSettings();
    if (err instanceof SyntaxError) return defaultSettings();
    throw err;
  }
}

export async function writeSettings(userCwd: string, settings: ProjectSettings): Promise<void> {
  const file = settingsPath(userCwd);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}
