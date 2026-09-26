import type { DesignSystem, DocPage } from 'mosage';
import type { CSSProperties } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#666666',
    accent: '#c0272d',
    rule: '#c0272d',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 40, h1: 28, h2: 22, h3: 18, body: 22, caption: 16 },
  margin: 38,
  leading: 1.5,
  radius: 0,
};

const mm = (n: number) => (n * 96) / 25.4;

const ENVELOPE_MM = { width: 110, height: 220 };
const SHIFT_MM = { x: 0, y: 0 };

type Party = { postal: string; address: string; name: string };

const sheet: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--od-bg)',
  color: 'var(--od-text)',
  fontFamily: 'var(--od-font-body)',
};

const vertical: CSSProperties = {
  position: 'absolute',
  writingMode: 'vertical-rl',
  textOrientation: 'upright',
  lineHeight: 1.5,
};

const CropMarks = () => {
  const gap = mm(3);
  const len = mm(6);
  const line = '0.5px solid var(--od-muted)';
  const corners = [
    { top: 0, left: 0 },
    { top: 0, right: 0 },
    { bottom: 0, left: 0 },
    { bottom: 0, right: 0 },
  ] as const;
  return (
    <>
      {corners.map((c) => {
        const x = 'left' in c ? { left: -gap - len } : { right: -gap - len };
        const y = 'top' in c ? { top: -gap - len } : { bottom: -gap - len };
        return (
          <div key={Object.keys(c).join('-')}>
            <div style={{ position: 'absolute', ...c, ...x, width: len, borderTop: line }} />
            <div style={{ position: 'absolute', ...c, ...y, height: len, borderLeft: line }} />
          </div>
        );
      })}
    </>
  );
};

const PostalBoxes = ({
  code,
  box,
  fontSize,
  guides,
  style,
}: {
  code: string;
  box: { width: number; height: number };
  fontSize: string;
  guides: boolean;
  style: CSSProperties;
}) => (
  <div style={{ position: 'absolute', display: 'flex', gap: mm(1), ...style }}>
    {Array.from({ length: 6 }, (_, i) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: a box's position is its identity
        key={i}
        style={{
          width: mm(box.width),
          height: mm(box.height),
          marginLeft: i === 3 ? mm(2) : 0,
          border: guides ? '1px solid var(--od-rule)' : '1px solid transparent',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          fontSize,
          lineHeight: 1,
        }}
      >
        {code[i] ?? ''}
      </div>
    ))}
  </div>
);

const StampBox = () => (
  <div
    style={{
      position: 'absolute',
      left: mm(8),
      top: mm(8),
      width: mm(22),
      height: mm(26),
      border: '1px dashed var(--od-muted)',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--od-muted)',
      fontSize: 'var(--od-size-caption)',
    }}
  >
    郵票
  </div>
);

const Envelope = ({
  to,
  title,
  salutation = '台啟',
  from,
  guides = true,
}: {
  to: Party;
  /** 稱謂：先生、女士、經理… */
  title: string;
  /** 啟封詞：台啟、鈞啟、親啟… */
  salutation?: string;
  from: Party;
  /** 郵票框、郵遞區號格與紅框。印在已印好這些的市售信封上時設為 false。 */
  guides?: boolean;
}) => (
  <div style={sheet}>
    <div
      style={{
        position: 'relative',
        width: mm(ENVELOPE_MM.width),
        height: mm(ENVELOPE_MM.height),
        translate: `${mm(SHIFT_MM.x)}px ${mm(SHIFT_MM.y)}px`,
      }}
    >
      {guides && <StampBox />}
      <PostalBoxes
        code={to.postal}
        box={{ width: 6.5, height: 8 }}
        fontSize="var(--od-size-body)"
        guides={guides}
        style={{ right: mm(8), top: mm(8) }}
      />
      <div
        style={{
          ...vertical,
          right: mm(8),
          top: mm(24),
          height: mm(180),
          fontSize: 'var(--od-size-body)',
          letterSpacing: '0.1em',
        }}
      >
        {to.address}
      </div>
      <div
        style={{
          position: 'absolute',
          left: mm(36),
          top: mm(36),
          width: mm(36),
          height: mm(154),
          border: guides ? '1.5px solid var(--od-accent)' : 'none',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: mm(10),
        }}
      >
        <div style={{ writingMode: 'vertical-rl', textOrientation: 'upright', lineHeight: 1.2 }}>
          <span style={{ fontSize: 'var(--od-size-title)', letterSpacing: '0.3em' }}>
            {to.name}
          </span>
          <span style={{ fontSize: 'var(--od-size-h1)', marginInlineStart: '0.4em' }}>{title}</span>
          <span style={{ fontSize: 'var(--od-size-h1)', marginInlineStart: '0.8em' }}>
            {salutation}
          </span>
        </div>
      </div>
      <div
        style={{
          ...vertical,
          left: mm(8),
          bottom: mm(16),
          height: mm(90),
          fontSize: 'var(--od-size-h3)',
        }}
      >
        <div>{from.address}</div>
        <div style={{ textAlign: 'end' }}>{from.name}　緘</div>
      </div>
      <PostalBoxes
        code={from.postal}
        box={{ width: 5, height: 6 }}
        fontSize="var(--od-size-caption)"
        guides={guides}
        style={{ left: mm(8), bottom: mm(8) }}
      />
      <CropMarks />
    </div>
  </div>
);

const SENDER: Party = {
  postal: '100001',
  address: '臺北市範例區範例路一段一號三樓',
  name: '林小華',
};

const Personal: DocPage = () => (
  <Envelope
    to={{ postal: '220001', address: '新北市範例區和平路二段八十八號五樓', name: '王大明' }}
    title="先生"
    from={SENDER}
  />
);

const Preprinted: DocPage = () => (
  <Envelope
    to={{ postal: '300001', address: '新竹市範例區光復路二段一〇一號', name: '陳美玲' }}
    title="經理"
    from={SENDER}
    guides={false}
  />
);

export default [Personal, Preprinted] satisfies DocPage[];
