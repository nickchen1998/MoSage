# 參與 MoSage 開發

這份文件寫給想修改 MoSage 本身的人：也就是發佈到 npm 的 `mosage` 套件，以及開發用的範例專案。
如果你只是用 MoSage 寫文件，不需要讀這份——在專案資料夾裡請 AI 幫忙，或直接編輯 `docs/<代號>/index.tsx` 就好。

## 回報問題、提出建議

- **發現錯誤**：用[錯誤回報範本](./.github/ISSUE_TEMPLATE/bug_report.yml)開 issue，附上重現步驟，最好能附一個最小的專案。
- **想要新功能**：用[功能建議範本](./.github/ISSUE_TEMPLATE/feature_request.yml)，先描述遇到的困難，再談你想到的解法。
- **比較大的修改**：動手之前先開 issue 討論方向，免得做完才發現方向不同。
- **安全性問題**：請不要公開回報，做法見 [SECURITY.md](SECURITY.md)。

## 準備開發環境

需要 Node.js 24 與 pnpm 11，版本記錄在 [`.mise.toml`](.mise.toml)。
有 [mise](https://mise.jdx.dev/) 的話執行 `mise install`；沒有的話執行 `corepack enable`，它會依 `package.json` 的 `packageManager` 準備對應的 pnpm。
開發環境以 macOS 與 Linux 為主，Windows 請使用 WSL。

```bash
git clone https://github.com/nickchen1998/MoSage.git
cd MoSage
pnpm install
pnpm dev          # 用本機的 mosage 啟動 apps/demo
```

> 修改 `packages/core/src` 之後，先執行 `pnpm core build` 再看範例專案。
> 文件引用的是建置後的 `dist`，不是原始碼，沒有重新建置就看不到修改。

## 專案結構

| 路徑 | 說明 |
| --- | --- |
| `packages/core` | 唯一發佈到 npm 的 `mosage` 套件：檢視器、Vite 外掛、開發用 API、CLI（包含 `init`）、專案範本 `template/`、隨套件發佈的 AI skills `skills/` |
| `packages/core/e2e` | Playwright 端對端測試，以及測試用的 fixture 專案 |
| `apps/demo` | 以 `workspace:*` 引用 `mosage` 的範例專案，不會發佈 |
| `.agents/skills` | 開發這個 repo 時給 AI 參考的規範，不會發佈 |

## 常用指令

```bash
pnpm build        # 建置所有套件
pnpm typecheck    # TypeScript 型別檢查
pnpm check        # Biome：格式、lint、import 排序
pnpm check:fix    # 自動修正 Biome 能處理的問題
pnpm test         # Vitest 單元測試
pnpm test:e2e     # 先建置 mosage，再用 Playwright 跑端對端測試
pnpm core <指令>  # 只在 mosage 套件執行，例如 pnpm core build
```

第一次執行 e2e 之前，先用 `npx playwright install chromium` 安裝瀏覽器。

## 送出 Pull Request

1. 從 `main` 開新分支，一個 PR 只處理一件事。
2. 沿用周遭程式碼的寫法，不要順手調整無關的程式碼。
3. 推送之前確認 `pnpm check`、`pnpm typecheck`、`pnpm test` 都通過。CI 會再跑一次，並加上 e2e。
4. 如果修改了 `packages/core`，而且使用者會感受到差異，執行 `pnpm changeset` 加一筆變更紀錄，並選擇版本層級：
   - `patch`：修正錯誤、內部調整
   - `minor`：新增功能或公開 API
   - `major`：不相容的變更

   說明只要一句話，寫「使用者會看到什麼改變」，例如：「表格跨頁時，表頭會和第一列一起移到下一頁。」
   版本號與 `CHANGELOG.md` 由 changesets 產生，請不要手動修改。只改 `apps/demo` 或開發工具時不需要 changeset。
5. PR 說明寫清楚三件事：問題是什麼、改了什麼、怎麼驗證的。影響版面或匯出的修改，請附上修改前後的截圖或匯出檔。

合併時會 squash 成一個 commit，審查意見直接用新的 commit 回應即可。

## 撰寫慣例

- **Biome 必須通過**，CI 會檢查。
- **謹慎新增相依套件。** `mosage` 會安裝進每個使用者的專案，能用幾行程式解決的事，就不要引入新套件。
- **註解只寫「為什麼」**：隱藏的限制、不直觀的前提、針對特定錯誤的繞道。程式在做什麼，交給清楚的命名表達。
- **紙張尺寸只有一個來源。** 頁面的像素尺寸與 `@page` 設定都由 `resolvePageGeometry()` 決定，不要在其他地方寫死。
- **修改文件的操作放在 `src/ops/`。** 開發伺服器的路由與 CLI 呼叫同一份邏輯，驗證規則只寫一次。
- **`packages/core/skills/` 是 skills 的唯一來源。** `mosage init` 與 `mosage sync:skills` 會把它們複製到使用者專案，不需要同步其他副本。

## 測試

- 修正錯誤或新增有邏輯的程式時，在旁邊補上 `*.test.ts`。分頁演算法、Design 設定的序列化、路徑安全這類純邏輯都應該有測試。
- e2e 會複製 `packages/core/e2e/fixture` 並啟動 `mosage dev`，涵蓋文件列表、檢視器、分頁、Inspect、Design 面板、開發 API、匯出、靜態建置與 CLI。修改這些功能時，請一起補上測試案例。
- 檢視器和匯出走的是不同的繪製路徑，只修好其中一邊不算完成。修改畫面相關的程式時，除了在 `apps/demo` 確認，也請實際匯出 PDF 與 Word 檢查，並在 PR 說明你驗證了哪些情境。

## 發佈流程

發佈交給 [changesets](https://github.com/changesets/changesets)：帶有 changeset 的 PR 合併進 `main` 之後，會產生（或更新）一個「chore: release packages」版本 PR；合併這個版本 PR，CI 就會建置並把 `mosage` 發佈到 npm。
貢獻者不需要自己發佈，只要把 changeset 和程式碼一起送出。
