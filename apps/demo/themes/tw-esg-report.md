---
name: 台灣永續報告書
description: 上市櫃公司永續報告書（ESG）的版面：黑體全篇、森綠主色、章節編號色塊、數據卡、目標達成度條與 GRI 準則對照表。
pageSize: A4
mode: light
---

# 台灣永續報告書

## When to use

上市櫃公司依《上市公司編製與申報永續報告書作業辦法》編製的永續報告書、CSR 報告、TCFD 氣候相關財務揭露報告，以及對外的 ESG 成果簡報書面版。

不要用在財務報表附註、法說會簡報或內部管理報告——這個 theme 為了可讀性犧牲密度，一頁放不下太多數字；純數據的章節請改用表格為主的 theme。

> **揭露內容須對應查證範圍。** GRI 對照表所列的準則編號必須與實際揭露章節一致；報告書若經第三方確信，確信聲明書與範圍說明應另頁附上。

## Palette

| Role   | Value     | Notes                                    |
| ------ | --------- | ---------------------------------------- |
| bg     | `#ffffff` | 白紙                                     |
| text   | `#16211c` | 內文，帶一點綠調的深墨色                 |
| muted  | `#61736a` | 圖說、頁碼、次要欄位                     |
| accent | `#16704f` | 章節色塊、數據卡數值、進度條             |
| rule   | `#dfe6e1` | 表格格線、卡片外框                       |

Supporting colors：

- 環境 E `#16704f`、社會 S `#2b6cb0`、治理 G `#7c5cbf` — 章節標籤與圖表分色。
- 達標 `#15803d`、進行中 `#b7791f`、未達標 `#c05621` — 目標追蹤表狀態點。

## Typography

- Heading font：`'"Noto Sans TC", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif'` — weight 700。
- Body font：同上，weight 400。永續報告書全篇黑體，不混用襯線字。
- Mono font：`ui-monospace, "SF Mono", Menlo, monospace` — 只用於 GRI 準則編號欄。
- Type scale（px at 96dpi）：title 46 · h1 28 · h2 19 · h3 15 · body 14 · caption 10。
- 行距 1.65。

## Page setup

- A4 直式（794 × 1123 px）。
- 四邊邊界 72 px。
- 封面：上方 `accent` 色塊佔頁面約三分之一，報告年度反白置於色塊內；公司名稱與報告名稱置於色塊下方。
- 執行頁頁尾：左為公司名稱、右為頁碼，上方一條 `rule` 細線。
- 章節首頁以編號色塊（`01` `02`）開場，數字反白。

## Design const

```tsx
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
```

## Fixed components

### Page shell + headings

```tsx
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
```

### 章節編號色塊

```tsx
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
```

### 數據卡

三張一列。數值用 `accent`，單位縮小接在數值後，底下一行為與前一年度的比較。

```tsx
const Stat = ({ value, unit, label, delta }: { value: string; unit?: string; label: string; delta?: string }) => (
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
```

### 目標達成度條

```tsx
const Progress = ({ label, pct, note }: { label: string; pct: number; note?: string }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
      <span>{label}</span>
      <span style={{ color: 'var(--od-muted)' }}>{note ?? `${pct}%`}</span>
    </div>
    <div style={{ height: 6, borderRadius: 3, background: 'var(--od-rule)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--od-accent)' }} />
    </div>
  </div>
);
```

### GRI 對照表

```tsx
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
```

### 頁尾

```tsx
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
```

## Rules

- **每個數字都要有邊界**：單位、統計期間、涵蓋範圍（合併／單一廠區）三者缺一不可，寫在數據卡的 `label` 或圖說裡。
- 章節編號用兩位數 `01`–`0N`，E / S / G 各自獨立編號。
- 目標追蹤只放已公開承諾的目標，未達標就照實標示，不要改寫目標定義。
- GRI 對照表放在報告書最後，準則編號用等寬字，對應頁碼必須是實際頁碼。
- 照片與插圖佔滿版寬時，圖說靠左置於圖下方，用 `caption` 字級與 `muted` 色。
- 不使用漸層、陰影與立體圖表——查證單位看的是數字，不是視覺效果。
