---
name: doc-runtime-patterns
description: Implementation patterns for the @open-doc/core runtime — the split between the viewer and the published bundle, virtual modules, the flow pipeline, the ops layer, dev-only plugins, and the React/perf rules that matter when a page is measured offscreen before it is drawn. Use when writing or refactoring anything under packages/core/src, packages/mcp/src, or when reviewing a PR that touches them. Not for authoring documents under docs/ — that's the create-doc / doc-authoring skills.
---

# open-doc runtime patterns

Rules for code that ships inside `@open-doc/core` (and the MCP server that sits on top of it). They exist because this runtime has two properties most React apps don't: **it runs twice in the same tab**, and **it measures the DOM before it paints**.

## 1. The two-copies rule (highest impact)

The viewer imports `src/app/**` directly. A user's document imports the built `dist` bundle through `@open-doc/core`. Both are alive in the same page.

- Anything that must be **shared** across that boundary — React context, the outline store — is stashed on `globalThis`. See `app/lib/page-context.tsx` and `app/lib/outline.ts`.
- A new shared singleton that uses a plain module-level `let`, a plain `createContext`, or a module-scoped `Map` **will silently split in two**: the viewer writes one copy, the document reads the other, and nothing throws.
- Test for it the same way: a value set from the viewer side must be readable from a document component, not just from a unit test that imports one copy.
- Public API changes are `index.ts` changes. If a document is supposed to call it, it must be exported there — not deep-imported from `app/lib/*`.

## 2. Discovery goes through virtual modules

`vite/open-doc-plugin.ts` globs `docs/*/index.{tsx,jsx,ts,js}` into `virtual:open-doc/docs` with a per-doc cache-bust token; `themes-plugin.ts` does the same for `themes/*.md` into `virtual:open-doc/themes`; folders land in `virtual:open-doc/folders` for static builds.

- New content the framework discovers on disk gets a virtual module, not a runtime `fetch` of a JSON file. Dev and build then agree by construction.
- Anything that must be live in dev **and** frozen at build gets both paths: a dev endpoint plus a snapshot baked into the virtual module. `docs/.folders.json` is the reference implementation.
- Never widen the glob to walk the user's whole project. Discovery is scoped to `docs/` (including each document's `assets/`) and `themes/`.

## 3. The flow pipeline is three layers — keep them apart

| Layer | File | Rule |
| --- | --- | --- |
| Pure packer | `app/lib/flow.ts` (`paginateBlocks`) | No DOM. Takes `BlockMetrics[]` + available height, returns page assignments. Every pagination rule is unit-testable here. |
| Measurement | `app/lib/flow-measure.ts` | Owns offscreen DOM measurement. Batches reads; never interleaves read/write. |
| Composition | `app/lib/use-doc-pages.ts` | Joins fixed pages + flow output into the rendered page list. |

Everything downstream — viewer, thumbnails, `export-pdf.ts`, `export-html.ts` — consumes `useDocPages`. **Reading `doc.default` directly is a bug**, because it skips flow expansion and yields a different page count than the exporters.

Adding a break rule means: extend `paginateBlocks`, add a case to `flow.test.ts`, done. If the rule needs a measured value it doesn't have, add it to `BlockMetrics` — don't reach into the DOM from the packer.

## 4. Mutations live in `src/ops/`

`vite/routes/docs.ts` and the MCP tools are two transports over one implementation.

- A validation rule, conflict check, or id-collision guard is written **once**, in `ops/`.
- Errors are `OpsError` with the status the transport should report — a route never invents its own status text.
- New mutating capability = a function in `ops/` + a thin route + a thin MCP tool. Logic inline in a route is a review block: it ships to one caller and not the other.
- `@open-doc/mcp` is resolved dynamically by `vite/mcp-plugin.ts` through a variable specifier. Core must never take a static import on it — the peer relationship points the other way. Missing install warns and disables `/mcp`; it is never fatal.

## 5. Dev-only endpoints are a trust boundary

`api-plugin.ts` and `design-plugin.ts` mount under `apply: 'serve'` only. They write to the user's disk.

- Every mutating handler calls `validateMutationRequest` (`http/request-guard.ts`) **first**. No exceptions, including "internal" endpoints.
- Path safety for anything user-named is centralized in `files/assets.ts`. Never `path.join` a user-supplied name onto a directory by hand, and never trust a name that round-tripped through the client.
- Source-rewriting endpoints parse and replace a byte range — they never regenerate a file. `design-plugin.ts` accepts literal objects only and reports anything else back to the panel rather than overwriting it. `editing/edit-ops.ts` refuses any node that isn't a single text child. Widening either of those is an explicit product decision, not an implementation detail.

## 6. React rules that actually bite here

The app targets **React 18** — no `use()`, `forwardRef` is still required, and there is no compiler. Assume nothing is memoized for you.

- **Never measure in a loop that also writes.** Read all block heights, then apply. Interleaving forces a layout per block and turns a 40-page document into a visible stall.
- **Derive during render, not in an effect.** Page lists, outline entries, and geometry are derivations of props — an effect that recomputes them adds a frame of wrong output that the exporter can capture.
- **Keep transient values in refs.** Scroll position, drag offsets, and measurement scratch state must not re-render the page list.
- **Memoize by content, not by identity.** A page component re-created inline each render defeats every downstream `memo` and re-triggers measurement. Never define a component inside another component.
- **Subscribe to the narrowest thing.** The sidebar should depend on the page *count*, not on the page array, or every re-measure repaints the rail.
- **`content-visibility: auto` is for the viewer only.** It must never reach the export path — skipped rendering serializes as empty.

## 7. Composition over flags

The viewer's chrome is compound by design: `routes/home-shell.tsx` owns the left sidebar and hands folder state to routes through the outlet context; `components/doc-sidebar.tsx` owns the document rail; the design panel docks right.

- A route **never** fetches the folders manifest itself. Take it from the outlet context.
- Prefer an explicit variant component over another boolean prop. `<DocSidebar mode="outline">` beats `showOutline showThumbnails compact`.
- Prefer `children` over `renderX` props. Prefer lifting state into the provider that already owns it over threading a callback down three levels.

## 8. Export determinism

Both exporters build their own offscreen copy, scan the outline there, serialize, then restore the previous snapshot.

- Before serializing: `waitForFonts()`, `waitForImages()`, `waitForDataWaitfor()` (`app/lib/print-ready.ts`).
- Anything that paints asynchronously must expose `data-waitfor="<selector>"` — that is the only contract the exporter has for "not done yet".
- Never call `face.load()` on unloaded font faces. `document.fonts.ready` already covers requested faces; forcing the rest ignores `unicode-range` and will hang the tab on a subsetted CJK family. (There's a comment in `print-ready.ts` saying so — don't undo it.)
- An export change is verified by exporting, not by reading the viewer.

## Review checklist

- [ ] No new module-level state that crosses the viewer/bundle boundary without `globalThis`
- [ ] New public surface exported from `index.ts`
- [ ] Page data flows through `useDocPages`, not `doc.default`
- [ ] Pagination logic in `flow.ts` with a test; measurement in `flow-measure.ts`
- [ ] Mutations in `ops/`, `OpsError` for status, both transports reach the same function
- [ ] `validateMutationRequest` on every mutating handler; user-named paths via `files/assets.ts`
- [ ] No read/write interleaving in measurement; no components defined inside components
- [ ] Export path re-verified (PDF and HTML) for anything affecting page composition
- [ ] No new dependency in `core` without a reason that outweighs install size
