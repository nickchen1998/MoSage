import { Loader2, RotateCcw, Shuffle, X } from 'lucide-react';
import type { DesignSystem } from '../../lib/design';
import { msg, useT } from '../../lib/i18n';
import { useDesignPanelState } from './design-provider';

const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  {
    label: msg('System sans'),
    value: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif',
  },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: msg('Georgia serif'), value: 'Georgia, "Times New Roman", serif' },
  { label: msg('Times serif'), value: '"Times New Roman", Times, serif' },
  { label: msg('Mono'), value: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace' },
];

const PALETTE_KEYS: Array<{ key: keyof DesignSystem['palette']; label: string }> = [
  { key: 'bg', label: msg('Sheet') },
  { key: 'text', label: msg('Text') },
  { key: 'muted', label: msg('Muted') },
  { key: 'accent', label: msg('Accent') },
  { key: 'rule', label: msg('Rule') },
];

const TYPE_KEYS: Array<{
  key: keyof DesignSystem['typeScale'];
  label: string;
  min: number;
  max: number;
}> = [
  { key: 'title', label: msg('Title'), min: 24, max: 72 },
  { key: 'h1', label: 'H1', min: 16, max: 48 },
  { key: 'h2', label: 'H2', min: 14, max: 36 },
  { key: 'h3', label: 'H3', min: 12, max: 28 },
  { key: 'body', label: msg('Body'), min: 10, max: 20 },
  { key: 'caption', label: msg('Caption'), min: 8, max: 16 },
];

const FONT_SLOTS = [
  { slot: 'heading', label: msg('Heading') },
  { slot: 'body', label: msg('Body') },
  { slot: 'mono', label: msg('Mono') },
] as const;

export function DesignPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const {
    loaded,
    exists,
    warning,
    draft,
    dirty,
    committing,
    error,
    update,
    commit,
    discard,
    resetToDefaults,
    shuffle,
  } = useDesignPanelState();

  return (
    <aside className="flex w-72 flex-none flex-col border-border border-l bg-background">
      <header className="flex h-10 flex-none items-center justify-between border-border border-b px-3">
        <span className="font-medium text-xs uppercase tracking-wider">{t('Design')}</span>
        <div className="flex items-center gap-0.5">
          <IconButton label={t('Shuffle preset')} onClick={shuffle}>
            <Shuffle className="size-3.5" />
          </IconButton>
          <IconButton label={t('Reset to defaults')} onClick={resetToDefaults}>
            <RotateCcw className="size-3.5" />
          </IconButton>
          <IconButton label={t('Close design panel')} onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!loaded || !draft ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {warning && (
              <p className="mb-3 rounded-md border border-border bg-muted px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
                {t(warning)}
              </p>
            )}
            {!exists && (
              <p className="mb-3 rounded-md border border-border bg-muted px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
                {t.rich('This document has no {design} const yet. Saving writes one into {file}.', {
                  design: <code className="font-mono">design</code>,
                  file: <code className="font-mono">index.tsx</code>,
                })}
              </p>
            )}

            <Section title={t('Palette')}>
              {PALETTE_KEYS.map(({ key, label }) => (
                <Row key={key} label={t(label)}>
                  <input
                    type="color"
                    value={draft.palette[key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      update((d) => {
                        d.palette[key] = value;
                      });
                    }}
                    className="size-6 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={draft.palette[key]}
                    onChange={(e) => {
                      const value = e.target.value;
                      update((d) => {
                        d.palette[key] = value;
                      });
                    }}
                    className="w-20 rounded border border-border bg-transparent px-1.5 py-0.5 font-mono text-[0.6875rem]"
                  />
                </Row>
              ))}
            </Section>

            <Section title={t('Fonts')}>
              {FONT_SLOTS.map(({ slot, label }) => (
                <Row key={slot} label={t(label)}>
                  <select
                    value={
                      FONT_OPTIONS.some((o) => o.value === draft.fonts[slot])
                        ? draft.fonts[slot]
                        : 'custom'
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'custom') return;
                      update((d) => {
                        d.fonts[slot] = value;
                      });
                    }}
                    className="w-40 rounded border border-border bg-transparent px-1.5 py-0.5 text-[0.6875rem]"
                  >
                    {FONT_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>
                        {t(option.label)}
                      </option>
                    ))}
                    <option value="custom">{t('Custom (from source)')}</option>
                  </select>
                </Row>
              ))}
            </Section>

            <Section title={t('Type scale')}>
              {TYPE_KEYS.map(({ key, label, min, max }) => (
                <SliderRow
                  key={key}
                  label={t(label)}
                  value={draft.typeScale[key]}
                  min={min}
                  max={max}
                  step={2}
                  suffix="px"
                  onChange={(value) =>
                    update((d) => {
                      d.typeScale[key] = value;
                    })
                  }
                />
              ))}
            </Section>

            <Section title={t('Page')}>
              <SliderRow
                label={t('Margin')}
                value={draft.margin}
                min={32}
                max={140}
                step={2}
                suffix="px"
                onChange={(value) =>
                  update((d) => {
                    d.margin = value;
                  })
                }
              />
              <SliderRow
                label={t('Leading')}
                value={draft.leading}
                min={1.2}
                max={2}
                step={0.05}
                onChange={(value) =>
                  update((d) => {
                    d.leading = Number(value.toFixed(2));
                  })
                }
              />
              <SliderRow
                label={t('Radius')}
                value={draft.radius}
                min={0}
                max={24}
                step={1}
                suffix="px"
                onChange={(value) =>
                  update((d) => {
                    d.radius = value;
                  })
                }
              />
            </Section>

            {draft.typeScale.body < 12 && (
              <p className="mt-3 rounded-md border border-border bg-muted px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
                {t('Body under 12px prints below 9pt — hard to read on paper.')}
              </p>
            )}
          </>
        )}
      </div>

      <footer className="flex-none border-border border-t p-3">
        {error && <p className="mb-2 text-[0.6875rem] text-muted-foreground">{t(error)}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={commit}
            disabled={!dirty || committing}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {committing && <Loader2 className="size-3.5 animate-spin" />}
            {t('Save to source')}
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || committing}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
          >
            {t('Discard')}
          </button>
        </div>
      </footer>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 text-[0.625rem] text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 flex-none text-xs">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-foreground"
      />
      <span className="w-12 flex-none text-right font-mono text-[0.6875rem] tabular-nums">
        {value}
        {suffix}
      </span>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
