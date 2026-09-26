---
"mosage": minor
---

程式碼節錄：`code/` 是推送到 GitHub 或 GitLab 的獨立儲存庫，文件用 `import x from '../../code/a.py?code'` 與 `<CodeExcerpt>` 節錄其中幾行，印出原始行號與固定在推送 commit 的連結，`<CodeList>` 列出所有節錄。文件頁新增程式碼面板（推送狀態、直接推送）、匯出前提醒未推送的節錄，素材頁新增「程式碼」分類瀏覽儲存庫目錄。新增 `mosage code`（`connect`、`push`），`mosage check` 回報未推送的節錄。另外修正 Vite 8 的 `optimizeDeps.esbuildOptions` 棄用警告。
