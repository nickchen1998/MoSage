# MoSage 開發指引

這個 repo 是 MoSage 框架本身：發佈到 npm 的 `mosage` 套件，包含檢視器、Vite 外掛、CLI、專案範本與 skills。
在使用者專案裡撰寫文件的規範不在這裡，而在 `packages/core/skills/` 的 `create-doc`、`doc-authoring` 等 skills——那些是給 `docs/` 底下的檔案用的，不是給框架用的。

## 結構

pnpm + Turbo 的 monorepo。

- **`packages/core`**（npm 名稱 `mosage`，唯一發佈的套件）
  - `src/app/`：瀏覽器端——文件列表、檢視器、大綱、主題、素材、Design 面板、PDF／Word 匯出
  - `src/vite/`：Vite 設定與外掛——文件探索、開發 API、Design、資料檔、圖表、主題
  - `src/cli/`：`mosage` 指令（`init`、`dev`、`build`、`preview`、`check`、`export`、`import`、`images`、`upgrade`、`sync:skills`）
  - `src/ops/`：文件操作，CLI 與開發伺服器路由共用
  - `src/render/`：以無頭 Chromium 驅動真正的檢視器
  - `src/images/`：AI 生圖——`<ImagePrompt>` 的解析與替換、OpenAI Images API、價格表與用量紀錄
  - 其餘：`src/import/`（Markdown 匯入）、`src/data/`、`src/diagram/`、`src/editing/`、`src/files/`（素材路徑、專案設定、使用者資料）、`src/http/`、`src/versions.ts`（版本比較與更新檢查）
  - `template/`：`mosage init` 的專案範本；`skills/`：隨套件發佈的 skills；`e2e/`：Playwright 測試與 fixture 專案
- **`apps/demo`**：用 `workspace:*` 引用 `mosage` 的範例專案，不發佈。`pnpm dev:demo` 啟動。
- 共用設定：`biome.json`、`turbo.json`、`pnpm-workspace.yaml`、`vitest.config.ts`，各套件各有 tsconfig。

## 常用指令

```bash
pnpm dev          # 用本機的 mosage 啟動範例專案
pnpm build        # 建置所有套件
pnpm typecheck    # TypeScript 型別檢查
pnpm check        # Biome（格式、lint、import 排序）
pnpm check:fix    # 自動修正 Biome 能處理的問題
pnpm test         # Vitest
pnpm test:e2e     # Playwright（先建置 core，再啟動 e2e fixture 專案）
pnpm core <指令>  # 只在 mosage 套件執行
```

- 修改 `packages/core/src` 之後，**先 `pnpm core build` 再測範例專案**：文件引用的是建置後的 `dist`，不是原始碼。
- 發佈走 changesets：修改 `packages/*` 的 PR 附上 `pnpm changeset`，合併後由 CI 產生版本 PR，版本 PR 合併即發佈。不要手動修改版本號或 `CHANGELOG.md`。

## 架構要點

### 執行期

- **執行時同時存在兩份 core。** 檢視器直接載入 `src/app/**`，文件則透過 `mosage` 載入建置後的 `dist`。兩邊必須共用的單例（React context、大綱 store）都掛在 `globalThis` 上，參考 `src/app/lib/page-context.tsx` 與 `src/app/lib/outline.ts`。新增共用單例時要照同樣做法，否則會在不知不覺中分裂成兩份。
- **文件由虛擬模組探索。** `src/vite/mosage-plugin.ts` 以 glob 找出 `docs/*/index.{tsx,jsx,ts,js}`，產生 `virtual:mosage/docs`，並為每份文件附上熱更新用的 cache-bust token。
- **檢視器是兩欄式外殼。** `src/app/routes/home-shell.tsx` 負責左側欄（數量、資料夾、主題切換），並透過 outlet context 把資料夾狀態交給各路由——路由不自己讀取 manifest。文件頁的結構相同：`src/app/components/doc-sidebar.tsx` 是左側的縮圖／大綱，中間捲動頁面，Design 面板停靠右側。
- **資料夾存在 `docs/.folders.json`。** 這是框架唯一自己管理的可變狀態：開發模式透過 `/__folders` 即時讀取，靜態建置讀 `virtual:mosage/folders` 的快照。文件代號永遠不變，歸檔只修改對應關係。
- **主題只是說明文件。** `themes-plugin.ts` 把 `themes/*.md` 的 frontmatter 與內文讀進 `virtual:mosage/themes`，並搭配可選的 `<id>.demo.tsx`；frontmatter 的 `orientation: landscape` 讓預覽用 A4 橫式。執行期不會強制套用主題，`meta.theme` 只用來顯示回到主題的連結。`template/themes/` 是 `mosage init` 內建的主題，和 `apps/demo/themes/` 的同名檔案必須完全相同（`cli/init.test.ts` 會檢查），改一邊就要複製到另一邊。

### 頁面與分頁

- **頁面有兩種。** `DocModule.default` 是 `DocEntry[]`：一個元件就是一張固定的紙；`flow()` 區段則是連續內容，由框架分頁。
- **分頁拆成三層。** `src/app/lib/flow.ts` 是純演算法（`paginateBlocks`，有單元測試），`flow-measure.ts` 負責離屏的 DOM 量測，`use-doc-pages.ts` 把兩者組成最終的頁面清單。檢視器、縮圖與所有匯出器都讀這份清單，所以任何需要頁面的地方都要透過 `useDocPages`，不要直接讀 `doc.default`。
- **`measuring` 是推導值，不是狀態。** `use-doc-pages.ts` 以分頁計畫的 `sections` 是否與目前的同一個參照來判斷。如果改成由 effect 設定的 `useState`，文件載入後會有一次 commit 誤判為量測完成，這時尚未分頁的 flow 區段看起來只有一頁，大綱掃描與所有無頭讀取都會因此出錯。
- **量測以容器自己的框為準。** `flow-measure.ts` 的 `stackedHeights` 用 `getBoundingClientRect` 取位移，而不是 `offsetTop`：所有量測容器共用同一個定位宿主，`offsetTop` 是相對於宿主，容器高度卻不是，兩者混用會讓第一個容器之後、每個容器的最後一個節點量成 0。
- **註腳在量測之前就被抽出。** `src/app/lib/footnotes.ts` 走訪 flow 區塊的元素樹，把每個 `<Footnote>` 換成標記並取出內容；`flow-measure.ts` 用實際印出註腳的元件量測，`paginateBlocks` 再把註腳高度（加上每頁一次的註腳區外框）從該頁的可用空間扣除——註腳佔用的空間本來就不能分給內文，這正是先抽出的原因。代價是藏在輔助元件內部的 `<Footnote>` 不會被找到。固定頁面則由 `DocPageProvider` 裡執行期的 `FootnoteCollector` 搭配明確放置的 `<Footnotes />` 處理；註腳內容放在 ref 而不是 state，因為 `ReactNode` 每次 render 都是新物件，放進 state 會讓每次 commit 都被視為變更。
- **只支援 A4，尺寸只有一個來源。** `src/app/lib/sdk.ts` 的 `PAGE_SIZE_NAMES` 只有 `'A4'`，`PageSizeName` 由它推導，`ops/import.ts` 等邊界都讀這個 tuple，不另外列舉；唯一的選擇是直式或橫式（`ORIENTATIONS`）。`resolvePageGeometry(meta)` 同時產生 CSS 像素尺寸與 `@page` 描述，遇到其他尺寸（例如舊版的 B4、A3）一律退回 A4，讓舊文件仍能顯示。不要在其他地方寫死 794 × 1123，也不要加回其他紙張尺寸。

### 掃描：大綱與編號

- **大綱來自 DOM，不是解析原始碼。** `collectOutline()` 從已繪製的頁框找出標題。檢視器等字型載入完成後才掃描；每個匯出器則先掃描自己的離屏複本再讀取，讀完還原先前的結果。
- **圖、表、註腳的編號也是掃描出來的。** `src/app/lib/labels.ts` 依文件順序找出 `data-od-label`，按種類編號；`src/app/lib/scan.ts` 讓它與 `collectOutline` 一起執行，確保兩者描述同一份複本。`<Figure>`、`<Ref>`、`<ListOf>` 與註腳標記都讀這個 store，所以第一次 render 是空白、下一次才正確，和 `<TableOfContents>` 一樣。呼叫點只有兩個——檢視器的 effect，以及所有匯出器共用的 `export-dom.ts` 裡的 `mountOffscreen`——兩者都經過 `scanDocument`／`captureScan`／`restoreScan`，不要只掃大綱或只掃編號。

### 編輯一律改原始碼

- **Inspect。** `src/vite/loc-tags-plugin.ts`（僅開發模式）在文件原始碼的 host JSX 加上 `data-od-loc="line:col"`；覆蓋層讀取這個屬性，`/__edit/*`（`src/vite/routes/edit.ts`）再透過 `src/editing/edit-ops.ts` 修改文字（只處理單一文字子節點，其他情況一律拒絕），或透過 `src/editing/comments.ts` 寫入 `@doc-comment` 標記。標記內容是 base64url 編碼的 JSON，留言因此可以包含引號與換行。
- **Design 面板。** `src/vite/design-plugin.ts` 用 Babel 解析 `docs/<id>/index.tsx`，只替換 `design` 物件所在的位元組範圍後寫回。它只接受字面物件，遇到其他寫法會回報給面板，而不是覆寫。序列化的往返測試在 `design-plugin.test.ts`，修改序列化時請一併擴充。
- **文件操作集中在 `src/ops/`。** `src/vite/routes/docs.ts` 與 CLI 呼叫同一組函式，衝突檢查與驗證規則只寫一次；`OpsError` 帶有傳輸層應回應的 HTTP 狀態碼。新的修改操作放在這裡，不要寫進路由。
- **開發端點只在 `apply: 'serve'` 下掛載。** `api-plugin.ts` 掛載 `/__assets/*` 等路由（實作在 `src/vite/routes/`），`design-plugin.ts` 掛載 `/__design`。這些端點會寫入使用者的磁碟，每個修改資料的處理器都必須先呼叫 `validateMutationRequest`。素材的路徑安全集中在 `src/files/assets.ts`，不要自己把使用者提供的名稱接到目錄後面。

### 無頭渲染、檢查與匯出

- **無頭渲染驅動的是真正的檢視器。** `src/render/session.ts` 啟動 Vite 伺服器（或沿用 `ctx.serverOrigin`），用 Chromium 開啟 `/d/<id>`，透過 `window.__mosage` 溝通——這是 `src/app/lib/agent-bridge.ts` 在文件頁安裝的橋接。`mosage export` 與 `mosage check` 因此和 Download 選單使用同一份量測後的頁面清單、同一條列印流程，Node 端不重做任何版面計算。
- **Playwright 是可選的 peer。** 它以變數形式的 specifier 載入，`render/session.ts` 用本地的結構型別描述它的 API，讓發佈的 `.d.ts` 不會引用 Playwright。
- **版面問題從 DOM 找，不靠推論。** `src/app/lib/diagnostics.ts` 以實際紙張尺寸走訪列印複本，比對元素與頁面框的位置。它只做 DOM 運算、不了解框架，所以手寫或產生的文件都一樣抓得到。每個發現都帶有該元素的 `data-od-loc`（與 Inspect 使用的相同），報告因此能指回原始碼的行號。
- **Word 匯出是重新排版，不是複製紙張。** `src/app/lib/export-docx.ts` 把每個 flow 區段重新排成一條連續欄位：沒有分頁、沒有重複的頁尾、也不去掉頂端邊界。其中每個區塊都放在它列印時所在那張紙的頁框裡（`FlowBlock` 的 `sheet`），所以這份複本自己的掃描會引用和 PDF 相同的頁碼。
  - `src/app/lib/docx/extract.ts` 從這份 DOM 讀出計算後的樣式與實測間距建成模型，`src/app/lib/docx/write.ts` 再把模型寫成 WordprocessingML，用 core 已經帶著的 `fflate` 壓縮。
  - 頁尾會以哨兵頁碼再畫一次，轉成 `PAGE`／`NUMPAGES` 欄位；flow 區段的頁尾會畫成前兩張紙，所以第一頁隱藏或不同的頁尾會成為 Word 的首頁頁尾。
  - 分頁器的區塊提示（`flow-measure.ts` 的 `blockHints`）轉成 `keepNext`／`pageBreakBefore`，標題在 Word 裡同樣會和後文留在同一頁。
  - Word 樣式由實際文字投票決定，段落只有在和樣式不同時才帶直接格式。寫入器是純函式並有單元測試，擷取器由 e2e 涵蓋。

### 建置期處理的內容

分頁依賴實際的 DOM 量測，晚一步才出現的內容會錯過分頁決定。所以文件用到的資料與圖表都在建置時處理，不在執行期非同步載入。

- **CSV／TSV 是模組。** `src/vite/data-plugin.ts` 在建置時把 `.csv`／`.tsv` 轉成物件陣列，解析器 `src/data/delimited.ts` 是手寫的，沒有外部相依。
- **圖表在建置時編譯。** `src/vite/diagram-plugin.ts` 把 `import chart from './x.mmd'` 轉成套用主題的 SVG 字串；解析、分層排版與繪製都在 `src/diagram/`，同樣沒有外部相依。繪製器輸出 `--od-*` CSS 變數而不是固定顏色，圖表才會用文件自己的配色印出，新增的繪製內容也必須這樣做。外掛裡沒有瀏覽器，文字寬度以 `measureText` 估算。
- **Markdown 匯入產出一般的 TSX。** `src/import/markdown.ts` 是手寫解析器，`src/import/to-tsx.ts` 把區塊輸出成帶 inline style 的 JSX，使用真正的標題標籤與純 JSX 文字。匯入的文件沒有任何特殊待遇：大綱、Inspect 的文字修改與 Design 面板都能直接使用，因為它長得就像人寫的文件。

### 素材、設定與 AI 生圖

- **素材分兩類。** 每個 assets 資料夾（文件的 `docs/<id>/assets/` 與專案共用的 `assets/`）裡，圖片直接放在 `images/`，其他檔案放在 `references/`，介面上稱為「圖片」與「參考文獻」。舊版的兩種形狀照常可讀：直接放在 `assets/` 根目錄的檔案，以及以前按章節分類時的 `images/<資料夾>/`；新上傳一律不建立子資料夾。合法路徑由 `src/files/assets.ts` 的 `parseAssetPath` 判斷，路由與上傳都經過它。
- **改名會改寫 import。** 素材改名時，`vite/routes/assets.ts` 會用 `rewriteAssetReferences` 改寫引用它的文件原始碼（文件範圍只改該文件，共用範圍改所有文件）。
- **素材以開發伺服器自己的來源提供，回應標頭決定能不能在頁面內顯示。** `assetResponseHeaders` 只讓不會執行腳本的類型 inline 顯示；SVG 加上 sandbox 的 CSP；其他類型（包括上傳的 `.html`）一律當下載處理，因為在這個來源執行的頁面可以呼叫寫入專案的 API。
- **設定分兩處。** 專案層級的選擇（生圖方式、模型、品質、各文件開關）存在 `.mosage/settings.json`，隨專案提交（`src/files/settings.ts`）。個人資料放在專案外的 `MOSAGE_HOME`（預設 `~/.mosage`，`src/files/user-data.ts`）：`credentials.json`（OpenAI 金鑰，權限 0600）與 `openai-usage.jsonl`（每次生圖的 token 與預估花費）。API 永遠只回傳遮罩過的金鑰。測試一律把 `MOSAGE_HOME` 指到暫存資料夾。
- **生成的圖片先以 `<ImagePrompt>` 佔位。** 它在頁面上佔用最後圖片的實際尺寸，所以分頁在圖片存在前就是對的。`src/images/prompts.ts` 用 Babel 找出這些元素，並在圖片存到 `assets/images/<id>.png` 後，把元素換成同尺寸、以 import 引用的 `<img>`，沒有其他 prompt 時也移除 `ImagePrompt` 的 import。`ops/images.ts` 是開發路由（`/__images`）與 CLI（`mosage images`）共用的入口；Codex 模式下由 `generate-images` skill 畫圖後呼叫 `mosage images place`。
- **OpenAI 的呼叫與費用各自獨立。** `src/images/openai.ts` 呼叫 Images API（`MOSAGE_OPENAI_BASE_URL` 可指向測試用的假伺服器，e2e 用 `e2e/mock-openai.mjs`）；`src/images/pricing.ts` 是價格表與費用估算，價格變動時只改這裡。
- **介面文字大小只縮放操作介面。** 介面一律用 rem（`lib/ui-scale.ts` 設定根字級），頁面內容一律用 px，列印時根字級回到 16px，所以這個設定永遠碰不到紙張與匯出。新增介面元素時不要用 `text-[Npx]` 這類固定 px 的字級。
- **更新檢查不能拖慢任何事。** `src/versions.ts` 的 `fetchLatestVersion` 有逾時、快取，失敗時回傳 null；`MOSAGE_NO_UPDATE_CHECK` 或 `CI` 會關閉它。`mosage dev` 在伺服器啟動後才檢查，`u` + Enter 會關閉伺服器、執行 `mosage upgrade`，再用新的程序重新啟動。`upgrade` 會把專案裡與新版 mosage 主版號不同的 React、React 型別與 Vite 一起對齊。

### e2e

e2e 使用 fixture 專案，不是範例專案。`packages/core/e2e/fixture` 是真正的 workspace 套件（`docs/`、`themes/`、`mosage.config.ts`），`e2e/scratch.mjs` 每次執行都把它複製到 `e2e/.scratch/<name>`，會寫入磁碟的測試因此不會弄髒版本控制中的檔案。`pnpm test:e2e` 會先建置 core，CI 對建置的檢查也來自這一步。縮圖也是頁框，計算紙張數量時要限定在 `[data-od-viewer]` 裡。

## 必守規則

- **commit 前 Biome 必須通過**（`pnpm check`，或用 `pnpm check:fix` 自動修正）。
- **匯出只有 PDF 與 Word（DOCX）。** 不要加回 HTML、PNG 或其他格式。
- **不要隨意新增相依套件。** `mosage` 會安裝進每個使用者的專案，每多一個套件都會增加安裝負擔。
- **兩種 skills 不要混用。**
  - `packages/core/skills/` 隨套件發佈，給使用者在 `docs/` 撰寫文件用，也是這些 skills 唯一的來源——`mosage init` 與 `mosage sync:skills` 會把它們複製到專案，沒有其他副本需要同步。
  - `.agents/skills/` 是開發這個 repo 用的規範：`doc-runtime-patterns`（core 的實作規則）、`print-layout-review`（版面與列印品質）、`viewer-ui-guidelines`（檢視器介面與無障礙）。`.claude/skills/` 以 symlink 指向它們。
- **預設不寫註解。** 只有在「為什麼」不明顯時才寫：隱藏的限制、微妙的不變條件、針對特定錯誤的繞道。不解釋程式在做什麼、不加分隔用的橫幅、不留下註解掉的程式碼。
