// Minimal ANSI styling; respects NO_COLOR and non-TTY output.

const enabled = process.stdout.isTTY && !process.env.NO_COLOR;

const wrap = (open: number, close: number) => (text: string) =>
  enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text;

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const cyan = wrap(36, 39);
export const magenta = wrap(35, 39);
