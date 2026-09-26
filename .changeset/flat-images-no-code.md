---
'mosage': minor
---

移除程式碼節錄與 GitHub／GitLab 連結；素材的圖片不再按章節分類；檢視器精簡

- 移除 `<CodeExcerpt>`、`<CodeList>`、`?code` 匯入、`mosage code` 指令、文件頁的程式碼面板與素材頁的「程式碼」分類；`mosage init` 不再把 `code/` 加進 `.gitignore`
- 圖片統一放在 `assets/images/`，素材頁與文件的 Assets 分頁不再有章節分類；`<ImagePrompt>` 生成的圖片存成 `assets/images/<id>.png`，`chapter` 屬性保留但不再使用。以前按章節放在 `images/<資料夾>/` 的圖片照常顯示與引用
- 文件檢視器移除全螢幕模式、「符合頁面」與「實際大小」按鈕（點百分比仍可回到 100%）
- 下載選單的「This page」改為「Current」，選項後不再顯示頁數，下方說明改為具體列出要下載的頁面
