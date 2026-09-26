---
name: 橫式信封
description: 西式橫式信封：寄件人在左上、郵票貼右上、收件人郵遞區號與地址姓名在中央偏右。A4 橫式一頁一個信封，可從 CSV 批次產生。
pageSize: A4
orientation: landscape
mode: light
---

# 橫式信封

## When to use

公司與機關往來、帳單、通知、大量寄送。一頁 A4 就是一個信封，收件人多時用 CSV 一次產生整疊。

邀請函、喜帖、正式的個人書信用「直式信封」。

## 怎麼印

MoSage 只輸出 A4，所以信封面是**以實際尺寸畫在 A4 橫式的正中央**，四角有裁切標記。兩種用法：

1. **印在 A4 上**：沿裁切標記裁下，貼在素面信封上；或直接當作信封的版面稿。
2. **直接印在信封上**：信封從手送紙匣送入，靠紙張導板置中。印表機的送紙方式各不相同，**先用一張白紙試印**，疊在信封上對光確認位置，再用 `SHIFT_MM` 微調。

市售信封尺寸不一。預設是 22 × 11 公分（DL，A4 三折剛好放入，也在中華郵政標準信封 23.5 × 12 公分的上限內）；**先量實際信封，再改 `ENVELOPE_MM`**。

已經印好郵遞區號格與郵票框的市售信封，把 `guides` 設成 `false`，只印文字。

## Palette

| Role   | Value     | Notes                     |
| ------ | --------- | ------------------------- |
| bg     | `#ffffff` | 白紙                      |
| text   | `#000000` | 所有文字                  |
| muted  | `#666666` | 郵票框、裁切標記          |
| accent | `#000000` | 不使用彩色                |
| rule   | `#999999` | 郵遞區號格                |

## Typography

- 全文使用**標楷體**。CSS stack：`'"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif'`
  - 公司信封可改成微軟正黑體（`"Microsoft JhengHei", "PingFang TC", sans-serif`），其餘不變。
- 字級對應 `typeScale`，改 Design 面板就會跟著變：
  - 收件人姓名：`title` 32 px
  - 收件人地址、稱謂、啟封詞、收件人郵遞區號：`body` 22 px
  - 寄件人：`h3` 18 px
  - 「郵票」字樣：`caption` 16 px

## Page setup

- **A4 橫式**（1123 × 794 px）。使用這個 theme 的文件要在 `meta` 設 `orientation: 'landscape'`：

  ```tsx
  export const meta: DocMeta = {
    title: '信封',
    pageSize: 'A4',
    orientation: 'landscape',
    theme: 'tw-envelope-horizontal',
  };
  ```

- 位置以公釐計（`mm()` 換算成 px）；版面距離都相對於信封面，不是相對於 A4。
- 版面（信封面座標，公釐）：
  - 寄件人：左上，距上、左各 10；第一行郵遞區號＋地址，第二行名稱
  - 郵票框：右上，距上、右各 8，22 × 26
  - 收件人郵遞區號：左 80、上 42，3 + 3 共 6 格，每格 6 × 7.5
  - 收件人地址與姓名：左 80、上 54，寬 128

## Design const

```tsx
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
```

## Fixed components

以下元件照抄即可；完整、可執行的版本就是 `themes/tw-envelope-horizontal.demo.tsx`，建立文件時整份複製最快。

### 尺寸與型別

```tsx
const mm = (n: number) => (n * 96) / 25.4;

const ENVELOPE_MM = { width: 220, height: 110 };
const SHIFT_MM = { x: 0, y: 0 };

type Party = { postal: string; address: string; name: string };
```

### 裁切標記與郵遞區號格

`CropMarks` 與 `PostalBoxes` 和「直式信封」完全相同，兩個 theme 可以共用。標記畫在信封面**外側**，直接印在信封上時不會印到信封；`guides` 為 `false` 時郵遞區號格線透明，數字仍在原位。

```tsx
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
```

### 信封

`sheet`、`StampBox` 與 `Envelope` 見 demo 檔；`Envelope` 的參數：

| 參數 | 說明 |
| --- | --- |
| `to` | 收件人 `{ postal, address, name }` |
| `title` | 稱謂：先生、女士、經理、主任… |
| `salutation` | 啟封詞，預設「收」 |
| `from` | 寄件人 `{ postal, address, name }`；公司可寫「公司名稱　部門」 |
| `guides` | 是否畫郵遞區號格與郵票框，預設 `true` |

### 從 CSV 批次產生

把名單放在 `docs/<id>/assets/references/收件人.csv`（欄位：郵遞區號、地址、姓名、稱謂），每一列就是一頁：

```tsx
import recipients from './assets/references/收件人.csv';

const pages = recipients.map((r): DocPage => {
  const Page = () => (
    <Envelope
      to={{ postal: String(r.郵遞區號 ?? ''), address: String(r.地址 ?? ''), name: String(r.姓名 ?? '') }}
      title={String(r.稱謂 ?? '')}
      from={SENDER}
    />
  );
  return Page;
});

export default pages satisfies DocPage[];
```

## 書寫慣例

- 橫式地址用**阿拉伯數字**：「和平路二段88號5樓」；路段的「二段」仍寫國字。
- 收件人是公司時，第一行寫公司與部門，姓名行寫「職稱＋姓名」或「姓名＋職稱」，例：「王大明 經理 收」。
- 啟封詞：一般往來用「收」或「台啟」，限本人拆閱用「親啟」。
- 郵遞區號用 3 + 3 碼（6 碼）；只知道 3 碼時填前 3 格即可。

## Rules

- 一頁一個信封；多位收件人就是多頁，不要把兩個信封擠在同一頁。
- 郵票位置留白：郵票框內不放任何文字，`guides={false}` 時也一樣。
- 收件人區塊維持在信封中央偏右、郵票框下方，這是郵局分揀與投遞的依據。
- 收件人地址不超過兩行；太長時縮短寫法，不要縮小字級。
- 寄件人區塊不要延伸到收件人區塊的上方。
