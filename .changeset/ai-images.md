---
'mosage': minor
---

新增 AI 生圖：在 Settings 選擇「預留 prompt 給 Codex」或「OpenAI API」，每份文件可以個別開關。AI 撰寫時會在需要圖片的地方放 `<ImagePrompt>`；Codex 透過新的 `generate-images` skill 畫圖，OpenAI 模式則在文件的 Assets 分頁按 Generate（或執行 `mosage images generate`）。API 金鑰只存在本機的 `~/.mosage/credentials.json`，每次生圖都會記錄 input／output token 與預估花費（USD）。
