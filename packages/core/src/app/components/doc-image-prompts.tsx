import { AlertTriangle, Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatUsd,
  generateImage,
  getSettings,
  listImagePrompts,
  type PendingImage,
  patchImageSettings,
  placeImage,
  type Result,
  useLive,
} from '../lib/settings-api';
import { Switch } from '../routes/settings';

/**
 * The document's generated images: whether it uses them at all, and the
 * `<ImagePrompt>`s still waiting to be drawn.
 */
export function DocImagePrompts({ docId }: { docId: string }) {
  const settings = useLive(getSettings);
  const loadPrompts = useCallback(() => listImagePrompts(docId), [docId]);
  const prompts = useLive(loadPrompts);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!import.meta.env.DEV || !settings.data || !prompts.data) return null;
  const image = settings.data.settings.imageGeneration;
  if (image.mode === 'off') return null;

  const enabled = image.documents[docId] !== false;
  const pending = prompts.data.prompts;

  const toggle = async (next: boolean) => {
    await patchImageSettings({ documents: { [docId]: next } });
    settings.reload();
    prompts.reload();
  };

  const run = async (prompt: PendingImage) => {
    setBusy(prompt.id);
    setMessage(null);
    const result: Result<{ file: string; costUsd?: number }> = prompt.ready
      ? await placeImage(docId, prompt.id)
      : await generateImage(docId, prompt.id);
    setBusy(null);
    if (!result.ok) return setMessage(`${prompt.id}: ${result.error}`);
    const cost = result.value.costUsd;
    if (cost !== undefined) setMessage(`${prompt.id}: done · about ${formatUsd(cost)}`);
    prompts.reload();
  };

  const runAll = async () => {
    for (const prompt of pending.filter((p) => !p.problem)) {
      await run(prompt);
    }
  };

  const codexRequest = `Use the generate-images skill to draw the images in docs/${docId}.`;
  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(codexRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const drawable = pending.filter((p) => !p.problem);

  return (
    <section className="mt-3 rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 flex-none text-muted-foreground" />
        <span className="flex-1 font-medium text-xs">AI images</span>
        <Switch label="Use generated images in this document" checked={enabled} onChange={toggle} />
      </div>

      {!enabled ? (
        <p className="mt-1.5 text-[0.6875rem] text-muted-foreground leading-relaxed">
          Off for this document — the agent leaves no image prompts here.
        </p>
      ) : pending.length === 0 ? (
        <p className="mt-1.5 text-[0.6875rem] text-muted-foreground leading-relaxed">
          No prompts yet. The writing agent leaves an{' '}
          <code className="font-mono">&lt;ImagePrompt&gt;</code> where each image should go.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {pending.map((prompt) => (
              <li key={prompt.id} className="rounded bg-muted px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.6875rem]">
                    {prompt.id}
                  </code>
                  {prompt.problem ? (
                    <AlertTriangle className="size-3.5 flex-none text-muted-foreground" />
                  ) : prompt.ready || image.mode === 'openai' ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(prompt)}
                      className="flex flex-none items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[0.6875rem] text-primary-foreground disabled:opacity-60"
                    >
                      {busy === prompt.id && <Loader2 className="size-3 animate-spin" />}
                      {prompt.ready ? 'Place' : 'Generate'}
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-muted-foreground">
                  {prompt.problem ?? prompt.prompt}
                </p>
              </li>
            ))}
          </ul>

          {image.mode === 'openai' && drawable.length > 1 && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runAll()}
              className="mt-2 w-full rounded border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
            >
              Generate all ({drawable.length})
            </button>
          )}

          {image.mode === 'codex' && (
            <div className="mt-2">
              <p className="text-[0.6875rem] text-muted-foreground leading-relaxed">
                Open Codex in this project and ask it to draw them:
              </p>
              <button
                type="button"
                onClick={() => void copyRequest()}
                className="mt-1 flex w-full items-center gap-1.5 rounded border border-border px-2 py-1 text-left text-[0.6875rem] hover:bg-accent"
              >
                {copied ? (
                  <Check className="size-3 flex-none" />
                ) : (
                  <Copy className="size-3 flex-none" />
                )}
                <span className="truncate">{codexRequest}</span>
              </button>
            </div>
          )}
        </>
      )}

      {image.mode === 'openai' && !settings.data.openai.configured && enabled && (
        <p className="mt-2 text-[0.6875rem] text-muted-foreground">
          Add an OpenAI API key in{' '}
          <Link to="/settings" className="underline">
            Settings
          </Link>{' '}
          first.
        </p>
      )}
      {message && <p className="mt-2 text-[0.6875rem] text-muted-foreground">{message}</p>}
    </section>
  );
}
