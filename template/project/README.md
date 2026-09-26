# 我的寫作專案

這是一個 [MoSage](https://github.com/nickchen1998/MoSage) 寫作專案：和 AI 一起寫書、寫論文，
在瀏覽器裡閱讀、留言、編排，最後一鍵輸出成 Word。一個專案可以放很多本書。

## 開始

```bash
npm run dev        # 開啟寫作介面 → http://localhost:5280
```

另開一個終端機，在這個資料夾啟動你的 AI 工具：

```bash
claude             # Claude Code
codex              # 或 OpenAI Codex
```

對 AI 說「**開始**」（Claude Code 也可以輸入 `/kickoff`）。AI 會：

1. **立項訪談** —— 問你寫作目的、類型（書／論文）、讀者、風格、篇幅與既有素材
2. **書名與大綱** —— 提出書名候選與幾種章節架構，建立章節骨架
3. 你在介面的「**大綱**」頁拖曳調整章節、修改章名與摘要
4. **撰寫** —— 「寫第一章」，AI 寫，你在介面上即時看到
5. **修訂** —— 在介面上選取文字留言給 AI，再對 AI 說「處理留言」；
   AI 的修改會以「修改建議」出現，你按「接受」或「拒絕」
6. **匯出** —— 介面右上角「匯出 Word」，或 `npx mosage export <書> docx`

想再寫一本？對 AI 說「我想寫一本新書」就好。

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開啟寫作介面 |
| `npx mosage status` | 所有書的進度；`npx mosage status <書>` 看單本細節 |
| `npx mosage new <代號>` | 建立一本新書（通常由 AI 幫你執行） |
| `npx mosage export <書> docx` | 匯出 Word 到 `output/<書>/` |
| `npx mosage import 舊稿.docx` | 把既有的 Word 稿匯入成一本新書（依標題切章節） |

## 資料夾

- `books/<代號>/` —— 每本書：`book.yaml` 設定、`brief.md` 寫作企劃、`STYLE.md` 風格指南、`chapters/` 章節
- `notes/` —— 所有書共用的素材
- `output/` —— 匯出的檔案
- `.mosage/` —— 自動版本紀錄（每次 AI 或你修改前都會保存舊版，可在介面「版本紀錄」還原）

所有內容都是純文字 Markdown，建議搭配 git 做版本管理。
