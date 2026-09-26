---
name: 法院民事書狀
description: 台灣法院民事書狀的版面：標楷體、案號股別欄、當事人欄表格、訴之聲明與事實理由條列、證物清單、此致法院與具狀人署名。
pageSize: A4
mode: light
---

# 法院民事書狀

## When to use

向地方法院、高等法院遞送的民事書狀——起訴狀、答辯狀、準備書狀、上訴狀、聲請狀。刑事告訴狀與行政訴訟起訴狀的欄位略有不同，但版面結構可以沿用。

不要用在律師事務所對客戶的法律意見書或備忘錄——那些是商務文件，用 `corporate-neutral` 這類 theme 才對。書狀是要遞進法院的，格式的功能是讓書記官與法官快速定位欄位，不是傳達事務所風格。

> **本 theme 只處理版面，不處理法律內容。** 各法院對書狀格式（尤其電子遞狀）另有規定，實際遞狀前請依受理法院公告的書狀範例核對欄位。

## Palette

| Role   | Value     | Notes                          |
| ------ | --------- | ------------------------------ |
| bg     | `#ffffff` | 白紙                           |
| text   | `#000000` | 全文黑字                       |
| muted  | `#3f3f3f` | 附註、頁碼                     |
| accent | `#000000` | 書狀不使用彩色強調             |
| rule   | `#000000` | 當事人欄格線，黑色實線         |

書狀不得使用彩色。螢光標示、彩色底線在正式遞狀時應全部移除。

## Typography

- 全文使用**標楷體**：`'"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif'`。
- 狀別（民事起訴狀）：約 22pt（28 px），置中，字距 `0.3em`。
- 本文：約 16pt（21 px）。
- 案號欄、證物清單、頁碼：約 12pt（16 px）。
- 行距 1.7——書狀行距要寬，法官會在行間畫線註記。

## Page setup

- A4 直式，橫書由左至右。
- 四邊邊界 85 px（約 2.25 公分）。
- 頁碼置中於下緣：`第 N 頁／共 M 頁`。
- 首頁順序固定：狀別 → 案號股別 → 當事人欄 → 案由句 → 訴之聲明 → 事實及理由 → 證物 → 此致法院 → 具狀人 → 日期。
- 續頁不重複狀別，直接續寫本文。

## Design const

```tsx
export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#3f3f3f',
    accent: '#000000',
    rule: '#000000',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 28, h1: 21, h2: 21, h3: 21, body: 21, caption: 16 },
  margin: 85,
  leading: 1.7,
  radius: 0,
};
```

## Fixed components

### 狀別

```tsx
const BriefTitle = ({ children }: { children: ReactNode }) => (
  <h1
    style={{
      fontSize: 'var(--od-size-title)',
      fontWeight: 400,
      textAlign: 'center',
      letterSpacing: '0.3em',
      textIndent: '0.3em',
      margin: '0 0 14px',
    }}
  >
    {children}
  </h1>
);
```

### 案號與股別

```tsx
const CaseNo = ({ no, division }: { no: string; division: string }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 24,
      fontSize: 'var(--od-size-caption)',
      marginBottom: 10,
    }}
  >
    <span>案　號：{no}</span>
    <span>股　別：{division}</span>
  </div>
);
```

### 當事人欄

四欄表格（稱謂／姓名或名稱／身分證統一編號／住居所），黑色實線外框。原告被告各一列，有法定代理人或訴訟代理人時往下加列。

```tsx
const partyCell: CSSProperties = {
  border: '1px solid var(--od-rule)',
  padding: '5px 8px',
  fontSize: 18,
  verticalAlign: 'top',
};

const Party = ({ title, name, id, address }: { title: string; name: string; id: string; address: string }) => (
  <tr>
    <td style={{ ...partyCell, width: 92, textAlign: 'center' }}>{title}</td>
    <td style={{ ...partyCell, width: 110 }}>{name}</td>
    <td style={{ ...partyCell, width: 150 }}>{id}</td>
    <td style={partyCell}>{address}</td>
  </tr>
);
```

### 段落與條列

書狀的段名（訴之聲明、事實及理由、證物名稱及件數）獨立成行，項目以 `一、二、` 起頭，續行對齊項目文字。

```tsx
const Head = ({ children }: { children: ReactNode }) => (
  <div style={{ marginTop: 18, marginBottom: 4 }}>{children}</div>
);

const Item = ({ no, children }: { no: string; children: ReactNode }) => (
  <div style={{ display: 'flex', marginBottom: 4 }}>
    <span style={{ flex: 'none', width: '2.6em' }}>{no}</span>
    <span style={{ flex: 1, textAlign: 'justify' }}>{children}</span>
  </div>
);

const SubItem = ({ no, children }: { no: string; children: ReactNode }) => (
  <div style={{ display: 'flex', marginBottom: 4, paddingLeft: '2.6em' }}>
    <span style={{ flex: 'none', width: '2.8em' }}>{no}</span>
    <span style={{ flex: 1, textAlign: 'justify' }}>{children}</span>
  </div>
);
```

### 此致法院

`此致` 頂格，法院名稱下一行縮排，末尾加「公鑒」。

```tsx
const ToCourt = ({ court }: { court: string }) => (
  <div style={{ marginTop: 20 }}>
    <div>此　致</div>
    <div style={{ paddingLeft: '2em' }}>{court}　公鑒</div>
  </div>
);
```

### 具狀人與日期

```tsx
const Signer = ({ title, name }: { title: string; name: string }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
    <span>{title}</span>
    <span style={{ minWidth: '8em', borderBottom: '1px solid var(--od-rule)' }}>{name}</span>
    <span style={{ fontSize: 'var(--od-size-caption)', alignSelf: 'flex-end' }}>（簽名蓋章）</span>
  </div>
);

const DateLine = ({ children }: { children: ReactNode }) => (
  <div style={{ textAlign: 'center', marginTop: 22, letterSpacing: '0.15em' }}>{children}</div>
);
```

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
        bottom: 40,
        textAlign: 'center',
        fontSize: 'var(--od-size-caption)',
        color: 'var(--od-muted)',
      }}
    >
      第 {n} 頁／共 {total} 頁
    </div>
  );
};
```

## Rules

- **訴之聲明必須可以直接抄進判決主文**：金額、利息起算日、負擔訴訟費用的一方，全部寫明確，不留「等語」。
- 事實及理由逐項對應訴之聲明，每項末尾引用證據（「證一」「證二」）。
- 證物清單只列名稱與件數，內容不在此展開。
- 日期一律用中華民國紀年，且年月日之間以全形空格拉開。
- 不使用粗體、底線、彩色；需要強調的事實靠段落位置與敘述順序處理。
- 續頁不重複狀別與當事人欄。
