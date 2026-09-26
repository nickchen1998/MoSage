import { useEffect, useState } from 'react';
import { docChangeIncludes, loadDoc } from './docs';
import type { DocModule } from './sdk';

export type DocState =
  | { status: 'loading'; doc: null; error: null }
  | { status: 'ready'; doc: DocModule; error: null }
  | { status: 'error'; doc: null; error: Error };

const LOADING: DocState = { status: 'loading', doc: null, error: null };

export function useDocModule(docId: string | undefined): DocState {
  const [state, setState] = useState<DocState>(LOADING);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;

    const read = () => {
      loadDoc(docId)
        .then((doc) => {
          if (!cancelled) setState({ status: 'ready', doc, error: null });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState({
            status: 'error',
            doc: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        });
    };

    setState(LOADING);
    read();

    if (!import.meta.hot)
      return () => {
        cancelled = true;
      };

    const onChange = (data: unknown) => {
      if (docChangeIncludes(data, docId)) read();
    };
    import.meta.hot.on('open-doc:doc-changed', onChange);
    return () => {
      cancelled = true;
      import.meta.hot?.off('open-doc:doc-changed', onChange);
    };
  }, [docId]);

  return state;
}
