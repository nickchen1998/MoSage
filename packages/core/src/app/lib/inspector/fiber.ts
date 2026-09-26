export type SourceLoc = { line: number; column: number };

type DebugSource = { fileName?: string; lineNumber?: number; columnNumber?: number };

type Fiber = {
  type?: unknown;
  return?: Fiber | null;
  stateNode?: unknown;
  _debugSource?: DebugSource | null;
};

const LOC_ATTR = 'data-od-loc';

function fiberOf(el: HTMLElement): Fiber | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
}

function locFromAttr(value: string | null): SourceLoc | null {
  if (!value) return null;
  const [line, column] = value.split(':').map(Number);
  if (!Number.isFinite(line) || !Number.isFinite(column)) return null;
  return { line, column };
}

function debugLoc(fiber: Fiber): (SourceLoc & { file?: string }) | null {
  const source = fiber._debugSource;
  if (!source || typeof source.lineNumber !== 'number' || typeof source.columnNumber !== 'number') {
    return null;
  }
  return { line: source.lineNumber, column: source.columnNumber, file: source.fileName };
}

/**
 * Source locations to try for the clicked element, innermost first.
 *
 * The DOM only carries a loc for host elements, so a `<td>` rendered by a local
 * `<Td>text</Td>` helper points at the helper's definition — where the text
 * isn't. Walking the fiber's `return` chain surfaces the call site, which is
 * where the author actually wrote the words.
 *
 * React's `_debugSource` counts lines against the module *after* the dev
 * transforms prepend their preamble, so it never matches our loc tags
 * directly. Rather than hard-coding that offset, calibrate it from any fiber
 * that carries both values.
 */
export function candidateLocs(el: HTMLElement, maxDepth = 12): SourceLoc[] {
  const domLoc = locFromAttr(el.closest(`[${LOC_ATTR}]`)?.getAttribute(LOC_ATTR) ?? null);
  const candidates: SourceLoc[] = domLoc ? [domLoc] : [];

  let fiber = fiberOf(el);
  const chain: Fiber[] = [];
  for (let depth = 0; fiber && depth < maxDepth; depth++) {
    chain.push(fiber);
    fiber = fiber.return ?? null;
  }

  // Calibrate against a fiber that carries both values — that one is provably
  // in the document's own source file, which also tells us which file the rest
  // of the chain has to belong to.
  let calibration: { line: number; column: number; file?: string } | null = null;
  for (const node of chain) {
    const source = debugLoc(node);
    const host = node.stateNode instanceof HTMLElement ? node.stateNode : null;
    const tagged = locFromAttr(host?.getAttribute(LOC_ATTR) ?? null);
    if (source && tagged) {
      calibration = {
        line: source.line - tagged.line,
        column: source.column - tagged.column,
        file: source.file,
      };
      break;
    }
  }
  if (!calibration) return candidates;

  for (const node of chain) {
    const source = debugLoc(node);
    if (!source) continue;
    // Fibers from the framework's own components (FlowPage, PageFrame, …) carry
    // line numbers from *their* files. Mapping those through the document's
    // offset lands on unrelated elements, which is how an edit ends up
    // rewriting the wrong text.
    if (calibration.file && source.file !== calibration.file) continue;
    const loc = {
      line: source.line - calibration.line,
      column: source.column - calibration.column,
    };
    if (loc.line < 1 || loc.column < 0) continue;
    if (candidates.some((c) => c.line === loc.line && c.column === loc.column)) continue;
    candidates.push(loc);
  }

  return candidates;
}

export function formatLocs(locs: SourceLoc[]): string {
  return locs.map((loc) => `${loc.line}:${loc.column}`).join(',');
}
