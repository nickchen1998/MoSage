import type { CSSProperties } from 'react';

export type ImagePromptProps = {
  /** Lowercase letters, digits and dashes. Becomes the file name: `<id>.png`. */
  id: string;
  /** What to draw, written for an image model: subject, style, composition, text to avoid. */
  prompt: string;
  /** @deprecated Ignored: images are no longer filed by chapter. */
  chapter?: string;
  alt?: string;
  /** The size the finished image takes on the page, in px. Also picks its aspect ratio. */
  width?: number;
  height?: number;
  style?: CSSProperties;
};

/**
 * Holds the place of an image that has not been drawn yet. Codex, or MoSage
 * itself through the OpenAI API, draws it from `prompt`, saves it under
 * `assets/images/<id>.png`, and replaces this element with an `<img>`
 * of the same size — so the page is laid out right before the image exists.
 */
export function ImagePrompt({ id, prompt, width, height = 240, style }: ImagePromptProps) {
  return (
    <div
      data-od-image-prompt={id}
      style={{
        width: width ?? '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 6,
        padding: 16,
        boxSizing: 'border-box',
        overflow: 'hidden',
        border: '1px dashed var(--od-accent, #2563eb)',
        borderRadius: 'var(--od-radius, 6px)',
        background: 'color-mix(in srgb, var(--od-accent, #2563eb) 5%, transparent)',
        color: 'var(--od-muted, #6b7280)',
        fontFamily: 'var(--od-font-body, system-ui, sans-serif)',
        ...style,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--od-accent, #2563eb)',
        }}
      >
        AI image · {id}
      </span>
      <span
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 4,
          overflow: 'hidden',
        }}
      >
        {prompt}
      </span>
    </div>
  );
}
