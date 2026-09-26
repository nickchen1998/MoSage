import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type DesignSystem, defaultDesign, designToCssVars } from '../../lib/design';
import { shuffleDesign } from '../../lib/design-presets';
import { useDesign as useDesignFetch } from './use-design';

type DesignCtx = {
  docId: string;
  loaded: boolean;
  exists: boolean;
  warning: string | null;
  design: DesignSystem | null;
  draft: DesignSystem | null;
  dirty: boolean;
  committing: boolean;
  error: string | null;
  update: (mut: (next: DesignSystem) => void) => void;
  commit: () => Promise<void>;
  discard: () => void;
  resetToDefaults: () => void;
  shuffle: () => void;
};

const Ctx = createContext<DesignCtx | null>(null);

export function useDesignPanelState(): DesignCtx {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDesignPanelState must be used inside <DesignProvider>');
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function DesignProvider({ docId, children }: { docId: string; children: ReactNode }) {
  const { design, exists, warning, loaded, save } = useDesignFetch(docId);
  const [draft, setDraft] = useState<DesignSystem | null>(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<DesignSystem | null>(null);
  draftRef.current = draft;

  useEffect(() => {
    if (design) setDraft(clone(design));
  }, [design]);

  const dirty = useMemo(() => {
    if (!draft || !design) return false;
    return JSON.stringify(draft) !== JSON.stringify(design);
  }, [draft, design]);

  const update = useCallback((mut: (next: DesignSystem) => void) => {
    const prev = draftRef.current;
    if (!prev) return;
    const next = clone(prev);
    mut(next);
    setDraft(next);
  }, []);

  const commit = useCallback(async () => {
    if (!draft) return;
    setCommitting(true);
    const result = await save(draft);
    setCommitting(false);
    setError(result.ok ? null : (result.error ?? 'Failed to save'));
  }, [draft, save]);

  const discard = useCallback(() => {
    if (design) setDraft(clone(design));
    setError(null);
  }, [design]);

  const resetToDefaults = useCallback(() => setDraft(clone(defaultDesign)), []);
  const shuffle = useCallback(() => setDraft(clone(shuffleDesign(draftRef.current))), []);

  // PageFrame writes its design vars inline on each page root, so the draft
  // overlay has to outrank inline styles — hence `!important`.
  const previewCss = useMemo(() => {
    if (!dirty || !draft) return '';
    const lines = Object.entries(designToCssVars(draft))
      .map(([k, v]) => `  ${k}: ${v} !important;`)
      .join('\n');
    return `[data-od-page] {\n${lines}\n}`;
  }, [dirty, draft]);

  const value: DesignCtx = {
    docId,
    loaded,
    exists,
    warning,
    design,
    draft,
    dirty,
    committing,
    error,
    update,
    commit,
    discard,
    resetToDefaults,
    shuffle,
  };

  return (
    <Ctx.Provider value={value}>
      {previewCss && (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted local css built from draft state
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
      )}
      {children}
    </Ctx.Provider>
  );
}
