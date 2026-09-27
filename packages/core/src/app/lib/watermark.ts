import type { PageGeometry } from './sdk';

export const WATERMARK_ATTR = 'data-od-watermark';

const WIDE = /[⺀-鿿가-힯豈-﫿＀-￯]/;
/** The drawn letter spacing, in em — the width estimate has to include it. */
const TRACKING = 0.1;

/** How many ems a line of this text sets: a CJK character is square, Latin about half that. */
export function textEms(text: string): number {
  let ems = 0;
  for (const ch of text) ems += (WIDE.test(ch) ? 1 : 0.6) + TRACKING;
  return ems;
}

/**
 * The size and angle that lay the text along the sheet's diagonal, filling
 * most of it. Sizes are even px, like every other size on the page.
 */
export function watermarkLayout(
  text: string,
  geometry: Pick<PageGeometry, 'width' | 'height'>,
): { size: number; angle: number } {
  const diagonal = Math.hypot(geometry.width, geometry.height);
  const fit = (diagonal * 0.6) / Math.max(1, textEms(text));
  const size = Math.max(32, Math.min(160, Math.round(fit / 2) * 2));
  const angle = -Math.round((Math.atan2(geometry.height, geometry.width) * 180) / Math.PI);
  return { size, angle };
}

/** Custom properties the watermark rule in `styles.css` reads off the sheet. */
export function watermarkVars(
  text: string,
  geometry: Pick<PageGeometry, 'width' | 'height'>,
): Record<string, string> {
  const { size, angle } = watermarkLayout(text, geometry);
  return { '--od-watermark-size': `${size}px`, '--od-watermark-angle': `${angle}deg` };
}
