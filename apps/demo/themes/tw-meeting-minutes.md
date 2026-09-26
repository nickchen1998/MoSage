---
name: 會議紀錄
description: 機關與公司通用的會議紀錄：標楷體、一至十的固定欄位、討論事項的案由／說明／決議，以及決議事項追蹤表。
pageSize: A4
mode: light
---

# 會議紀錄

## When to use

機關或公司內部會議、協調會、工作會報的會議紀錄，也適合隨函檢送的正式紀錄。和「台灣公文（函）」同一套字體與邊界，兩者可以一起發文。

不要用在逐字稿或訪談紀錄——這個 theme 記的是決議，不是發言內容。

> 名詞寫「紀錄」（會議紀錄、紀錄人），動詞才寫「記錄」。

## Palette

| Role   | Value     | Notes                       |
| ------ | --------- | --------------------------- |
| bg     | `#ffffff` | 白紙                        |
| text   | `#000000` | 全黑，會議紀錄為黑白列印    |
| muted  | `#444444` | 附註等次要文字              |
| accent | `#000000` | 不使用彩色強調              |
| rule   | `#000000` | 追蹤表的格線                |

## Typography

- 全文使用**標楷體**。CSS stack：`'"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif'`
  - 公司內部使用時可改成微軟正黑體（`"Microsoft JhengHei", "PingFang TC", sans-serif`），其餘不變。
- 會議名稱：約 20pt（26 px）
- 本文：約 16pt（22 px）
- 追蹤表：18 px；頁碼：約 12pt（16 px）
- 字級取偶數 px。行高 1.5。

## Page setup

- A4 直式，四邊邊界 2.5 公分（94 px）。
- 頁碼置中於下緣：`第 N 頁，共 M 頁`。
- 實際文件的本文用 `flow()`，讓框架分頁：會議名稱、每個 `Entry`、每個 `Motion`、追蹤表各是一個區塊，頁尾傳給 `flow(..., { footer: Footer })`。

```tsx
const Body = flow(
  <>
    <Title>○○會議紀錄</Title>
    <Entry no="一、" label="時間">中華民國115年9月30日（星期三）下午2時</Entry>
    {/* … */}
    <Motion no="第一案" proposer="秘書室" subject="…" resolution="…" />
  </>,
  { footer: Footer },
);

export default [Body] satisfies DocEntry[];
```

## Design const

```tsx
export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#444444',
    accent: '#000000',
    rule: '#000000',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 26, h1: 22, h2: 22, h3: 22, body: 22, caption: 16 },
  margin: 94,
  leading: 1.5,
  radius: 0,
};
```

## Fixed components

### 會議名稱

```tsx
const Title = ({ children }: { children: ReactNode }) => (
  <h1
    style={{
      fontFamily: 'var(--od-font-heading)',
      fontSize: 'var(--od-size-title)',
      fontWeight: 400,
      textAlign: 'center',
      letterSpacing: '0.2em',
      textIndent: '0.2em',
      margin: '0 0 24px',
    }}
  >
    {children}
  </h1>
);
```

格式為「機關（單位）名稱＋年度＋會議名稱＋會議紀錄」，例：「範例機關115年第3次業務協調會議紀錄」。

### 欄位（一、時間 … 十、散會）

序號獨立一欄，續行對齊欄位名稱而不是序號。

```tsx
const Entry = ({ no, label, children }: { no: string; label: string; children?: ReactNode }) => (
  <div style={{ display: 'flex', marginTop: 6 }}>
    <span style={{ flex: 'none', width: '2em' }}>{no}</span>
    <div style={{ flex: 1 }}>
      {label}：{children}
    </div>
  </div>
);
```

主持人與紀錄同一行：

```tsx
const ChairAndClerk = ({ chair, clerk }: { chair: string; clerk: string }) => (
  <div style={{ display: 'flex', marginTop: 6 }}>
    <span style={{ flex: 'none', width: '2em' }}>三、</span>
    <div style={{ flex: 1, display: 'flex' }}>
      <span style={{ flex: 1 }}>主持人：{chair}</span>
      <span style={{ flex: 1 }}>紀錄：{clerk}</span>
    </div>
  </div>
);
```

欄位依序為：

| 序號 | 欄位 | 寫法 |
| --- | --- | --- |
| 一、 | 時間 | 中華民國紀年＋星期＋上午／下午，例：中華民國115年9月30日（星期三）下午2時 |
| 二、 | 地點 | 會議室全名 |
| 三、 | 主持人／紀錄 | 姓名＋職稱；部分機關稱「主席」，依本機關慣例 |
| 四、 | 出席人員 | 人數多時寫「如簽到表」 |
| 五、 | 列席人員 | 沒有就寫「無」 |
| 六、 | 主持人致詞 | 沒有要點就寫「略」 |
| 七、 | 報告事項 | 以（一）（二）分項，每項先寫報告單位 |
| 八、 | 討論事項 | 每案用 `Motion` |
| 九、 | 臨時動議 | 格式同討論事項；沒有就寫「無」 |
| 十、 | 散會 | 時間，例：下午3時40分 |

### 條列項目

```tsx
const Item = ({ no, children }: { no: string; children: ReactNode }) => (
  <div style={{ display: 'flex' }}>
    <span style={{ flex: 'none', minWidth: '2.6em' }}>{no}</span>
    <span style={{ flex: 1 }}>{children}</span>
  </div>
);
```

層級用語：`一、二、` → `（一）（二）` → `1. 2.` → `(1) (2)`。

### 討論事項（案由／說明／決議）

```tsx
const Labeled = ({ name, children }: { name: string; children: ReactNode }) => (
  <div style={{ display: 'flex' }}>
    <span style={{ flex: 'none' }}>{name}：</span>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

const Motion = ({
  no,
  proposer,
  subject,
  notes,
  resolution,
}: {
  no: string;
  proposer: string;
  subject: ReactNode;
  notes?: ReactNode;
  resolution: ReactNode;
}) => (
  <div style={{ marginLeft: '2em', marginTop: 10 }}>
    <div style={{ display: 'flex' }}>
      <span style={{ flex: 1 }}>{no}</span>
      <span>提案單位：{proposer}</span>
    </div>
    <Labeled name="案由">{subject}</Labeled>
    {notes && <Labeled name="說明">{notes}</Labeled>}
    <Labeled name="決議">{resolution}</Labeled>
  </div>
);
```

### 決議事項追蹤表

```tsx
const cell: CSSProperties = {
  border: '1px solid var(--od-rule)',
  padding: '4px 8px',
  verticalAlign: 'top',
};

const FollowUp = ({ rows }: { rows: { task: string; owner: string; due: string }[] }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18, lineHeight: 1.5, marginTop: 8 }}>
    <thead>
      <tr>
        <th style={{ ...cell, width: '3em', fontWeight: 400 }}>項次</th>
        <th style={{ ...cell, fontWeight: 400 }}>決議事項</th>
        <th style={{ ...cell, width: '6em', fontWeight: 400 }}>負責單位</th>
        <th style={{ ...cell, width: '6em', fontWeight: 400 }}>完成期限</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={row.task}>
          <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
          <td style={cell}>{row.task}</td>
          <td style={{ ...cell, textAlign: 'center' }}>{row.owner}</td>
          <td style={{ ...cell, textAlign: 'center' }}>{row.due}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
```

追蹤表超過一頁時，拆成兩個表格並重複表頭——`flow()` 不會拆開單一區塊。

### 頁碼

```tsx
const Footer = () => {
  const n = useDocPageNumber();
  const total = useDocPageCount();
  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 44,
        textAlign: 'center',
        fontSize: 'var(--od-size-caption)',
      }}
    >
      第 {n} 頁，共 {total} 頁
    </div>
  );
};
```

## 撰寫要點

- **決議要能執行。** 寫清楚做什麼、誰做、何時完成：「照案通過，自115年11月1日起施行。」「請資訊室於10月15日前完成教育訓練。」不要只寫「原則同意」「再議」而沒有下一步。
- 常用決議語：照案通過、修正通過、准予備查、洽悉、保留、不予通過、另案討論。
- **說明寫事實與理由，不寫發言經過。** 「經熱烈討論」「與會人員踴躍發言」都不必寫。
- 報告事項只記要點與待辦；報告全文放附件。
- 案由結尾用「提請討論」「提請核議」「報請公鑒」等期望語。

## Rules

- 十個欄位的順序固定；沒有內容的欄位寫「無」或「略」，不要刪掉序號。
- 日期一律用中華民國紀年。
- 全文不使用粗體、斜體、底線或彩色；需要強調時改寫句子。
- 追蹤表的每一列都要有負責單位與完成期限。
- 決議與追蹤表的內容要一致：決議裡交辦的事項都要出現在追蹤表。
