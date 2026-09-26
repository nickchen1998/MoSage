import { useEffect, useState } from 'react';

type Toast = { id: number; text: string; tone: 'info' | 'error' | 'success' };

const listeners = new Set<(t: Toast) => void>();
let next = 1;

export function toast(text: string, tone: Toast['tone'] = 'info') {
  const t = { id: next++, text, tone };
  for (const fn of listeners) fn(t);
}

export function toastError(err: unknown) {
  toast(err instanceof Error ? err.message : String(err), 'error');
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((list) => [...list, t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 4200);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
