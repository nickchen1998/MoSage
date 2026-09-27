---
'mosage': minor
---

Word 匯入

- `mosage import 報告.docx`：把 Word 檔轉成一份文件，保留標題（包含中文版 Word 的樣式）、粗體、斜體、連結、多層清單、表格（含合併儲存格與數字靠右）、圖片（附圖說）、註腳、引文與程式碼，並讀取頁面方向；Word 的目錄與頁碼欄位由 MoSage 自己產生
- Word 的圖表、文字方塊、方程式無法轉換，匯入後會列出數量，請用 `<Chart>`、`<Diagram>` 或文字重做
- 匯入的圖片（Word 與 Markdown）一律放在 `assets/images/`
