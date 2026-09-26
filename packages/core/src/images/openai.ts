import type { ImageQuality } from '../files/settings.ts';
import type { ImageModel, ImageTokenUsage } from './pricing.ts';
import { readTokenUsage } from './pricing.ts';

export class OpenAiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenAiError';
  }
}

/** The sizes every GPT image model accepts, picked by the shape the page reserves. */
export function sizeFor(width: number | null, height: number | null): string {
  if (!width || !height) return 'auto';
  const ratio = width / height;
  if (ratio >= 1.2) return '1536x1024';
  if (ratio <= 1 / 1.2) return '1024x1536';
  return '1024x1024';
}

export type ImageRequest = {
  apiKey: string;
  model: ImageModel;
  prompt: string;
  size: string;
  quality: ImageQuality;
};

export type ImageResult = { bytes: Buffer; usage: ImageTokenUsage };

function baseUrl(): string {
  return (process.env.MOSAGE_OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

export async function requestImage(request: ImageRequest): Promise<ImageResult> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/images/generations`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${request.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        n: 1,
        output_format: 'png',
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    throw new OpenAiError(502, `Could not reach OpenAI: ${(err as Error).message}`);
  }

  const body = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string }>;
    usage?: unknown;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new OpenAiError(401, `OpenAI rejected the API key: ${detail}`);
    throw new OpenAiError(502, `OpenAI returned an error: ${detail}`);
  }

  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new OpenAiError(502, 'OpenAI returned no image data');
  return { bytes: Buffer.from(b64, 'base64'), usage: readTokenUsage(body?.usage) };
}
