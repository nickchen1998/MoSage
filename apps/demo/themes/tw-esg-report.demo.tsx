import {
  type DesignSystem,
  type DocPage,
  useDocPageCount,
  useDocPageNumber,
} from '@open-document/core';
import type { CSSProperties, ReactNode } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#16211c',
    muted: '#61736a',
    accent: '#16704f',
    rule: '#dfe6e1',
  },
  fonts: {
    heading: '"Noto Sans TC", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif',
    body: '"Noto Sans TC", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 46, h1: 28, h2: 19, h3: 15, body: 14, caption: 10 },
  margin: 72,
  leading: 1.65,
  radius: 8,
};

const page: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 'var(--od-margin)',
  background: 'var(--od-bg)',
  color: 'var(--od-text)',
  fontFamily: 'var(--od-font-body)',
  fontSize: 'var(--od-size-body)',
  lineHeight: 'var(--od-leading)',
  position: 'relative',
};

const h1: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h1)',
  fontWeight: 700,
  lineHeight: 1.25,
  letterSpacing: '-0.01em',
  margin: '0 0 14px',
};

const h2: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h2)',
  fontWeight: 700,
  lineHeight: 1.35,
  margin: '24px 0 8px',
};

const SectionNo = ({ no, label }: { no: string; label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 'var(--od-radius)',
        background: 'var(--od-accent)',
        color: '#ffffff',
        fontFamily: 'var(--od-font-heading)',
        fontSize: 20,
        fontWeight: 700,
      }}
    >
      {no}
    </span>
    <span
      style={{
        fontFamily: 'var(--od-font-heading)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: 'var(--od-muted)',
      }}
    >
      {label}
    </span>
  </div>
);

const Stat = ({
  value,
  unit,
  label,
  delta,
}: {
  value: string;
  unit?: string;
  label: string;
  delta?: string;
}) => (
  <div
    style={{
      flex: 1,
      border: '1px solid var(--od-rule)',
      borderRadius: 'var(--od-radius)',
      padding: '14px 16px',
    }}
  >
    <div
      style={{
        fontFamily: 'var(--od-font-heading)',
        fontSize: 30,
        fontWeight: 700,
        color: 'var(--od-accent)',
        lineHeight: 1.1,
      }}
    >
      {value}
      {unit && <span style={{ fontSize: 14, marginLeft: 3 }}>{unit}</span>}
    </div>
    <div style={{ fontSize: 12, marginTop: 6 }}>{label}</div>
    {delta && (
      <div style={{ fontSize: 'var(--od-size-caption)', color: 'var(--od-muted)', marginTop: 2 }}>
        {delta}
      </div>
    )}
  </div>
);

const Progress = ({ label, pct, note }: { label: string; pct: number; note?: string }) => (
  <div style={{ marginBottom: 12 }}>
    <div
      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--od-muted)' }}>{note ?? `${pct}%`}</span>
    </div>
    <div style={{ height: 6, borderRadius: 3, background: 'var(--od-rule)', overflow: 'hidden' }}>
      <div
        style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--od-accent)' }}
      />
    </div>
  </div>
);

const Th = ({ children, width }: { children: ReactNode; width?: number }) => (
  <th
    style={{
      width,
      textAlign: 'left',
      fontFamily: 'var(--od-font-heading)',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.06em',
      color: 'var(--od-muted)',
      borderBottom: '1px solid var(--od-rule)',
      padding: '0 8px 6px',
    }}
  >
    {children}
  </th>
);

const Td = ({ children, mono }: { children: ReactNode; mono?: boolean }) => (
  <td
    style={{
      fontSize: 12,
      fontFamily: mono ? 'var(--od-font-mono)' : undefined,
      padding: '7px 8px',
      borderBottom: '1px solid var(--od-rule)',
      verticalAlign: 'top',
    }}
  >
    {children}
  </td>
);

const Footer = ({ company }: { company: string }) => {
  const n = useDocPageNumber();
  const total = useDocPageCount();
  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 36,
        paddingTop: 8,
        borderTop: '1px solid var(--od-rule)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 'var(--od-size-caption)',
        color: 'var(--od-muted)',
      }}
    >
      <span>{company}</span>
      <span>
        {n} / {total}
      </span>
    </div>
  );
};

const Cover: DocPage = () => (
  <div style={{ ...page, padding: 0 }}>
    <div
      style={{
        height: 372,
        background: 'var(--od-accent)',
        color: '#ffffff',
        padding: 'var(--od-margin)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--od-font-heading)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.2em',
          opacity: 0.85,
        }}
      >
        SUSTAINABILITY REPORT
      </div>
      <div
        style={{
          fontFamily: 'var(--od-font-heading)',
          fontSize: 'var(--od-size-title)',
          fontWeight: 700,
          lineHeight: 1.1,
          marginTop: 6,
        }}
      >
        2025
      </div>
    </div>

    <div style={{ padding: 'var(--od-margin)' }}>
      <div style={{ ...h1, marginBottom: 6 }}>範例科技股份有限公司</div>
      <div style={{ ...h1, fontSize: 22, fontWeight: 400, color: 'var(--od-muted)' }}>
        永續報告書（theme 預覽，數據為虛構）
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 34 }}>
        <Stat
          value="38.2"
          unit="%"
          label="再生能源使用比例（合併，2025）"
          delta="較 2024 年 +9.4 個百分點"
        />
        <Stat
          value="12,480"
          unit="tCO₂e"
          label="範疇一＋二排放量（合併，2025）"
          delta="較基準年 −18.6%"
        />
        <Stat value="0.42" label="失能傷害頻率 FR（全廠，2025）" delta="較 2024 年 −0.11" />
      </div>

      <div
        style={{
          marginTop: 34,
          fontSize: 12,
          color: 'var(--od-muted)',
          lineHeight: 1.7,
        }}
      >
        報告期間：2025 年 1 月 1 日至 12 月 31 日
        <br />
        編製依據：GRI 準則 2021、SASB 電子設備製造業指標
        <br />
        發行日期：中華民國 115 年 6 月
      </div>
    </div>
  </div>
);

const Content: DocPage = () => (
  <div style={page}>
    <SectionNo no="01" label="ENVIRONMENT ・ 環境" />
    <h1 style={h1}>氣候治理與減碳路徑</h1>
    <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
      本公司以 2023 年為基準年，設定 2030 年範疇一與範疇二排放較基準年減少 42%
      的目標，並於董事會下設永續發展委員會，每季檢視減碳專案進度與資本支出配置。
    </p>

    <h2 style={h2}>年度目標達成情形</h2>
    <Progress label="再生能源使用比例（目標 40%）" pct={96} note="38.2% / 40%" />
    <Progress label="範疇一＋二減量（目標 −20%）" pct={93} note="−18.6% / −20%" />
    <Progress label="製程用水回收率（目標 85%）" pct={78} note="66.3% / 85%" />

    <h2 style={h2}>GRI 準則對照（節錄）</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <Th width={92}>準則</Th>
          <Th>揭露項目</Th>
          <Th width={70}>對應頁碼</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Td mono>302-1</Td>
          <Td>組織內部能源消耗量</Td>
          <Td mono>P.24</Td>
        </tr>
        <tr>
          <Td mono>305-1</Td>
          <Td>直接（範疇一）溫室氣體排放</Td>
          <Td mono>P.26</Td>
        </tr>
        <tr>
          <Td mono>305-2</Td>
          <Td>能源間接（範疇二）溫室氣體排放</Td>
          <Td mono>P.26</Td>
        </tr>
        <tr>
          <Td mono>403-9</Td>
          <Td>職業傷害</Td>
          <Td mono>P.41</Td>
        </tr>
      </tbody>
    </table>

    <Footer company="範例科技股份有限公司" />
  </div>
);

export default [Cover, Content] satisfies DocPage[];
