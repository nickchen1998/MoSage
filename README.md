# MoSage

[![CI](https://github.com/nickchen1998/MoSage/actions/workflows/ci.yml/badge.svg)](https://github.com/nickchen1998/MoSage/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mosage)](https://www.npmjs.com/package/mosage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**繁體中文** · [English](README.en.md)

**和 AI 一起寫書、寫論文的本機寫作平台。** 用 Claude Code、Codex 等 AI 工具打開專案資料夾，
跟 AI 對話完成立項、訂書名、排大綱、撰寫與修訂；你在瀏覽器裡用「書本排版」閱讀成果、
選取文字留言給 AI、一鍵接受或拒絕 AI 的修改建議 —— 最後再匯出成出版社或學校要的 Word 檔。

```bash
npx mosage init my-writing
```

不需要資料庫，不需要帳號。所有內容都是專案資料夾裡的純文字檔（Markdown + YAML），圖片和參考資料直接複製進資料夾即可，
可以用 git 管理版本，也可以用任何編輯器打開。

## 為什麼

直接在 Word 裡寫長篇稿件，格式和內容總是攪在一起：一邊構思，一邊處理目錄頁碼、標題樣式和「追蹤修訂」。
AI 很擅長寫文字，但不擅長操作 Word。

MoSage 把兩件事分開：

- **寫作階段**：內容是 Markdown，AI 讀寫起來又快又準；你在瀏覽器裡看到的是排好版的書頁，而不是原始碼。
- **交稿階段**：一鍵輸出 Word，標題樣式、目錄、頁碼、註腳、圖說都幫你處理好。

## 特色

- 📚 **一個專案，很多本書**：`books/` 底下每個資料夾就是一本書或一篇論文，各自有設定、進度與風格。
- 🤖 **AI 帶你從零開始**：全新專案時，AI 會主動訪談你的寫作目的、讀者、風格與篇幅，再提出書名候選與章節架構。
- 🗂️ **大綱編排**：在瀏覽器裡拖曳章節順序、直接修改章名與摘要、設定每章狀態（構想／草稿／修訂中／完成）。
- 📖 **書本排版預覽**：首行縮排、行距、字型沿用 Word 匯出設定；單章閱讀或全書預覽。
- 💬 **留言給 AI**：選取任何文字 → 留言。留言以標記存進 Markdown，對 AI 說「處理留言」就會處理。
- ✍️ **修改建議，先看再決定**：AI 修改你寫好的文字時，會以「新舊對照」呈現，你按「接受」才會生效。
- ⚡ **即時同步**：AI 改檔案的同時，瀏覽器畫面自動更新 —— 看著 AI 一節一節寫。
- 🕰️ **自動版本紀錄**：每次內容改變前自動保存上一版，可比較差異、一鍵還原。
- 📍 **AI 知道你在看哪裡**：說「這段改短一點」，AI 會讀取你在瀏覽器裡正在看的段落與選取的文字。
- 📄 **匯出 Word**：真正的 Word 樣式（標題 1–4、內文、引文、圖說）、自動目錄、頁碼、註腳、表格、圖片；也能匯出 HTML（可列印成 PDF）與合併的 Markdown。
- 📥 **匯入舊稿**：`mosage import 書稿.docx` 依標題樣式把 Word 稿切成章節，圖片與註腳一併帶入。
- 🎓 **書與論文兩種預設**：論文預設標楷體＋Times New Roman 12pt、左邊界 3 公分，符合台灣常見的論文格式。

## 快速開始

需要 [Node.js](https://nodejs.org/) 20.19 以上。

```bash
npx mosage init my-writing     # 建立寫作專案
cd my-writing
npm run dev                    # 開啟寫作介面 → http://localhost:5280
```

另開一個終端機，在同一個資料夾啟動 AI 工具：

```bash
claude     # Claude Code
codex      # 或 OpenAI Codex
```

然後對 AI 說「**開始**」（Claude Code 也可以輸入 `/kickoff`）。

## 寫作流程

| 階段 | 你對 AI 說 | 發生什麼事 |
| --- | --- | --- |
| 1. 立項 | 「開始」 | AI 一次問一兩題：目的、類型、讀者、核心主張、風格、篇幅、既有素材。確認後建立 `books/<代號>/`、寫作企劃 `brief.md` 與風格指南 `STYLE.md` |
| 2. 大綱 | 「幫我訂書名和大綱」 | 提出 5 個書名與 2–3 種章節架構；定案後建立每章骨架（小節＋要點） |
| 3. 編排 | —— | 你在介面「大綱」頁拖曳排序、修改章名與摘要、新增或移出章節 |
| 4. 撰寫 | 「寫第一章」 | AI 讀企劃、風格與前後章，一節一節寫，畫面即時更新；需要你補充資料的地方會留言 |
| 5. 修訂 | 「處理留言」「幫我審這章」 | 你選取文字留言；AI 回以修改建議，你逐一接受或拒絕 |
| 6. 匯出 | —— | 介面右上角「匯出 → Word」，或 `npx mosage export <書> docx` |

寫到一半想改大綱？直接說，AI 會調整章節並保留已寫好的內容。想寫第二本？說「我想寫一本新書」。

## 專案結構

```
my-writing/
├── mosage.yaml              專案預設值：作者、AI 修改模式、共用匯出格式
├── AGENTS.md                給 AI 的協作守則（CLAUDE.md 會引用它）
├── .agents/skills/          AI skills（Codex 等工具讀這裡）
├── .claude/skills/          → 連到 .agents/skills（Claude Code 讀這裡）
├── notes/                   所有書共用的素材（作者簡介…）
├── books/
│   └── <代號>/
│       ├── book.yaml        類型、階段、書名、章節順序、Word 格式
│       ├── brief.md         寫作企劃
│       ├── STYLE.md         風格指南
│       ├── chapters/        01-xxx.md、02-xxx.md …
│       ├── assets/          圖片
│       └── notes/           這本書的參考資料（不會匯出）
├── output/<代號>/           匯出的 Word / HTML / Markdown
└── .mosage/                 目前閱讀位置、自動版本紀錄（不進 git）
```

章節檔就是一般的 Markdown：

```markdown
---
status: draft
summary: 這一章讓讀者理解……
---

# 第一章　出發

## 1.1 小節

正文，支援**粗體**、註腳[^1]、表格、圖片 ![圖說](../assets/fig.png)、
提示框 `> [!TIP]`、場景分隔 `---`、強制換頁 `<!-- pagebreak -->`。

[^1]: 註腳內容。
```

## AI Skills

| Skill | 用途 |
| --- | --- |
| `kickoff` | 立項訪談，建立新書、寫作企劃與風格指南 |
| `outline` | 書名候選、章節架構、章節骨架；寫作途中調整大綱 |
| `write-chapter` | 撰寫、續寫、擴寫章節 |
| `apply-comments` | 處理你在介面上的留言 |
| `review` | 以編輯角度審稿，只留意見與修改建議，不直接改稿 |
| `current-position` | 解讀「這段」「這章」—— 你在瀏覽器中正在看的位置 |
| `mosage-reference` | 檔案格式、標記語法、Markdown 支援範圍、指令 |

升級 mosage 後執行 `npx mosage sync-skills` 更新專案裡的 skills。

### 留言與修改建議的格式

兩者都是 HTML 註解，任何 Markdown 工具都看不見，也不會被匯出：

```markdown
<!-- mosage:comment id=c-1a2b3c4d by=human quote="被選取的文字"
這段太長，拆成兩段並舉個例子
-->
被留言的段落。

<!-- mosage:suggest by=ai note="刪除贅字"
AI 提議的新段落。按「接受」後取代下方這一段。
-->
原本的段落。
```

`mosage.yaml`（或單本的 `book.yaml`）的 `ai.editMode` 決定 AI 修改既有文字的方式：`suggest`（預設，修改建議）或 `direct`（直接改，仍有版本紀錄）。

## 指令

| 指令 | 說明 |
| --- | --- |
| `npx mosage init <資料夾>` | 建立寫作專案（`--no-install`、`--no-git`、`--author`） |
| `mosage dev` | 開啟寫作介面（`--port`、`--host`、`--no-open`） |
| `mosage new <代號>` | 新增一本書（`--title`、`--type book\|thesis\|other`） |
| `mosage status [書]` | 書架總覽，或單本書的章節、字數、待處理標記（`--json`） |
| `mosage export [書] [docx\|html\|md]` | 匯出到 `output/<書>/`（`--out`） |
| `mosage import <檔案.docx\|.md>` | 匯入舊稿（`--book`、`--title`、`--no-split`、`--unlisted`） |
| `mosage sync-skills` | 更新專案裡的 AI skills |

## Word 匯出設定

在 `book.yaml`（單本）或 `mosage.yaml`（全部的書）的 `export:` 調整：

```yaml
export:
  pageSize: A4            # A4 | A5 | B5 | Letter | { width: 170, height: 230 }（公釐）
  margins: { top: 25, bottom: 25, left: 30, right: 25 }
  fonts: { body: 標楷體, latin: Times New Roman, heading: 標楷體, code: Consolas }
  fontSize: 12            # pt
  lineSpacing: 1.5
  firstLineIndent: 2      # 首行縮排字數
  titlePage: true
  toc: true               # Word 開啟時會詢問是否更新目錄頁碼，選「是」
  header: title           # none | title | chapter
```

匯出的是使用 Word 內建樣式的文件，要改整體字型或段落，直接在 Word 裡修改「標題 1」「內文」等樣式即可。

## 常見問題

**需要資料庫或網路嗎？** 不需要。MoSage 只是在你的電腦上開一個讀寫專案資料夾的小伺服器（只接受本機連線）；AI 工具本身才需要網路。

**支援哪些 AI 工具？** Claude Code 與 OpenAI Codex 會自動讀取 skills。其他會讀 `AGENTS.md` 的工具也能照著守則工作。

**可以不用 AI 嗎？** 可以。介面裡能直接修改段落、編輯 Markdown 原始碼、編排大綱與匯出。

**我的稿子會不會被 AI 改壞？** 預設是「修改建議」模式，AI 的修改要你按接受才生效；另外每次變動前都會自動保存版本，可以在「版本紀錄」還原。建議同時用 git。

## 開發

```bash
npm install
npm run build           # web UI（Vite）+ CLI（tsup）→ dist/
npm test                # 單元與 API 測試（vitest）
npm run test:e2e        # 打包 → npx init → CLI → 伺服器；MOSAGE_E2E_BROWSER=1 再加上瀏覽器測試
npm run check           # Biome（格式與 lint）
npm run typecheck
```

開發介面時：在某個寫作專案裡執行 `npx tsx <本 repo>/src/cli/index.ts dev --port 5281 --no-open`，
再於本 repo 執行 `npm run dev:web`（Vite 會把 `/api` 轉給 5281）。

| 路徑 | 內容 |
| --- | --- |
| `src/shared/` | 瀏覽器與 Node 共用：設定、Markdown 解析、標記格式、字數、差異比對、原始碼編輯 |
| `src/node/` | 專案與書籍檔案、版本紀錄、HTTP 伺服器、Word/HTML/Markdown 匯出、匯入 |
| `src/cli/` | `mosage` 指令 |
| `web/` | 瀏覽器介面（React） |
| `template/` | `init` 與 `new` 使用的專案、書籍範本 |
| `skills/` | 安裝到專案裡的 AI skills |

### 發佈

推送版本 tag 後，GitHub Actions 會跑完所有測試並發佈到 npm（第一次的帳號與權限設定見 [docs/RELEASING.md](docs/RELEASING.md)）：

```bash
npm version patch       # 或 minor / major
git push --follow-tags
```

## 致謝

MoSage 的概念來自 [open-slide](https://github.com/open-slide/open-slide)（Yiwei Ho）與
[open-doc](https://github.com/simonliu-ai-product/open-doc)（Simon Liu），兩者皆為 MIT 授權：
用 `npx` 建立工作區、把 AI skills 放進專案、在瀏覽器裡留言再由 AI 套用、由開發伺服器發布目前閱讀位置。
MoSage 是針對長篇寫作與 Word 交稿重新設計的獨立實作（Markdown 章節、修改建議、Word 匯出），未複製上述專案的程式碼。

## 授權

[MIT](LICENSE)
