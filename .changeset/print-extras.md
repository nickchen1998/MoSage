---
'mosage': minor
---

PDF 書籤、浮水印、中文排版檢查

- `mosage export` 匯出的 PDF 帶有章節書籤，並且是 tagged PDF；書籤與檢視器的大綱一致
- `meta.watermark`（例如 `'草稿'`、`'機密'`）在每一頁印上淡淡的斜字，檢視器、PDF 與 Word 都有；Word 裡是原生浮水印，可以在 Word 修改或移除
- `mosage check` 以提醒的形式檢查中文排版：中文旁的半形標點、中文用了英文引號、台／臺混用；程式碼、圖與目錄不檢查，`data-od-typography="off"` 可以關閉某段
