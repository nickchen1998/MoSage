<p align="center">
  <img src=".github/assets/mosage-viewer.png" alt="MoSage 的文件檢視器：左側是大綱，中間以雙頁對開顯示實際尺寸的 A4 頁面" width="100%">
</p>

# MoSage

[![CI](https://github.com/nickchen1998/MoSage/actions/workflows/ci.yml/badge.svg)](https://github.com/nickchen1998/MoSage/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mosage?style=flat)](https://www.npmjs.com/package/mosage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](LICENSE)

**讓 AI 幫你做出「要印出來、要交出去」的文件。**
報告、企劃書、白皮書、操作手冊、研究成果——用說的描述你要什麼，Claude Code 或 Codex 會把內容寫成頁面；
MoSage 負責把頁面排進真實的紙張、自動分頁、維護目錄與頁碼，最後輸出成 PDF、可編輯的 Word，或單一 HTML 檔。

一切都是專案資料夾裡的檔案：不需要帳號，也沒有資料庫，可以直接用 git 管理。

## 三分鐘上手

```bash
npx mosage init my-docs    # 建立專案（預設會安裝相依套件並初始化 git）
cd my-docs
npm run dev                # 瀏覽器打開 http://localhost:5273
```

在同一個資料夾開啟你的 AI 工具（`claude` 或 `codex`），直接描述需要的文件：

> 幫我寫一份給主管看的 Q3 雲端成本檢討，大約 8 頁，數據在 data/costs.csv

AI 會先確認主題、讀者和資料來源——沒有資料就會問你，不會自己編數字——接著規劃頁面、動手撰寫。
你在瀏覽器裡看到的頁面，會隨著檔案變動即時更新。

## 為什麼不直接叫 AI 寫 Word？

AI 擅長寫文字和程式碼，卻很難精準操作 Word 的樣式、分頁和目錄。MoSage 讓 AI 用它最拿手的方式（React 元件）描述每一頁，
版面規則則由框架統一處理。你在瀏覽器裡確認成品，需要 Word 時再一鍵轉出——轉出的是使用 Word 原生樣式的文件，不是貼上去的圖片。

## 功能一覽

### 在瀏覽器裡閱讀、修改、留言

- 左側是頁面縮圖與大綱，中間是實際尺寸的紙張。可以切換**單頁連續**、**雙頁對開**、**格狀總覽**，也能搜尋文字、直接跳到某一頁。
- **Inspect**：點一下頁面上的文字就能直接改，修改會寫回原始檔；也可以留言給 AI，之後對 AI 說「處理留言」（`/apply-comments`），它會逐則處理並清掉留言標記。
- **Design**：即時調整配色、字型、字級、邊界與行距，滿意後寫回文件設定。
- 你正在看的頁面和選取的元素會寫進 `node_modules/.mosage/current.json`，所以可以直接對 AI 說「把這頁的表格改小一點」。

<p align="center">
  <img src=".github/assets/mosage-design.png" alt="Design 面板：在右側即時調整配色、字型、字級與邊界" width="100%">
</p>

### 版面交給框架

- **真實紙張**：一律使用 A4，可選直式或橫式。螢幕上的尺寸就是印出來的尺寸。
- **自動分頁**：用 `flow()` 包住連續的內文，框架會實際量測後排進頁面——標題不會孤零零留在頁尾、圖說跟著圖走、表格整張移到下一頁。封面、章節分隔頁則可以用固定頁面自己排。
- **自己維護的目錄與編號**：目錄頁碼、頁首頁尾的頁碼、註腳、圖表編號與交互參照都由框架計算。中間插入一張圖，後面的編號會自動更新。
- **資料驅動的表格**：`DataTable` 直接讀取 CSV／TSV 檔，更新資料檔，報告就跟著更新。

### 交件前先檢查

`mosage check` 會以實際尺寸渲染每一頁，列出超出紙張的內容、空白頁、落在頁尾的標題、太小的字、讀不到的圖片，並附上原始碼的行號；
發現錯誤時以非零狀態結束，可以直接放進 CI。

### 匯出

| 格式 | 適合的情境 |
| --- | --- |
| PDF | 最終成品，版面與瀏覽器看到的完全一致 |
| Word（.docx） | 要在 Word 裡審閱或交給別人修改：標題、清單、表格、註腳、目錄、頁首頁尾都轉成 Word 原生格式 |
| HTML | 單一檔案，直接開啟或列印 |
| PNG | 每一頁一張圖，可指定頁碼範圍 |

在瀏覽器右上角的 **Download** 選單匯出，或用指令 `mosage export <文件> --format docx`（指令匯出需要另外安裝 `playwright`）。

### 其他

- 主題（themes）與素材（assets）管理，文件可以用資料夾分類。
- `mosage import notes.md`：把既有的 Markdown 轉成一份文件。
- `mosage build`：輸出靜態網站，可以直接部署。

## 內建的 AI skills

`mosage init` 會把以下 skills 裝進專案的 `.agents/skills`（Codex 等工具）與 `.claude/skills`（Claude Code）：

| Skill | 什麼時候用 |
| --- | --- |
| `create-doc` | 從零開始做一份文件：先釐清主題、讀者與資料來源，再規劃頁面、撰寫 |
| `doc-authoring` | 撰寫與修改頁面時的技術規範：紙張尺寸、字級、分頁、表格、圖片 |
| `current-doc` | 解讀「這一頁」「這個元素」——你在瀏覽器裡正在看的位置 |
| `apply-comments` | 處理你在 Inspect 模式留給 AI 的留言 |
| `create-theme` | 建立可重複使用的主題（配色、字型、元件樣式） |

升級 MoSage 後執行 `npx mosage sync:skills` 更新專案裡的 skills。

## 指令

| 指令 | 說明 |
| --- | --- |
| `npx mosage init [資料夾]` | 建立新專案（可加 `--no-install`、`--no-git`、`--use-pnpm` 等選項） |
| `mosage dev` | 開啟開發伺服器與檢視器 |
| `mosage check [文件…]` | 檢查版面問題 |
| `mosage export [文件…]` | 匯出 PDF／Word／HTML／PNG（`--format`、`--all`、`--out-dir`） |
| `mosage import <檔案.md>` | 把 Markdown 轉成文件 |
| `mosage build` / `mosage preview` | 輸出與預覽靜態網站 |
| `mosage sync:skills` | 更新專案裡的 AI skills |

## 一份文件長什麼樣子

每份文件是 `docs/<代號>/index.tsx`，預設匯出一個頁面陣列：

```tsx
import { type DocEntry, type DocMeta, flow, TableOfContents } from 'mosage';

const Cover = () => (
  <section style={{ padding: 96 }}>
    <h1>Q3 雲端成本檢討</h1>
    <p>基礎架構組 · 2026 年 10 月</p>
  </section>
);

const Contents = () => <TableOfContents />;

export const meta: DocMeta = { title: 'Q3 雲端成本檢討', pageSize: 'A4' };

export default [
  Cover,
  Contents,
  flow(
    <>
      <h2>摘要</h2>
      <p>本季雲端支出較上季成長 8%，主要來自……</p>
    </>,
  ),
] satisfies DocEntry[];
```

固定頁面（封面、目錄）是一個元件對應一張紙；`flow()` 裡的內容則交給框架分頁。

## 參與開發

```bash
pnpm install
pnpm dev          # 用本機的 mosage 執行 apps/demo
pnpm build
pnpm typecheck
pnpm check        # Biome
pnpm test         # Vitest
pnpm test:e2e     # Playwright
```

| 路徑 | 內容 |
| --- | --- |
| [packages/core](packages/core) | `mosage` 套件：檢視器、Vite 外掛、CLI、專案範本、AI skills |
| [apps/demo](apps/demo) | 開發用的範例專案 |

發佈流程與貢獻方式請見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致謝

MoSage 以 Simon Liu 的 [open-doc](https://github.com/simonliu-ai-product/open-doc)（MIT 授權）為基礎開發，
open-doc 的架構則源自 Yiwei Ho 的 [open-slide](https://github.com/open-slide/open-slide)。
MoSage 在此基礎上加入 Word 匯出與多頁檢視模式，整合為單一套件，並獨立維護。

## 授權

[MIT](LICENSE)
