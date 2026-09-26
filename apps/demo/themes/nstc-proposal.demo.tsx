import { type DesignSystem, type DocPage, useDocPageNumber } from '@open-document/core';
import type { CSSProperties, ReactNode } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#1a1a1a',
    muted: '#5a6472',
    accent: '#1b3a6b',
    rule: '#d4d9e0',
  },
  fonts: {
    heading: '"Noto Sans TC", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif',
    body: '"Noto Serif TC", "Songti TC", "PMingLiU", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 34, h1: 22, h2: 18, h3: 16, body: 16, caption: 12 },
  margin: 76,
  leading: 1.75,
  radius: 2,
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
  fontWeight: 600,
  color: 'var(--od-accent)',
  lineHeight: 1.4,
  margin: '0 0 12px',
};

const h2: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h2)',
  fontWeight: 600,
  lineHeight: 1.45,
  margin: '22px 0 8px',
};

const CoverField = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      gap: 12,
      padding: '7px 0',
      borderBottom: '1px solid var(--od-rule)',
    }}
  >
    <span
      style={{
        flex: 'none',
        width: 128,
        fontFamily: 'var(--od-font-heading)',
        fontSize: 14,
        color: 'var(--od-muted)',
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1 }}>{value}</span>
  </div>
);

const Th = ({ children }: { children: ReactNode }) => (
  <th
    style={{
      textAlign: 'left',
      fontFamily: 'var(--od-font-heading)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--od-accent)',
      borderBottom: '1.5px solid var(--od-accent)',
      padding: '0 10px 6px',
    }}
  >
    {children}
  </th>
);

const Td = ({ children }: { children: ReactNode }) => (
  <td
    style={{
      fontSize: 14,
      padding: '7px 10px',
      borderBottom: '1px solid var(--od-rule)',
      verticalAlign: 'top',
    }}
  >
    {children}
  </td>
);

const Caption = ({ no, children }: { no: string; children: ReactNode }) => (
  <div
    style={{
      fontFamily: 'var(--od-font-heading)',
      fontSize: 'var(--od-size-caption)',
      color: 'var(--od-muted)',
      textAlign: 'center',
      margin: '6px 0 14px',
    }}
  >
    {no}　{children}
  </div>
);

const Ref = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontSize: 14,
      lineHeight: 1.6,
      paddingLeft: '2em',
      textIndent: '-2em',
      marginBottom: 6,
    }}
  >
    {children}
  </div>
);

const Footer = () => {
  const n = useDocPageNumber();
  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 40,
        paddingTop: 8,
        borderTop: '1px solid var(--od-rule)',
        textAlign: 'center',
        fontFamily: 'var(--od-font-heading)',
        fontSize: 'var(--od-size-caption)',
        color: 'var(--od-muted)',
      }}
    >
      - {n} -
    </div>
  );
};

const Cover: DocPage = () => (
  <div style={page}>
    <div
      style={{
        fontFamily: 'var(--od-font-heading)',
        fontSize: 15,
        color: 'var(--od-muted)',
        textAlign: 'center',
        letterSpacing: '0.1em',
      }}
    >
      國家科學及技術委員會專題研究計畫
    </div>
    <div
      style={{
        height: 2,
        background: 'var(--od-accent)',
        margin: '14px auto 56px',
        width: 88,
      }}
    />

    <div
      style={{
        fontFamily: 'var(--od-font-heading)',
        fontSize: 'var(--od-size-title)',
        fontWeight: 600,
        lineHeight: 1.45,
        textAlign: 'center',
        marginBottom: 12,
      }}
    >
      範例計畫名稱：
      <br />
      本頁為 theme 預覽，非真實計畫書
    </div>
    <div
      style={{
        textAlign: 'center',
        color: 'var(--od-muted)',
        fontSize: 14,
        marginBottom: 56,
      }}
    >
      A Sample Proposal Title for Theme Preview
    </div>

    <CoverField label="計畫類別" value="■ 個別型計畫　□ 整合型計畫" />
    <CoverField label="計畫編號" value="NSTC 000-0000-X-000-000-" />
    <CoverField label="執行期間" value="中華民國115年8月1日至116年7月31日" />
    <CoverField label="執行機構" value="範例大學範例學系" />
    <CoverField label="計畫主持人" value="王小明 教授" />
    <CoverField label="計畫參與人員" value="碩士級專任助理 1 名、兼任助理 2 名" />
    <CoverField label="報告類型" value="精簡報告" />

    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 84,
        textAlign: 'center',
        fontFamily: 'var(--od-font-heading)',
        fontSize: 15,
      }}
    >
      中華民國 115 年 8 月 16 日
    </div>
  </div>
);

const Content: DocPage = () => (
  <div style={page}>
    <h1 style={h1}>一、研究計畫之背景及目的</h1>
    <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
      國內中小型醫療院所的病歷結構化程度不一，既有的自然語言處理模型多以英文語料訓練，直接套用於中文病歷時，實體辨識的召回率明顯下降。本計畫擬以去識別化的中文門診紀錄為基礎，建立適用於繁體中文臨床文本的實體辨識與關聯抽取流程。
    </p>

    <h2 style={h2}>(一) 研究問題</h2>
    <p style={{ margin: '0 0 10px', textAlign: 'justify' }}>
      現行做法在標註成本與模型泛化之間難以取捨：全人工標註品質高但無法規模化，弱監督標註成本低卻引入大量雜訊。本計畫的核心問題是——在標註預算固定的前提下，如何配置人工與弱監督標註的比例，使下游任務表現最佳。
    </p>

    <h2 style={h2}>(二) 預期進度</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 0' }}>
      <thead>
        <tr>
          <Th>期程</Th>
          <Th>工作項目</Th>
          <Th>預期產出</Th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <Td>第 1–3 月</Td>
          <Td>語料蒐集與去識別化流程建置</Td>
          <Td>去識別化語料 5,000 筆</Td>
        </tr>
        <tr>
          <Td>第 4–7 月</Td>
          <Td>標註準則制定與標註者一致性測試</Td>
          <Td>標註手冊、Kappa ≥ 0.8</Td>
        </tr>
        <tr>
          <Td>第 8–10 月</Td>
          <Td>模型訓練與標註比例消融實驗</Td>
          <Td>實驗結果與基線比較</Td>
        </tr>
        <tr>
          <Td>第 11–12 月</Td>
          <Td>成果整理與論文撰寫</Td>
          <Td>研討會論文 1 篇</Td>
        </tr>
      </tbody>
    </table>
    <Caption no="表 1">本計畫預期執行進度與產出</Caption>

    <h1 style={{ ...h1, marginTop: 4 }}>二、參考文獻</h1>
    <Ref>
      林小華、陳大同（2024）。〈繁體中文臨床文本之實體辨識研究〉。《範例資訊學刊》，12(3)，45–68。
    </Ref>
    <Ref>
      Sample, A., &amp; Example, B. (2023). Weak supervision for clinical entity recognition.
      <i>Journal of Placeholder Studies</i>, 8(2), 101–124.
    </Ref>

    <Footer />
  </div>
);

export default [Cover, Content] satisfies DocPage[];
