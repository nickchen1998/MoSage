/** OpenAI image models MoSage can call, newest first. */
export const IMAGE_MODELS = [
  'gpt-image-2',
  'gpt-image-1.5',
  'gpt-image-1',
  'gpt-image-1-mini',
] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2';

/** USD per 1M tokens. */
export type ImageModelPrice = { textInput: number; imageInput: number; imageOutput: number };

/**
 * OpenAI's published rates as of September 2026. They change without notice, so
 * every figure computed from them is an estimate — the bill on
 * platform.openai.com is the one that counts.
 */
export const IMAGE_MODEL_PRICES: Record<ImageModel, ImageModelPrice> = {
  'gpt-image-2': { textInput: 5, imageInput: 8, imageOutput: 30 },
  'gpt-image-1.5': { textInput: 5, imageInput: 8, imageOutput: 32 },
  'gpt-image-1': { textInput: 5, imageInput: 10, imageOutput: 40 },
  'gpt-image-1-mini': { textInput: 2, imageInput: 2.5, imageOutput: 8 },
};

export const PRICES_AS_OF = '2026-09';

export function isImageModel(value: unknown): value is ImageModel {
  return typeof value === 'string' && (IMAGE_MODELS as readonly string[]).includes(value);
}

/** Token counts as the Images API reports them in `usage`. */
export type ImageTokenUsage = {
  inputTokens: number;
  textInputTokens: number;
  imageInputTokens: number;
  outputTokens: number;
};

/** Reads the API's `usage` object; input without a breakdown counts as text. */
export function readTokenUsage(raw: unknown): ImageTokenUsage {
  const usage = (raw ?? {}) as {
    input_tokens?: unknown;
    output_tokens?: unknown;
    input_tokens_details?: { text_tokens?: unknown; image_tokens?: unknown };
  };
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  const inputTokens = count(usage.input_tokens);
  const imageInputTokens = count(usage.input_tokens_details?.image_tokens);
  const details = usage.input_tokens_details?.text_tokens;
  const textInputTokens = details === undefined ? inputTokens - imageInputTokens : count(details);
  return {
    inputTokens,
    textInputTokens: Math.max(0, textInputTokens),
    imageInputTokens,
    outputTokens: count(usage.output_tokens),
  };
}

export function estimateCostUsd(model: ImageModel, usage: ImageTokenUsage): number {
  const price = IMAGE_MODEL_PRICES[model];
  return (
    (usage.textInputTokens * price.textInput +
      usage.imageInputTokens * price.imageInput +
      usage.outputTokens * price.imageOutput) /
    1_000_000
  );
}
