import { Check, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { docIds, useDocTitles } from '../lib/docs';
import {
  formatTokens,
  formatUsd,
  getSettings,
  getUsage,
  getVersion,
  type ImageGenerationMode,
  type ImageGenerationSettings,
  type KeyStatus,
  patchImageSettings,
  removeApiKey,
  saveApiKey,
  useLive,
} from '../lib/settings-api';
import { setUiScale, UI_SCALES, useUiScale } from '../lib/ui-scale';
import { cn } from '../lib/utils';

const MODE_OPTIONS: Array<{ mode: ImageGenerationMode; title: string; body: ReactNode }> = [
  { mode: 'off', title: 'Off', body: 'Documents use only the images you upload.' },
  {
    mode: 'codex',
    title: 'Leave prompts for Codex',
    body: (
      <>
        The writing agent puts an <code className="font-mono">&lt;ImagePrompt&gt;</code> where each
        image goes. Open Codex in this project and ask it to generate the images — it uses the{' '}
        <code className="font-mono">generate-images</code> skill and your Codex subscription.
      </>
    ),
  },
  {
    mode: 'openai',
    title: 'OpenAI API',
    body: 'MoSage draws each prompt itself with your API key, and records what it costs.',
  },
];

export function SettingsPage() {
  const settings = useLive(getSettings);
  const data = settings.data;

  const update = async (patch: Partial<ImageGenerationSettings>) => {
    const result = await patchImageSettings(patch);
    if (result.ok) settings.reload();
  };

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="font-medium text-lg tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Project choices are saved in <code className="font-mono">.mosage/settings.json</code>.
          Your API key and text size stay on this machine.
        </p>
      </header>

      <Section title="Interface">
        <TextSize />
      </Section>

      {import.meta.env.DEV &&
        (data === null ? (
          <div className="grid place-items-center py-12">
            {settings.error ? (
              <p className="text-muted-foreground text-sm">{settings.error}</p>
            ) : (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        ) : (
          <Section title="AI images">
            <fieldset className="grid gap-2" aria-label="Image generation">
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.mode}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition-colors',
                    data.settings.imageGeneration.mode === option.mode
                      ? 'border-foreground bg-accent'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  <input
                    type="radio"
                    name="image-mode"
                    className="mt-1 accent-foreground"
                    checked={data.settings.imageGeneration.mode === option.mode}
                    onChange={() => void update({ mode: option.mode })}
                  />
                  <span>
                    <span className="block font-medium text-sm">{option.title}</span>
                    <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">
                      {option.body}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {data.settings.imageGeneration.mode === 'openai' && (
              <div className="mt-6 space-y-6">
                <ApiKey status={data.openai} onChanged={settings.reload} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Model">
                    <select
                      value={data.settings.imageGeneration.model}
                      onChange={(e) => void update({ model: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      {data.choices.models.map((model) => {
                        const price = data.choices.prices[model];
                        return (
                          <option key={model} value={model}>
                            {model}
                            {price ? ` — $${price.imageOutput}/1M output tokens` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </Field>
                  <Field label="Quality">
                    <select
                      value={data.settings.imageGeneration.quality}
                      onChange={(e) =>
                        void update({
                          quality: e.target.value as ImageGenerationSettings['quality'],
                        })
                      }
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm capitalize"
                    >
                      {data.choices.qualities.map((quality) => (
                        <option key={quality} value={quality}>
                          {quality}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Usage pricesAsOf={data.choices.pricesAsOf} />
              </div>
            )}

            {data.settings.imageGeneration.mode !== 'off' && (
              <DocumentSwitches
                documents={data.settings.imageGeneration.documents}
                onToggle={(docId, enabled) => void update({ documents: { [docId]: enabled } })}
              />
            )}
          </Section>
        ))}

      {import.meta.env.DEV && (
        <Section title="About">
          <Version />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-muted-foreground text-xs uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block">
      <span className="mb-1 block font-medium text-sm">{label}</span>
      {children}
    </label>
  );
}

function TextSize() {
  const scale = useUiScale();
  return (
    <div>
      <p className="mb-2 font-medium text-sm">Text size</p>
      <fieldset aria-label="Text size" className="flex flex-wrap gap-2">
        {UI_SCALES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={scale === option.value}
            onClick={() => setUiScale(option.value)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              scale === option.value
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border hover:bg-accent',
            )}
          >
            {option.label}
            <span className="ml-1.5 text-xs opacity-70">{Math.round(option.value * 100)}%</span>
          </button>
        ))}
      </fieldset>
      <p className="mt-2 text-muted-foreground text-xs">
        Sizes the app itself. Pages keep their real size, and exports are not affected.
      </p>
    </div>
  );
}

function ApiKey({ status, onChanged }: { status: KeyStatus; onChanged: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    const result = await saveApiKey(value);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setValue('');
    setError(null);
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm('Remove the saved OpenAI API key from this machine?')) return;
    const result = await removeApiKey();
    if (!result.ok) return setError(result.error);
    onChanged();
  };

  return (
    <div>
      <p className="mb-1 font-medium text-sm">OpenAI API key</p>
      {status.configured ? (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" />
          <code className="font-mono">{status.hint}</code>
          <span className="text-muted-foreground text-xs">
            {status.source === 'env' ? 'from OPENAI_API_KEY' : 'saved on this machine'}
          </span>
          {status.source === 'saved' && (
            <button
              type="button"
              onClick={remove}
              className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          )}
        </div>
      ) : (
        <p className="mb-2 text-muted-foreground text-xs">
          No key yet. It is stored in <code className="font-mono">~/.mosage/credentials.json</code>,
          outside the project, so it is never committed.
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          type="password"
          autoComplete="off"
          aria-label="OpenAI API key"
          placeholder={status.configured ? 'Replace with a new key' : 'sk-…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save key
        </button>
      </form>
      {error && <p className="mt-2 text-muted-foreground text-xs">{error}</p>}
    </div>
  );
}

function Usage({ pricesAsOf }: { pricesAsOf: string }) {
  const { data } = useLive(getUsage);
  if (!data) return null;
  const rows = [
    { label: 'This project', totals: data.project },
    { label: 'All projects on this machine', totals: data.all },
  ];
  return (
    <div>
      <p className="mb-2 font-medium text-sm">Usage</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left text-muted-foreground text-xs">
            <th className="py-1.5 font-normal" />
            <th className="py-1.5 text-right font-normal">Images</th>
            <th className="py-1.5 text-right font-normal">Input tokens</th>
            <th className="py-1.5 text-right font-normal">Output tokens</th>
            <th className="py-1.5 text-right font-normal">Estimated cost</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(({ label, totals }) => (
            <tr key={label} className="border-border border-b">
              <td className="py-1.5">{label}</td>
              <td className="py-1.5 text-right">{totals.images}</td>
              <td className="py-1.5 text-right">{formatTokens(totals.inputTokens)}</td>
              <td className="py-1.5 text-right">{formatTokens(totals.outputTokens)}</td>
              <td className="py-1.5 text-right">{formatUsd(totals.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.recent.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-muted-foreground text-xs">
            Recent images in this project
          </summary>
          <ul className="mt-2 space-y-1 text-xs tabular-nums">
            {data.recent.map((entry) => (
              <li key={`${entry.ts}-${entry.imageId}`} className="flex gap-3">
                <span className="text-muted-foreground">{new Date(entry.ts).toLocaleString()}</span>
                <span className="flex-1 truncate">
                  {entry.docId} / {entry.imageId} · {entry.model} · {entry.quality}
                </span>
                <span>
                  {formatTokens(entry.inputTokens)} in · {formatTokens(entry.outputTokens)} out
                </span>
                <span>{formatUsd(entry.costUsd)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-muted-foreground text-xs">
        Costs are estimated from OpenAI's published prices ({pricesAsOf}); your OpenAI bill is the
        exact figure.
      </p>
    </div>
  );
}

function DocumentSwitches({
  documents,
  onToggle,
}: {
  documents: Record<string, boolean>;
  onToggle: (docId: string, enabled: boolean) => void;
}) {
  const titles = useDocTitles();

  return (
    <div className="mt-6">
      <p className="font-medium text-sm">Documents</p>
      <p className="mb-2 text-muted-foreground text-xs">
        Which documents may use generated images. Turned off, the agent leaves no prompts there.
      </p>
      {docIds.length === 0 ? (
        <p className="text-muted-foreground text-xs">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {[...docIds].sort().map((id) => (
            <li key={id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{titles[id] ?? id}</span>
              <code className="font-mono text-muted-foreground text-xs">{id}</code>
              <Switch
                label={`Generated images in ${id}`}
                checked={documents[id] !== false}
                onChange={(enabled) => onToggle(id, enabled)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 flex-none rounded-full transition-colors',
        checked ? 'bg-foreground' : 'bg-border',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function Version() {
  const { data } = useLive(getVersion);
  if (!data) return null;
  return (
    <div className="text-sm">
      <p>
        MoSage <span className="font-mono">{data.current}</span>
        {data.latest && !data.updateAvailable && (
          <span className="ml-2 text-muted-foreground text-xs">— up to date</span>
        )}
      </p>
      {data.updateAvailable && (
        <p className="mt-1 text-sm">
          Version <span className="font-mono">{data.latest}</span> is available. Run{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">npx mosage upgrade</code> in
          the project, or press <kbd className="font-mono">u</kbd> + <kbd>Enter</kbd> in the
          terminal running <code className="font-mono">mosage dev</code>.
        </p>
      )}
    </div>
  );
}
