import type { DesignSystem, DocPage } from 'mosage';
import type { CSSProperties } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#666666',
    accent: '#000000',
    rule: '#999999',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 32, h1: 22, h2: 22, h3: 18, body: 22, caption: 16 },
  margin: 38,
  leading: 1.5,
  radius: 0,
};

const mm = (n: number) => (n * 96) / 25.4;

const ENVELOPE_MM = { width: 220, height: 110 };
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
  lineHeight: 'var(--od-leading)',
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
      right: mm(8),
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
  salutation = '收',
  from,
  guides = true,
}: {
  to: Party;
  /** 稱謂：先生、女士、經理… */
  title: string;
  /** 啟封詞：收、台啟、鈞啟… */
  salutation?: string;
  from: Party;
  /** 郵票框與郵遞區號格。印在已印好這些的市售信封上時設為 false。 */
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
      <div
        style={{
          position: 'absolute',
          left: mm(10),
          top: mm(10),
          width: mm(100),
          fontSize: 'var(--od-size-h3)',
        }}
      >
        <div>
          {from.postal}　{from.address}
        </div>
        <div>{from.name}</div>
      </div>
      {guides && <StampBox />}
      <PostalBoxes
        code={to.postal}
        box={{ width: 6, height: 7.5 }}
        fontSize="var(--od-size-body)"
        guides={guides}
        style={{ left: mm(80), top: mm(42) }}
      />
      <div
        style={{
          position: 'absolute',
          left: mm(80),
          top: mm(54),
          width: mm(128),
          fontSize: 'var(--od-size-body)',
        }}
      >
        <div>{to.address}</div>
        <div style={{ marginTop: mm(2) }}>
          <span style={{ fontSize: 'var(--od-size-title)', letterSpacing: '0.2em' }}>
            {to.name}
          </span>
          {title}　{salutation}
        </div>
      </div>
      <CropMarks />
    </div>
  </div>
);

const SENDER: Party = {
  postal: '100001',
  address: '臺北市範例區範例路一段1號3樓',
  name: '範例股份有限公司　人力資源部',
};

const Personal: DocPage = () => (
  <Envelope
    to={{ postal: '220001', address: '新北市範例區和平路二段88號5樓', name: '王大明' }}
    title="先生"
    from={SENDER}
  />
);

const Preprinted: DocPage = () => (
  <Envelope
    to={{ postal: '300001', address: '新竹市範例區光復路二段101號', name: '陳美玲' }}
    title="經理"
    salutation="台啟"
    from={SENDER}
    guides={false}
  />
);

export default [Personal, Preprinted] satisfies DocPage[];
