# MoSage workspace

You author **documents** here — reports, proposals, whitepapers, memos, letters. Each document is a folder under `docs/` with one `index.tsx` that exports its pages: a page component is one fixed sheet, and a `flow()` section is continuous content that MoSage measures and paginates. Every sheet is A4, portrait or landscape.

## Rules

- A document is `docs/<id>/index.tsx` plus an optional `docs/<id>/assets/` — `images/` for pictures, `references/` for the material it is written from. No sibling component files.
- Outside the document you are working on, write only where a skill says to: `themes/` for `create-theme`, the shared `assets/` for files several documents use. Don't touch `package.json`, `mosage.config.ts`, `.mosage/`, or other documents.
- No new dependencies. Only `react`, `mosage`, and standard web APIs are available.

## Skills

| Skill | Use it for |
| --- | --- |
| `create-doc` | Drafting a new document end to end — scoping questions, page plan, then the file. |
| `doc-authoring` | The technical reference: file contract, page canvas, print type scale, vertical budget, tables, TOC, page numbers, assets. Read before any edit under `docs/`. |
| `create-theme` | Turning a house style, a letterhead, or a past document into a reusable theme under `themes/`. |
| `current-doc` | Resolving "this page" / "this element" — reads the cursor the dev server writes to `node_modules/.mosage/current.json`. |
| `apply-comments` | Working through the notes left with **Inspect** (`@doc-comment` markers in the source). |
| `generate-images` | Drawing the `<ImagePrompt>` placeholders a document is waiting for. |

## Commands

```bash
npm run dev                                # viewer at http://localhost:5273, live reload
npx mosage check                           # overflowing content, blank sheets, Chinese punctuation
npx mosage export <id> --format pdf|docx   # into out/
npx mosage images                          # image prompts waiting to be drawn
npm run build                              # static site into dist/
```

`check` and `export` need Playwright: `npm i -D playwright && npx playwright install chromium`.

In the viewer: page thumbnails, the outline, and the document's assets in the left rail; continuous, two-up, and grid layouts; zoom; **Inspect** to edit text in place or leave a note; **Design** to adjust the palette and type scale; **Download** as PDF (true page size) or DOCX (editable in Word).
