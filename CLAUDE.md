# MoSage — development notes

MoSage is an npm package (`mosage`) with a CLI, a local HTTP server and a prebuilt React UI. Users run
`npx mosage init` to create a *project*; each book lives in `books/<id>/`. Everything is plain files —
never introduce a database.

## Layout

- `src/shared/` — browser-safe code shared by the UI and Node: config resolution (`config.ts`),
  the single Markdown parser (`markdown.ts`), annotation markers (`annotations.ts`), source edits
  (`edits.ts`), word count, diff. The UI and the Word exporter must both read chapters through
  `parseChapter()` so the preview matches the export.
- `src/node/` — `Project` (root, mosage.yaml, books) and `Book` (book.yaml, chapters, files),
  `History` snapshots, `server.ts` (JSON API + SSE + static UI), `export/`, `import/`.
- `src/cli/` — the `mosage` command. Keep heavy modules (export/import) behind dynamic `import()`.
- `web/` — React UI, built by Vite into `dist/web`.
- `template/project`, `template/book` — scaffolds for `init` and `new`. `gitignore` is renamed to
  `.gitignore` at init time because npm strips `.gitignore` from packages.
- `skills/` — agent skills copied into projects (`.agents/skills`, symlinked into `.claude/skills`).
  They are written in Traditional Chinese for the author; keep marker syntax and file layout in
  sync with `src/shared/annotations.ts` and `skills/mosage-reference/SKILL.md`.

## Rules

- Every write to a chapter goes through `Book.writeChapter` / `transformChapter` (history snapshot,
  version check). Edits from the UI must refuse stale input (`EditConflict` → HTTP 409).
- Mutating API routes are guarded (Host allow-list, Origin / Sec-Fetch-Site, JSON content type).
- Markers (`<!-- mosage:comment|suggest … -->`) must never reach an export.

## Commands

```bash
npm run build       # vite (web) + tsup (cli)
npm test            # vitest: shared, server API, export, import
npm run test:e2e    # pack → npx init → CLI → dev server (MOSAGE_E2E_BROWSER=1 adds Playwright)
npm run check       # biome
npm run typecheck
```
