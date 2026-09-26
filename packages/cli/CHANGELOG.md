# mosage

## 0.2.0

### Minor Changes

- [#12](https://github.com/nickchen1998/MoSage/pull/12) [`6e7d405`](https://github.com/nickchen1998/MoSage/commit/6e7d4053fe259b81f289161a4a437293b7e92935) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Renamed from open-doc to MoSage: the packages are now `mosage` (the scaffolder — `npx mosage init`), `mosage-core`, and `mosage-mcp`; the command is `mosage` and the config file is `mosage.config.ts`.

### Patch Changes

- [#5](https://github.com/nickchen1998/MoSage/pull/5) [`fa6be37`](https://github.com/nickchen1998/MoSage/commit/fa6be37a62ce3ba6f811080ef3993068b4473570) Thanks [@nickchen1998](https://github.com/nickchen1998)! - Export a document as an editable Word file (`.docx`) from the Download menu, `mosage export --format docx`, and the `export_document` tool.

## 0.1.2

### Patch Changes

- [#19](https://github.com/simonliu-ai-product/open-doc/pull/19) [`7040726`](https://github.com/simonliu-ai-product/open-doc/commit/7040726f2ecf431a6e4750f216ce4903f3c9ccc9) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Give agents eyes, a headless renderer, and a Markdown front door.
  
  - **`open-doc check`** renders every sheet at true page size and reports the layout faults an agent writing React cannot see — content clipped by the page edge, blank sheets, headings stranded at the foot of a page, type too small to print, images that never loaded — each with the `line:column` in the source. Exits non-zero, so it works as a CI gate. Same report as the new `check_layout` MCP tool; `render_page` returns a PNG of one sheet.
  - **`open-doc export [ids…] --format pdf|html|png`** produces the Download menu's output from a script. It drives the real viewer in headless Chromium, so nothing about layout is re-implemented on the Node side. Playwright is an optional peer, not a dependency.
  - **`open-doc import <file.md>`** turns Markdown into a real document — `flow()` body, cover, self-filling contents, GFM tables, local images copied into the document's `assets/`. The output is ordinary authored TSX, so the outline, the inspector, and the design panel all work on it. Also available as the `import_markdown` tool.
  - **Fixed:** the flow packer's `measuring` flag read false for one commit after a document loaded, so anything reading the page list in that window — the outline scan, thumbnails, the page counter — saw an unpaginated flow section as a single page.

## 0.1.1

### Patch Changes

- [#15](https://github.com/simonliu-ai-product/open-doc/pull/15) [`f215074`](https://github.com/simonliu-ai-product/open-doc/commit/f215074413b2f101451cd0a84229567c7050080a) Thanks [@LiuYuWei](https://github.com/LiuYuWei)! - Scaffold new workspaces against `@open-document/core` 0.2.0. The version range is stamped in at build time, so the previous release pinned new projects to `^0.1.0` — which under semver's 0.x rule excludes 0.2.0, leaving them without the `current-doc` cursor.
