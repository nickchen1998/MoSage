---
name: mosage-reference
description: MoSage 的技術參考 —— 專案與書籍資料夾結構、book.yaml／mosage.yaml 欄位、章節檔格式、支援的 Markdown 與它在 Word 裡的樣子、留言與修改建議的標記語法、指令。在建立或修改 books/ 底下任何檔案之前閱讀；不確定格式時回來查。
---

# MoSage 技術參考

MoSage 沒有資料庫：**一切都是專案資料夾裡的純文字檔**。圖片與參考資料直接複製進資料夾即可。

## 專案結構

```
mosage.yaml                 專案預設值（所有書共用）
notes/                      共用素材（author.md …）
books/<代號>/
  book.yaml                 這本書的設定（覆寫 mosage.yaml）
  brief.md                  寫作企劃
  STYLE.md                  風格指南
  chapters/NN-name.md       章節，一章一檔
  assets/                   圖片
  notes/                    這本書的素材（不匯出）
output/<代號>/               匯出結果
.mosage/current.json        作者目前在介面上的位置（唯讀）
.mosage/history/            自動版本快照（唯讀）
```

書的代號（資料夾名）用英文小寫、數字與 `-`，建立後不要改名。新書用
`npx mosage new <代號> --title "書名" --type book|thesis|other` 建立，不要手動複製資料夾。

## book.yaml

```yaml
type: book            # book | thesis | other
stage: writing        # kickoff | outline | writing | revising | done
title: 和 AI 一起寫書
subtitle: 從立項到出版的協作流程
author: 陳小明         # 省略則用 mosage.yaml 的 author
targetWords: 80000    # 目標字數（中文字＋英文單字）
chapters:             # 章節順序＝目錄順序；只有列在這裡的會被匯出
  - 00-preface.md
  - 01-why.md
ai:
  editMode: suggest   # suggest | direct（省略則用 mosage.yaml）
export:               # Word 格式，省略的欄位依 type 套用預設
  pageSize: A4        # A4 | A5 | B5 | Letter | { width: 170, height: 230 }（mm）
  margins: { top: 25, bottom: 25, left: 30, right: 25 }   # mm
  fonts: { body: 標楷體, latin: Times New Roman, heading: 標楷體, code: Consolas }
  fontSize: 12        # pt
  lineSpacing: 1.5
  firstLineIndent: 2  # 首行縮排字數
  paragraphSpacing: 0 # 段後距 pt
  titlePage: true
  toc: true
  chapterPageBreak: true
  pageNumbers: true
  header: title       # none | title | chapter
  sceneBreak: ＊　＊　＊
```

修改 YAML 時只動需要的欄位，保留作者的註解。`chapters:` 裡的檔名必須真的存在於 `chapters/`。

## 章節檔

```markdown
---
status: draft          # idea（構想）| draft（草稿）| revising（修訂中）| done（完成）
summary: 這一章讓讀者理解……   # 一兩句，大綱頁會顯示
---

# 第一章　章名

## 1.1 小節

正文……
```

- 每個檔案**只有一個** `#` 標題，就是章名（在 Word 中是「標題 1」，會自動換頁並進入目錄）。
- `##` → 標題 2、`###` → 標題 3（都會進目錄），`####` 以下 → 標題 4。
- frontmatter 只給 MoSage 用，不會匯出。

## 支援的 Markdown（以及 Word 裡的樣子）

| 寫法 | 匯出成 |
| --- | --- |
| 一般段落 | 內文樣式（首行縮排、行距依設定） |
| `**粗體**`、`*斜體*`、`~~刪除線~~`、`` `程式碼` `` | 對應的文字格式 |
| `[文字](https://…)` | 超連結 |
| `- 項目`、`1. 項目`（可巢狀） | 項目符號／編號清單 |
| `> 引文` | 引文樣式 |
| `> [!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` | 提示框（注意／提示／重要／警告／小心） |
| ```` ```語言 ```` 程式碼區塊 | 等寬字型區塊 |
| GFM 表格 | Word 表格（標題列加粗、跨頁重複） |
| `![圖說](../assets/圖.png)` | 置中圖片，下方加圖說；寬度自動縮到版心 |
| `文字[^1]` ＋ `[^1]: 註腳內容` | Word 註腳（每頁頁尾） |
| `---`（單獨一行，前後空行） | 場景分隔（置中的 ＊　＊　＊） |
| `<!-- pagebreak -->` | 強制換頁 |

- 圖片路徑相對於章節檔，所以是 `../assets/檔名`。支援 png、jpg、gif、bmp。檔名建議英數字。
- 註腳編號在每章內唯一即可，匯出時會自動重新編號。
- 其他 HTML 標籤不會匯出，請不要使用。

## 標記：留言與修改建議

標記是 HTML 註解，任何 Markdown 工具都看不到，也不會被匯出。**標記屬於它正下方的那個區塊**
（段落、標題、清單、表格、引文…）。標記與區塊之間不要空行。

### 留言 `mosage:comment`

```markdown
<!-- mosage:comment id=c-1a2b3c4d by=human at=2026-09-26T08:00:00Z quote="被選取的文字"
留言內容，可以多行
-->
被留言的段落。
```

- `by=human`：作者留給你的 → 用 `apply-comments` 處理。
- `by=ai`：你留給作者的（需要資料、提問、審稿意見）→ 作者在介面上看過後會刪除。
- 單行寫法也可以：`<!-- mosage:comment by=ai 這裡需要資料來源 -->`

### 修改建議 `mosage:suggest`

```markdown
<!-- mosage:suggest by=ai note="一句話說明改了什麼"
取代下方區塊的完整新文字。
-->
原本的段落。
```

- `span=N`：取代下方連續 N 個區塊（預設 1）。內容寫出全部新文字，區塊之間空一行。
- `span=0`：不取代，只在下方區塊之前插入新內容。
- 作者在介面上看到新舊對照，按「接受」後內容才寫入；按「拒絕」則標記被刪除。

### 屬性

| 屬性 | 說明 |
| --- | --- |
| `id` | 可省略（系統會依內容產生）。自己加的話用 `c-`／`s-` 加 8 個十六進位字元 |
| `by` | `human` 或 `ai` |
| `at` | ISO 時間，可省略 |
| `quote` | 被選取的文字 |
| `note` | 修改建議的說明 |
| `span` | 修改建議取代的區塊數 |

含空白或特殊字元的值用雙引號，內部的 `"` 寫成 `\"`。內容裡不能出現 `-->`。

## 指令

```bash
npx mosage status                  # 書架總覽
npx mosage status <書> [--json]     # 單本：章節、字數、待處理標記（含行號）、找不到的圖片
npx mosage new <代號> --title … --type book|thesis|other
npx mosage export <書> [docx|html|md] [--out 路徑]
npx mosage import <檔案.docx|.md> [--book <代號>] [--no-split] [--unlisted]
```

## 作者在介面上能做的事（引導作者時可以提到）

- **書架**：所有書的進度；新增一本書
- **大綱**：拖曳章節排序、改章名與摘要、設定章節狀態、新增章節、移出目錄
- **閱讀**：書本排版預覽；選取文字 → 留言給 AI；雙擊段落直接修改；接受／拒絕修改建議
- **原始碼**：Markdown 編輯器（左右對照預覽）
- **素材**：把圖片、參考檔拖進來，會複製到這本書的 `assets/` 或 `notes/`
- **版本紀錄**：每次修改前自動保存，可比較差異並還原
- **匯出**：Word（.docx）、HTML（可列印成 PDF）、合併的 Markdown
