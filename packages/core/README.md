# mosage

MoSage（墨閣）讓 AI coding agent 幫你做出要印出來、要交出去的文件：報告、企劃書、白皮書、手冊。
Agent 把內容寫成頁面，MoSage 負責紙張尺寸、分頁、目錄與頁碼，並匯出 PDF 或可編輯的 Word。

```bash
npx mosage init my-docs
cd my-docs
npm run dev        # http://localhost:5273
```

接著在同一個資料夾開啟 Claude Code 或 Codex，描述你要的文件即可。

## 這個套件包含

- **CLI**：`mosage init`（建立專案）、`dev`、`check`（版面檢查）、`export`（PDF／Word）、`import`（Markdown 轉文件）、`images`（AI 生圖）、`upgrade`（更新）、`build`、`preview`、`sync:skills`
- **檢視器**：真實尺寸的頁面、縮圖與大綱、單頁／雙頁／格狀檢視、Inspect（直接改字或留言給 AI）、Design 面板
- **文件元件**：`flow()` 自動分頁、`TableOfContents`、`Footnote`、`Figure`／`Ref` 編號與交互參照、`DataTable`（讀 CSV）、`ImagePrompt`（待生成的圖片）、頁碼 hooks
- **AI skills**：`create-doc`、`doc-authoring`、`current-doc`、`apply-comments`、`create-theme`、`generate-images`
- **素材與設定**：圖片與參考文獻分開存放、參考文獻可預覽、介面文字大小、AI 生圖（Codex 或 OpenAI API，記錄 token 與花費）

`mosage check` 與 `mosage export` 會用無頭 Chromium 渲染，第一次使用前請安裝 Playwright：

```bash
npm i -D playwright && npx playwright install chromium
```

完整說明與範例：<https://github.com/nickchen1998/MoSage>

MoSage 以 [open-doc](https://github.com/simonliu-ai-product/open-doc)（Simon Liu，MIT）為基礎開發。授權：MIT。
