import type { CSSProperties } from 'react';

export type ImagePlaceholderProps = {
  /** What the final image should show — the user reads this when replacing it. */
  hint: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  className?: string;
};

/**
 * Stands in for an image the user has to supply (a chart from their data, a
 * product screenshot). Use it instead of inventing filler — never for
 * decoration.
 */
export function ImagePlaceholder({
  hint,
  width = '100%',
  height = 200,
  style,
  className,
}: ImagePlaceholderProps) {
  return (
    <div
      data-od-image-placeholder=""
      className={className}
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 16,
        boxSizing: 'border-box',
        border: '1px dashed var(--od-rule, #d4d4d8)',
        borderRadius: 'var(--od-radius, 6px)',
        background: 'repeating-linear-gradient(45deg, rgba(0,0,0,.02) 0 8px, transparent 8px 16px)',
        color: 'var(--od-muted, #6b7280)',
        fontFamily: 'var(--od-font-body, system-ui, sans-serif)',
        fontSize: 'var(--od-size-caption, 10px)',
        lineHeight: 1.4,
        ...style,
      }}
    >
      {hint}
    </div>
  );
}
