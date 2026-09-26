# 我的文件

這個資料夾是一個 [MoSage](https://github.com/nickchen1998/MoSage) 專案：用 AI 寫文件，在瀏覽器裡預覽成真實的紙張，最後匯出 PDF 或 Word。

## 開始

```bash
npm install        # 如果建立專案時跳過了安裝
npm run dev        # 開啟 http://localhost:5273
```

在同一個資料夾開啟 Claude Code 或 Codex，描述你要的文件，例如「幫我寫一份 Q3 營運報告，給主管看，大約 6 頁」。
AI 會用內建的 `create-doc` skill 先確認主題與資料來源，再規劃頁面、撰寫。

## 資料夾

```
docs/
  <文件代號>/
    index.tsx      每份文件一個檔案，預設匯出頁面陣列
    assets/
      images/      圖片，每個章節一個資料夾
      references/  參考文獻：PDF、資料、筆記等撰寫時參考的檔案
assets/            多份文件共用的圖片與參考文獻（結構同上）
themes/            可重複使用的主題（選用）
.mosage/           專案設定（AI 生圖方式等），會一起提交
mosage.config.ts   專案設定
```

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開啟檢視器，檔案一改就即時更新 |
| `npx mosage check` | 找出超出紙張的內容、空白頁、落在頁尾的標題等問題 |
| `npx mosage export <文件> --format docx` | 匯出 Word；`--format pdf`（預設）匯出 PDF |
| `npx mosage import notes.md` | 把 Markdown 轉成一份文件 |
| `npx mosage images` | 列出等待生成的圖片；`images generate` 用 OpenAI API 生成 |
| `npx mosage upgrade` | 更新到最新版的 MoSage（`npm run dev` 時按 `u` + Enter 也可以） |
| `npm run build` | 輸出靜態網站 |

`check` 與 `export` 需要 Playwright：`npm i -D playwright && npx playwright install chromium`。
在瀏覽器裡用右上角的 **Download** 匯出則不需要。

`npx mosage upgrade` 會一併更新 `.agents/skills` 與 `.claude/skills`；也可以單獨執行 `npx mosage sync:skills`。
