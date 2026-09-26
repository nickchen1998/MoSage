import { describe, expect, it } from 'vitest';
import { estimateCostUsd, readTokenUsage } from './pricing.ts';

describe('readTokenUsage', () => {
  it('splits input into text and image tokens', () => {
    expect(
      readTokenUsage({
        input_tokens: 120,
        output_tokens: 4160,
        input_tokens_details: { text_tokens: 20, image_tokens: 100 },
      }),
    ).toEqual({ inputTokens: 120, textInputTokens: 20, imageInputTokens: 100, outputTokens: 4160 });
  });

  it('counts input without a breakdown as text, and tolerates a missing usage', () => {
    expect(readTokenUsage({ input_tokens: 50, output_tokens: 10 })).toEqual({
      inputTokens: 50,
      textInputTokens: 50,
      imageInputTokens: 0,
      outputTokens: 10,
    });
    expect(readTokenUsage(undefined).outputTokens).toBe(0);
  });
});

describe('estimateCostUsd', () => {
  it('prices each kind of token at its own rate', () => {
    const usage = {
      inputTokens: 1_100_000,
      textInputTokens: 1_000_000,
      imageInputTokens: 100_000,
      outputTokens: 1_000_000,
    };
    // gpt-image-2: $5 text in, $8 image in, $30 out per 1M tokens.
    expect(estimateCostUsd('gpt-image-2', usage)).toBeCloseTo(5 + 0.8 + 30);
    expect(estimateCostUsd('gpt-image-1-mini', usage)).toBeCloseTo(2 + 0.25 + 8);
  });
});
