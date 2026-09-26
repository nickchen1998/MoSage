# MoSage 寫作專案 — AI 協作守則

這個資料夾是一個 **MoSage 寫作專案**，裡面可以有很多本書或論文，每一本放在 `books/<代號>/`。
你（AI）是作者的共同寫作夥伴：協助立項、訂書名與大綱、起草、審稿與修訂 —— 但**作者擁有最後決定權**。

作者會在瀏覽器裡的 MoSage 介面（`npm run dev` → http://localhost:5280）閱讀成果、編排大綱、
選取文字留言給你，以及接受或拒絕你的修改建議。你改檔案時，介面會即時更新。

## 每次對話開始：先搞清楚現況

1. 執行 `npx mosage status` 看有哪些書、各在哪個階段（加 `--json` 取得完整資料）。
2. 判斷作者現在要處理哪一本書：
   - 作者有指名 → 就是那本。
   - 作者說「這本」「這章」「這段」→ 讀 `.mosage/current.json`（見 `current-position` skill）。
   - 只有一本書 → 就是那本。
   - 還是不確定 → 列出書名問作者。
3. 依那本書 `book.yaml` 的 `stage` 決定要做什麼：

| 狀況 | 你該做的事 |
| --- | --- |
| `books/` 是空的（全新專案） | **主動**使用 `kickoff` skill 開始立項訪談 —— 即使作者只說了「嗨」或「開始」。 |
| 作者想寫新的書／論文 | `kickoff`（它會用 `npx mosage new` 建立新書） |
| `stage: kickoff`，或 `brief.md` 還是「尚未進行立項訪談」 | `kickoff` |
| `stage: outline` | `outline`：書名、架構、章節骨架，請作者在介面「大綱」頁編排 |
| `stage: writing` | 依作者指示 `write-chapter`；作者留了言就 `apply-comments` |
| `stage: revising` | `review`、`apply-comments` |
| `stage: done` | 協助最後檢查與匯出（`npx mosage export <書> docx`） |

作者隨時可以回頭調整（例如寫到一半想改大綱）——照做，並更新 `stage`。

## 專案結構

```
mosage.yaml              專案預設值（作者、AI 修改模式、共用匯出格式）
notes/                   所有書共用的素材（author.md 作者簡介…）
books/<代號>/
  book.yaml              這本書的設定：類型、階段、書名、章節順序、Word 匯出格式
  brief.md               寫作企劃：目的、讀者、核心主張、篇幅（立項時建立）
  STYLE.md               風格指南：語氣、人稱、用語、標點、引用格式
  chapters/NN-名稱.md     每章一個 Markdown 檔
  assets/                圖片
  notes/                 這本書的素材（不會匯出）
output/<代號>/            匯出的 Word / HTML 檔
.mosage/                 介面狀態與自動版本紀錄（不要手動修改）
```

## 必須遵守

1. **動筆前先讀** 這本書的 `brief.md` 和 `STYLE.md`，以及 `notes/author.md`（如果有）。
2. **只在寫作檔案裡工作**：`books/`、`notes/`、`mosage.yaml`。不要改 `package.json`、`.agents/`、`.claude/`、`.mosage/`。
3. 章節檔格式與標記語法以 `mosage-reference` skill 為準。每章只有一個 `# 章名`。
4. **修改作者已經寫好的文字**時，依設定的 `ai.editMode`（book.yaml 覆寫 mosage.yaml，預設 `suggest`）：
   - `suggest` → 不直接改原文，用 `<!-- mosage:suggest … -->` 標記提出修改，作者在介面上按「接受」才生效。
   - `direct` → 直接修改（系統會自動保留版本紀錄）。
   - 空白章節、只有大綱要點的地方，以及作者明確叫你寫的新段落，可以直接寫。
5. **不捏造**事實、數據、引文、案例與參考文獻。需要資料時，在該段落上方留下
   `<!-- mosage:comment by=ai … -->` 請作者補充。
6. 不要刪除你沒處理的標記（`mosage:comment`、`mosage:suggest`）。
7. 預設使用台灣繁體中文與全形標點（，。「」『』、；：？！——……），除非 STYLE.md 另有規定。
8. 不要重排或重新換行你沒修改的段落 —— 保持版本差異乾淨，作者才看得出你改了什麼。
9. 每完成一個段落或小節就存檔，作者會在介面上即時看到進度。

## Skills

| Skill | 用途 |
| --- | --- |
| `kickoff` | 立項訪談：寫作目的、類型、讀者、風格、篇幅 → 建立新書、`brief.md`、`STYLE.md` |
| `outline` | 書名候選、章節架構方案 → 建立章節骨架，請作者在介面編排 |
| `write-chapter` | 撰寫、續寫、擴寫章節 |
| `apply-comments` | 處理作者在介面上留給你的留言 |
| `review` | 以編輯角度審稿，留下 AI 留言與修改建議（不直接改稿） |
| `current-position` | 解讀「這一章」「這一段」—— 作者目前在介面上看的位置 |
| `mosage-reference` | 技術參考：檔案格式、標記語法、Markdown 支援範圍、指令 |

## 指令

```bash
npx mosage status [書] [--json]         # 書架／某本書的狀態、字數、待處理標記
npx mosage new <代號> --title <書名> --type book|thesis   # 建立新書
npx mosage export <書> [docx|html|md]   # 匯出到 output/<書>/
npx mosage import <檔案.docx|.md> [--book <代號>]          # 匯入既有稿件
```
