---
name: 國科會研究計畫書
description: 國科會（NSTC）專題研究計畫書與學術報告的版面：宋體內文、黑體標題、章節「一、(一) 1.」三層編號、表圖編號與參考文獻懸掛縮排。
pageSize: A4
mode: light
---

# 國科會研究計畫書

## When to use

國科會專題研究計畫申請書（研究計畫內容 C801）、期中／期末成果報告，以及格式相近的校內研究計畫、系所學位論文提案、學術研討會全文。

不要用在對外簡報、產業提案或行銷文件——這個 theme 的密度是為了在有限頁數內塞進審查所需的資訊，字級偏小、行距偏鬆，用在需要視覺說服力的場合會顯得沉悶。

> **頁數與欄位以當年度公告的計畫書格式為準。** 國科會逐年微調表格欄位與頁數上限，套用前請與該年度的申請書範本核對。

## Palette

| Role   | Value     | Notes                                |
| ------ | --------- | ------------------------------------ |
| bg     | `#ffffff` | 白紙，審查多為黑白列印               |
| text   | `#1a1a1a` | 內文                                 |
| muted  | `#5a6472` | 圖表說明、頁碼、附註                 |
| accent | `#1b3a6b` | 章節標題、表頭底線；深藍在黑白列印為深灰 |
| rule   | `#d4d9e0` | 表格格線、分隔線                     |

Supporting colors：甘特圖／進度條填色 `#1b3a6b`，未執行區間 `#e8ebf0`。除此之外全文不使用彩色。

## Typography

- Heading font：`'"Noto Sans TC", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif'` — weight 600。
- Body font：`'"Noto Serif TC", "Songti TC", "PMingLiU", serif'` — weight 400。中文學術文件內文用宋體是慣例，標題改黑體才拉得開層級。
- Mono font：`ui-monospace, "SF Mono", Menlo, monospace` — 只用於程式碼、資料集代號。
- Type scale（px at 96dpi）：title 34 · h1 22 · h2 18 · h3 16 · body 16 · caption 12。
- 行距 1.75。學術文件行距鬆一點，審查委員才好在行間手寫註記。

## Page setup

- A4 直式（794 × 1123 px）。
- 四邊邊界 76 px（2 公分）。
- 頁碼置中於下緣，格式為 `- 3 -`，上方一條 `rule` 細線。
- 封面單獨一頁：計畫類別、計畫編號、執行期間、執行機構、主持人、參與人員、報告類型、中華民國紀年日期。
- 內文自封面次頁起連續編號。

## Design const

```tsx
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

const h3: CSSProperties = {
  fontFamily: 'var(--od-font-heading)',
  fontSize: 'var(--od-size-h3)',
  fontWeight: 600,
  lineHeight: 1.5,
  margin: '16px 0 6px',
};
```

### 封面欄位表

```tsx
const CoverField = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--od-rule)' }}>
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
```

### 表格

```tsx
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
```

### 表號／圖號

表在上、圖在下——中文學術慣例與英文相同。編號連續，不隨章節重編。

```tsx
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
```

### 參考文獻（懸掛縮排）

```tsx
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
```

### 頁碼

```tsx
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
```

## Rules

- **章節編號三層**：`一、` → `(一)` → `1.`。第四層用 `(1)`。編號後不加空格，直接接標題。
- 封面不編頁碼，內文從 `- 1 -` 起算。
- 全文不使用粗體強調；需要強調時用 `accent` 色的小標題另起一段。
- 表格一律無直線，只有表頭底線與列間細線（三線表）。
- 參考文獻用 APA 第 7 版，中文文獻在前、英文在後，各自依作者筆畫／字母排序。
- 圖表都要在內文被引用過（「如表 1 所示」），沒被引用的圖表就該刪掉。
