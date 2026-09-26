const DEFAULT_WAITFOR_TIMEOUT_MS = 10_000;

// `document.fonts.ready` already waits for every in-flight face. Never call
// `face.load()` on the rest: unloaded faces were never requested by CSS, and
// `load()` ignores `unicode-range`, so a subsetted CJK family (hundreds of
// faces) would be force-downloaded in full and hang the tab.
export async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  await document.fonts.ready;
}

export async function waitForImages(root: ParentNode, timeoutMs = 10_000): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ),
    sleep(timeoutMs),
  ]);
}

export async function waitForDataWaitfor(
  root: HTMLElement,
  timeoutMs = DEFAULT_WAITFOR_TIMEOUT_MS,
): Promise<void> {
  const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-waitfor]'));
  if (targets.length === 0) return;
  const deadline = performance.now() + timeoutMs;
  await Promise.all(
    targets.map(async (el) => {
      const selector = el.getAttribute('data-waitfor');
      if (!selector) return;
      while (performance.now() < deadline) {
        try {
          if (el.querySelector(selector)) return;
        } catch {
          return; // invalid selector — skip rather than hang
        }
        await nextFrame();
      }
    }),
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nextFrame(): Promise<void> {
  // rAF in real tabs; setTimeout fallback for hidden/throttled tabs.
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(settle);
    setTimeout(settle, 50);
  });
}
