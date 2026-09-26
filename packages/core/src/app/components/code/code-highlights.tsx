import { type RefObject, useLayoutEffect, useState } from 'react';
import { LABEL_ID_ATTR, type LabelEntry } from '../../lib/labels';
import { cn } from '../../lib/utils';
import { codeDetail } from '../code-excerpt';

type Box = { id: string; status: string; top: number; left: number; width: number; height: number };

/**
 * Outlines excerpts on the pages from outside them — the page DOM is what gets
 * printed, so the marks live in an overlay and never in the document.
 */
export function CodeHighlights({
  containerRef,
  entries,
  selectedId,
  layoutKey,
}: {
  containerRef: RefObject<HTMLElement | null>;
  entries: LabelEntry[];
  selectedId: string | null;
  /** Anything that moves the pages: zoom, view mode. */
  layoutKey: string;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: layoutKey stands for the zoom and layout that move every excerpt.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const base = container.getBoundingClientRect();
      const next: Box[] = [];
      for (const entry of entries) {
        const el = container.querySelector(`[${LABEL_ID_ATTR}="${CSS.escape(entry.id)}"]`);
        const status = codeDetail(entry)?.status;
        if (!el || !status) continue;
        const r = el.getBoundingClientRect();
        next.push({
          id: entry.id,
          status,
          top: r.top - base.top + container.scrollTop,
          left: r.left - base.left + container.scrollLeft,
          width: r.width,
          height: r.height,
        });
      }
      setBoxes(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (container.firstElementChild) observer.observe(container.firstElementChild);
    return () => observer.disconnect();
  }, [containerRef, entries, layoutKey]);

  return (
    <>
      {boxes
        .filter((box) => box.status === 'changed' || box.status === 'new' || box.id === selectedId)
        .map((box) => (
          <div
            key={box.id}
            aria-hidden
            className={cn(
              'pointer-events-none absolute rounded-md border-2',
              box.status === 'changed'
                ? 'border-changed'
                : box.status === 'new'
                  ? 'border-unpushed'
                  : 'border-foreground/50',
              box.id === selectedId && 'shadow-[0_0_0_4px_var(--background)]',
            )}
            style={{
              top: box.top - 6,
              left: box.left - 6,
              width: box.width + 12,
              height: box.height + 12,
            }}
          />
        ))}
    </>
  );
}
