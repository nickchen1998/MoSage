# mosage

## 0.11.0

### Minor Changes

- [#24](https://github.com/nickchen1998/MoSage/pull/24) [`c9f389f`](https://github.com/nickchen1998/MoSage/commit/c9f389fbcbefd397d1edd3e3fb729f5350732650) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 新專案內建四個主題：函文、會議紀錄、橫式信封、直式信封（信封一頁一個，可從 CSV 批次產生）。主題的 frontmatter 可以寫 `orientation: landscape`，預覽會用 A4 橫式。文件、主題、素材三個頁面拿掉頂端的標題區塊；設定頁的用量只顯示這台電腦所有專案的總計。

### Patch Changes

- [#25](https://github.com/nickchen1998/MoSage/pull/25) [`210ade3`](https://github.com/nickchen1998/MoSage/commit/210ade3dabcecf8a0249228c0e1af6629413c517) Thanks [@nickchen1998](https://github.com/nickchen1998)! - npm 套件說明拿掉已移除的 HTML 匯出。

## 0.10.0

### Minor Changes

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 新增 AI 生圖：在 Settings 選擇「預留 prompt 給 Codex」或「OpenAI API」，每份文件可以個別開關。AI 撰寫時會在需要圖片的地方放 `<ImagePrompt>`；Codex 透過新的 `generate-images` skill 畫圖，OpenAI 模式則在文件的 Assets 分頁按 Generate（或執行 `mosage images generate`）。API 金鑰只存在本機的 `~/.mosage/credentials.json`，每次生圖都會記錄 input／output token 與預估花費（USD）。

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 素材分成「圖片」與「參考文獻」兩類：圖片依章節存放在 `assets/images/<章節>/`，素材頁與文件的 Assets 分頁以樹狀瀏覽，章節名稱取自文件標題；圖片以外的檔案放在 `assets/references/`，PDF、文字、CSV／TSV、音訊與影片可以直接預覽。把圖片移到其他章節、改名或重新命名章節時，文件中的 import 會自動更新。上傳的檔案一律複製進專案。

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 字級一律以偶數 px 為級距：Design 面板的字級每次調整 2px，內建配色方案、表格、Markdown 匯入與圖表文字都改用偶數字級，AI skills 也預設使用 12、14、16… 這樣的字級（除非使用者指定）。

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 匯出只保留 PDF 與 Word（DOCX）：Download 選單與 `mosage export --format` 移除 HTML、PNG、SVG，`build.allowHtmlExport` 設定也一併移除。

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 新增 Settings 頁：可以調整介面文字大小（預設放大為 110%，只影響操作介面，不影響頁面與匯出），並顯示目前版本與是否有新版。

- [#22](https://github.com/nickchen1998/MoSage/pull/22) [`738cd7e`](https://github.com/nickchen1998/MoSage/commit/738cd7e88dcf64b5b46753b6fa54171c8801defe) Thanks [@nickchen1998](https://github.com/nickchen1998)! - `mosage dev` 啟動時會檢查 npm 上是否有新版，有的話在終端機輸入 `u` + Enter 即可更新並重新啟動；也新增 `mosage upgrade` 指令。更新時會一併對齊 React、React 型別與 Vite 的主版本，並同步 skills。

### Patch Changes

- [#21](https://github.com/nickchen1998/MoSage/pull/21) [`f79ad84`](https://github.com/nickchen1998/MoSage/commit/f79ad84fbaf04cfd56fc2cd3e080ca94573844d3) Thanks [@nickchen1998](https://github.com/nickchen1998)! - npm 套件附上完整的 MIT 授權檔（LICENSE），並移除沿用自 open-doc 的 `contributors` 欄位；原作者的版權聲明保留在 LICENSE 中。

## 0.9.1

### Patch Changes

- [#19](https://github.com/nickchen1998/MoSage/pull/19) [`9c08cf9`](https://github.com/nickchen1998/MoSage/commit/9c08cf9f16896a0c7067cf80120d124ca0c902bb) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 標示實際需要的 Node.js 版本（22.18 以上或 24.11 以上）；在不支援的版本上安裝時，npm 會先提出警告，而不是執行到一半才出錯。

## 0.9.0

### Minor Changes

- [#17](https://github.com/nickchen1998/MoSage/pull/17) [`671d1d3`](https://github.com/nickchen1998/MoSage/commit/671d1d328cb4c852e4bb8173fb2c8396f732a80b) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 文件一律使用 A4（可選直式或橫式），不再支援 B4 與 A3；`mosage import` 移除 `--page-size` 選項。舊文件若設定了 B4 或 A3，會自動改以 A4 顯示與匯出。

- [#16](https://github.com/nickchen1998/MoSage/pull/16) [`4223755`](https://github.com/nickchen1998/MoSage/commit/4223755c8085bf5e7f7276629e27af4223904c6c) Thanks [@nickchen1998](https://github.com/nickchen1998)! - 改用 React 19，新專案的範本也同步更新；既有專案升級時，請一併把 `react`、`react-dom`、`@types/react`、`@types/react-dom` 升到 19。範本不再固定舊版的 `vite`，改用 mosage 內建的版本。

## 0.8.0

### Minor Changes

- [#14](https://github.com/nickchen1998/MoSage/pull/14) [`dee10e2`](https://github.com/nickchen1998/MoSage/commit/dee10e2fa2fe5bd80f321212c01f31092f5eecf1) Thanks [@nickchen1998](https://github.com/nickchen1998)! - MoSage 現在是單一套件：`mosage init` 併入主套件（`npx mosage init` 用法不變），專案改為依賴 `mosage`；移除 MCP 伺服器與 `mosage dev --mcp`。

## 0.7.0

### Minor Changes

- [#5](https://github.com/nickchen1998/MoSage/pull/5) [`fa6be37`](https://github.com/nickchen1998/MoSage/commit/fa6be37a62ce3ba6f811080ef3993068b4473570) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Export a document as an editable Word file (`.docx`) from the Download menu, `mosage export --format docx`, and the `export_document` tool.

- [#12](https://github.com/nickchen1998/MoSage/pull/12) [`6e7d405`](https://github.com/nickchen1998/MoSage/commit/6e7d4053fe259b81f289161a4a437293b7e92935) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Renamed from open-doc to MoSage: the packages are now `mosage` (the scaffolder — `npx mosage init`), `mosage-core`, and `mosage-mcp`; the command is `mosage` and the config file is `mosage.config.ts`.

- [#5](https://github.com/nickchen1998/MoSage/pull/5) [`09cc94c`](https://github.com/nickchen1998/MoSage/commit/09cc94cb526d80ec96421da9722c404a86552eaf) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Show several pages at once in the viewer, as two-up spreads or a grid.

### Patch Changes

- [#5](https://github.com/nickchen1998/MoSage/pull/5) [`1598e06`](https://github.com/nickchen1998/MoSage/commit/1598e06fa77f09670d4988c9f49e2857dca42b7e) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Keep the table of contents, figure numbers, and cross-references in an export started right after a document loads.

## 0.6.0

### Minor Changes

- [#32](https://github.com/simonliu-ai-product/open-doc/pull/32) [`906390b`](https://github.com/simonliu-ai-product/open-doc/commit/906390bf466f723721debf659374691222a97a45) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - The inspector edits text wherever it actually lives.
  
  A document written through helpers used to report `text is produced by code` for
  most of itself: the words behind `{agency}`, `{line}` or `{children}` are not in
  the element that renders them. Each child of the selected element now resolves
  on its own — to a call site's attribute, to one entry of an array the call site
  passed, to whatever sits between its tags, or to a template literal. Runs that
  cannot be told apart by what is on screen are still refused, so a save never
  rewrites a sibling.
  
  Resolving the element as a whole was also why `{label}：{value}` offered nothing
  but the colon: the literal was found, so the props were never looked for.
  
  A contents row selects the heading it was generated from, and scrolls to it —
  the list stays a view of the headings rather than something to type into.
  
  The text panel is one field instead of one per run. A sentence interrupted by
  five `<code>` spans is still a sentence; it now reads like one, with the markup
  between the words as inert chips.

## 0.5.0

### Minor Changes

- [#30](https://github.com/simonliu-ai-product/open-doc/pull/30) [`a08c7f9`](https://github.com/simonliu-ai-product/open-doc/commit/a08c7f9b23a5ef730e113e4be94c12fd629b017e) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Viewer: find in document, page jump, distinct zoom icons, and PNG/SVG export with a page range.
  
  - The toolbar had two identical square icons — fit-page and fullscreen. Fit-page is
    now an up-down arrow, pairing with the left-right arrow that fits the width, and a
    per-cent button resets the zoom to 100%.
  - The page counter is an input: type a number to jump there.
  - A find control beside it searches the rendered document. Matches are painted with
    the CSS Custom Highlight API rather than wrapped in markup, so nothing React owns
    is edited; a browser without the API still navigates between hits.
  - Download offers PNG and SVG alongside PDF and HTML, and asks which pages first —
    all, the current one, or a range like `1-3, 5`. One page downloads as one file;
    several arrive as a zip.

## 0.4.0

### Minor Changes

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Restrict page sizes to A4, B4 and A3, portrait or landscape — and fix the landscape `@page` descriptor
  
  A document could previously be laid out on A4, Letter, A5 or Legal. The set is
  now A4, JIS B4 (257 × 364mm) and A3 — six sheets counting orientation, all
  metric, all sold by the same print shop.
  
  `PAGE_SIZE_NAMES` is exported as the single source of truth and `PageSizeName`
  is derived from it, so the CLI's `--page-size`, the MCP `import_markdown`
  schema, and `ops/import.ts` all read one list instead of restating it.
  `open-doc import` also gained `--orientation`, and `import_markdown` an
  `orientation` argument; both reject a size or orientation off the list, as does
  a `pageSize:` in imported Markdown frontmatter.
  
  Landscape documents printed at the wrong sheet size. `resolvePageGeometry()`
  emitted `@page { size: 210mm 297mm landscape }`, but the `landscape` keyword is
  only valid beside a page-size *name* — Chromium dropped the whole descriptor and
  printed at whatever the dialog defaulted to, while the content was laid out
  1123 × 794. The descriptor now carries the swapped millimetres (`297mm 210mm`),
  which Chromium accepts.
  
  `PAGE_SIZES` entries therefore expose `mm: [width, height]` (portrait) in place
  of the old pre-rendered `css` string; `resolvePageGeometry().css` is unchanged
  as the way to get an `@page` descriptor.
  
  `resolvePageGeometry()` still falls back to portrait A4 for an unrecognised
  value, so a document that already says `pageSize: 'Letter'` renders as A4
  rather than breaking — but the type no longer accepts it.

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Add `home` to the config: the viewer's back arrow points at that URL instead of the app's own document browser. A viewer mounted under a larger site can now return to that site rather than to its own index.

### Patch Changes

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Fix the core version reported by the dev API, the MCP server, and `cliContext` — it resolved `package.json` at a fixed depth, which the bundler's chunk placement made wrong, so it silently fell back to `0.0.0`.

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Hide the document header's back arrow when there is nowhere for it to go — no
  `home` configured and `showDocBrowser: false`, where `/` renders "not found".

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Centre the document title in the viewer header and drop the subtitle line
  
  The header laid the title out in a `flex-1` block right after the back link, so
  it sat at the centre of the *leftover* space — visibly left of the bar's centre,
  because the control cluster on the right is many times wider than the back link.
  The header is now a three-column grid with equal `1fr` rails, which puts the
  title at the true centre whenever the controls fit their share, and slides it
  rather than colliding when they don't.
  
  `meta.subtitle` no longer renders in the header. It was a second line of small
  grey text competing with the page it describes; the document browser still shows
  it, and it still belongs on a cover page.

- [#28](https://github.com/simonliu-ai-product/open-doc/pull/28) [`f9d35f2`](https://github.com/simonliu-ai-product/open-doc/commit/f9d35f288a589eb51cf7a465d97d38df939b0c4f) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Show the theme toggle in the document viewer when the document browser is not built. The browser's sidebar was the only place it lived, so a viewer mounted on its own left a reader with no way to switch between light and dark.

## 0.3.0

### Minor Changes

- [#19](https://github.com/simonliu-ai-product/open-doc/pull/19) [`7040726`](https://github.com/simonliu-ai-product/open-doc/commit/7040726f2ecf431a6e4750f216ce4903f3c9ccc9) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Add `<Diagram>`: import a `.mmd` file and get an architecture or flow drawing compiled to SVG at build time, in the document's own theme, numbered as a figure when given a caption.

- [#19](https://github.com/simonliu-ai-product/open-doc/pull/19) [`7040726`](https://github.com/simonliu-ai-product/open-doc/commit/7040726f2ecf431a6e4750f216ce4903f3c9ccc9) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Give agents eyes, a headless renderer, and a Markdown front door.
  
  - **`open-doc check`** renders every sheet at true page size and reports the layout faults an agent writing React cannot see — content clipped by the page edge, blank sheets, headings stranded at the foot of a page, type too small to print, images that never loaded — each with the `line:column` in the source. Exits non-zero, so it works as a CI gate. Same report as the new `check_layout` MCP tool; `render_page` returns a PNG of one sheet.
  - **`open-doc export [ids…] --format pdf|html|png`** produces the Download menu's output from a script. It drives the real viewer in headless Chromium, so nothing about layout is re-implemented on the Node side. Playwright is an optional peer, not a dependency.
  - **`open-doc import <file.md>`** turns Markdown into a real document — `flow()` body, cover, self-filling contents, GFM tables, local images copied into the document's `assets/`. The output is ordinary authored TSX, so the outline, the inspector, and the design panel all work on it. Also available as the `import_markdown` tool.
  - **Fixed:** the flow packer's `measuring` flag read false for one commit after a document loaded, so anything reading the page list in that window — the outline scan, thumbnails, the page counter — saw an unpaginated flow section as a single page.

- [#19](https://github.com/simonliu-ai-product/open-doc/pull/19) [`7040726`](https://github.com/simonliu-ai-product/open-doc/commit/7040726f2ecf431a6e4750f216ce4903f3c9ccc9) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - The furniture a long document needs, and tables that come from data files.
  
  - **`<Footnote>`** — numbered by position across the whole document, printed at the foot of whatever page its marker landed on. Inside a `flow()` section the notes are lifted out of the blocks *before* measurement and their height is charged to the page budget, so the packer breaks pages knowing what the foot of each one already owes. Fixed pages place them with an explicit `<Footnotes />`.
  - **`<Figure caption id>`** (`kind="table"` for tables) — numbered from a scan of the rendered pages, caption and content in one unbreakable block, with `<ListOfFigures />` / `<ListOfTables />` to build the lists.
  - **`<Ref to="id" />`** — renders `Figure 3`, and appends the page only when the target is on another sheet. A reference to an id nothing declares renders visibly and is reported by `open-doc check` as a new `unresolved-ref` error.
  - **`meta.labels`** — what numbered things are called (`圖`, `表`, `（第 {page} 頁）`). The numbering itself is structural.
  - **`<DataTable>` + `.csv`/`.tsv` imports** — data files resolve to arrays of objects at build time (quoted fields, embedded newlines, CRLF), and the table infers alignment and grouping from the column's contents. Data is never fetched at render time: the packer measures the real DOM, so anything arriving a tick later arrives after the layout is decided.
  - **Fixed:** `stackedHeights` measured the last node of every measurement container after the first as zero, because it mixed `offsetTop` (host-relative) with the container's own height. It now takes both from the same box, which corrects footnote reservation and the last block of every flow section after the first.

### Patch Changes

- [#19](https://github.com/simonliu-ai-product/open-doc/pull/19) [`7040726`](https://github.com/simonliu-ai-product/open-doc/commit/7040726f2ecf431a6e4750f216ce4903f3c9ccc9) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Resolve `@open-document/mcp` from the workspace running the dev server, so `--mcp` mounts under pnpm's strict node_modules layout instead of silently disabling itself.

## 0.2.0

### Minor Changes

- [#12](https://github.com/simonliu-ai-product/open-doc/pull/12) [`40e8f98`](https://github.com/simonliu-ai-product/open-doc/commit/40e8f9810b3d8f51264b72974af10e8a3d137cab) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Publish the reader's position to `node_modules/.open-doc/current.json` while `open-doc dev` runs, and ship a `current-doc` skill so an agent can resolve "this page" and "this element" without asking. The cursor carries the document id, the rendered page number, the source path, and whatever the inspector has selected; a selection clears when you move to another sheet.

### Patch Changes

- [#13](https://github.com/simonliu-ai-product/open-doc/pull/13) [`fa2f15f`](https://github.com/simonliu-ai-product/open-doc/commit/fa2f15f7ae284b3020be0fb90979ac28288ffeec) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Move to vite 8, `@vitejs/plugin-react` 6, and `@babel/parser` 8. Build output keeps its `.js` / `.d.ts` names — tsdown 0.22 would otherwise rename everything to `.mjs` / `.d.mts` and break the exports map.

- [#10](https://github.com/simonliu-ai-product/open-doc/pull/10) [`d70eafe`](https://github.com/simonliu-ai-product/open-doc/commit/d70eafe811dd8334334c403672c69e38b055a5ad) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Mark the viewer's scrolling pane with `data-od-viewer` so page frames in the main pane can be told apart from the thumbnail rail.
