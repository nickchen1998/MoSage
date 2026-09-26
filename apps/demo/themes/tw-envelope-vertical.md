---
name: 直式信封
description: 中式直式信封：收件人郵遞區號在右上、地址在右側直書、姓名在中央紅框，寄件人在左下，郵票貼左上。一頁一個信封，可從 CSV 批次產生。
pageSize: A4
mode: light
---

# 直式信封

## When to use

印中式（直式）信封：邀請函、喜帖、謝函、正式的個人書信。一頁 A4 就是一個信封，收件人多時用 CSV 一次產生整疊。

公司往來、帳單、大量寄送用「橫式信封」——橫式的地址可以用阿拉伯數字，機器分揀也比較穩定。

## 怎麼印

MoSage 只輸出 A4，所以信封面是**以實際尺寸畫在 A4 正中央**，四角有裁切標記。兩種用法：

1. **印在 A4 上**：沿裁切標記裁下，貼在素面信封上；或直接當作信封的版面稿。
2. **直接印在信封上**：信封從手送紙匣送入，靠紙張導板置中。印表機的送紙方式各不相同，**先用一張白紙試印**，疊在信封上對光確認位置，再用 `SHIFT_MM` 微調。

市售信封尺寸不一。預設是 11 × 22 公分（DL，A4 三折剛好放入，也在中華郵政標準信封 12 × 23.5 公分的上限內）；**先量實際信封，再改 `ENVELOPE_MM`**。

已經印好紅框、郵遞區號格與郵票框的市售信封，把 `guides` 設成 `false`，只印文字。

## Palette

| Role   | Value     | Notes                               |
| ------ | --------- | ----------------------------------- |
| bg     | `#ffffff` | 白紙                                |
| text   | `#000000` | 所有文字                            |
| muted  | `#666666` | 郵票框、裁切標記                    |
| accent | `#c0272d` | 中央紅框                            |
| rule   | `#c0272d` | 郵遞區號格，和紅框同色              |

## Typography

- 全文使用**標楷體**。CSS stack：`'"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif'`
- 字級對應 `typeScale`，改 Design 面板就會跟著變：
  - 收件人姓名：`title` 40 px
  - 稱謂與啟封詞：`h1` 28 px
  - 收件人地址、收件人郵遞區號：`body` 22 px
  - 寄件人地址與姓名：`h3` 18 px
  - 寄件人郵遞區號、「郵票」字樣：`caption` 16 px
- 直書用 `writing-mode: vertical-rl` 加 `text-orientation: upright`，數字與英文字母也會直立。

## Page setup

- A4 直式（794 × 1123 px）；信封面置中，文件的 `meta` 不必設 `orientation`。
- 位置以公釐計（`mm()` 換算成 px）；版面距離都相對於信封面，不是相對於 A4。
- 版面（信封面座標，公釐）：
  - 郵票框：左上，距上、左各 8，22 × 26
  - 收件人郵遞區號：右上，3 + 3 共 6 格，每格 6.5 × 8
  - 收件人地址：右側，自上方 24 起直書
  - 紅框：左 36、上 36，36 × 154；姓名在框內置中
  - 寄件人：左下直書，地址在右、姓名＋「緘」在左並靠下
  - 寄件人郵遞區號：左下，每格 5 × 6

## Design const

```tsx
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
```

## Fixed components

以下元件照抄即可；完整、可執行的版本就是 `themes/tw-envelope-vertical.demo.tsx`，建立文件時整份複製最快。

### 尺寸與型別

```tsx
const mm = (n: number) => (n * 96) / 25.4;

const ENVELOPE_MM = { width: 110, height: 220 };
const SHIFT_MM = { x: 0, y: 0 };

type Party = { postal: string; address: string; name: string };
```

### 裁切標記

標記畫在信封面**外側**，直接印在信封上時不會印到信封。

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
```

### 郵遞區號格

3 + 3 碼，中間多留一點間隔。`guides` 為 `false` 時格線透明，數字仍在原位。

```tsx
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

`sheet`、`vertical`、`StampBox` 與 `Envelope` 見 demo 檔；`Envelope` 的參數：

| 參數 | 說明 |
| --- | --- |
| `to` | 收件人 `{ postal, address, name }` |
| `title` | 稱謂：先生、女士、小姐、經理、教授… |
| `salutation` | 啟封詞，預設「台啟」 |
| `from` | 寄件人 `{ postal, address, name }`，姓名後自動加「緘」 |
| `guides` | 是否畫紅框、郵遞區號格與郵票框，預設 `true` |

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

- **地址用國字數字**：「二段八十八號五樓」，不寫「2段88號5樓」。直書的阿拉伯數字會一個一個直立排列，不易閱讀。
- **稱謂是寫給郵差看的**，用一般稱呼（先生、女士、經理），不寫「爸爸」「老師您好」這類只有收件人能用的稱呼。
- 啟封詞依關係選用：

  | 對象 | 啟封詞 |
  | --- | --- |
  | 平輩、一般往來 | 台啟、大啟 |
  | 長輩 | 安啟、鈞啟 |
  | 上級、機關首長 | 鈞啟 |
  | 晚輩 | 收、啟 |
  | 限本人拆閱 | 親啟 |

- **寄件人寫「緘」**，不寫「寄」或「敬上」；只寫姓也可以（「林緘」）。
- 郵遞區號用 3 + 3 碼（6 碼）；只知道 3 碼時填前 3 格即可。

## Rules

- 一頁一個信封；多位收件人就是多頁，不要把兩個信封擠在同一頁。
- 郵票位置留白：郵票框內不放任何文字，`guides={false}` 時也一樣。
- 不改變左上郵票、右上郵遞區號、中央姓名、左下寄件人的相對位置——這是郵局分揀與投遞的依據。
- 收件人地址不超過兩行（兩欄）；太長時縮短寫法，不要縮小字級。
- 改 `ENVELOPE_MM` 後，確認寄件人區塊與紅框沒有重疊。
