# Assets, references, and image placeholders

## Where files live

Every assets folder — a document's own `docs/<id>/assets/`, or the project's shared `assets/` — holds two collections:

| Collection | Path inside `assets/` | What goes there |
| --- | --- | --- |
| Images (圖片) | `images/<chapter>/<file>` — or `images/<file>` when it belongs to no chapter | Pictures a page shows. One folder per chapter, named after the chapter heading (`第二章 市場分析`). |
| References (參考文獻) | `references/<file>` | Everything that is not an image: papers, PDFs, spreadsheets, notes, data. Material the document is written **from**. |

Documents written before this split may still have files directly in `assets/`; they keep working where they are.

| Scope | Example | Import |
| --- | --- | --- |
| One document | `docs/<id>/assets/images/第二章 市場分析/chart.png` | `import chart from './assets/images/第二章 市場分析/chart.png'` |
| Shared across documents | `assets/images/logo.svg` (project root) | `import logo from '@assets/images/logo.svg'` |

Imports resolve to a URL string at build time. For a pure-text document, don't create an `assets/` folder at all. When you add an image yourself, save it in the chapter folder of the chapter it illustrates.

```tsx
import logo from '@assets/images/logo.svg';
import diagram from './assets/images/第一章 架構/architecture.png';

<img src={logo} alt="Acme" style={{ height: 28 }} />
<img src={diagram} alt="Service topology" style={{ width: 642, display: 'block' }} />
```

Rules:

- Always size images in absolute px, never `%` — a percentage resolves against the page, and the printed result stops matching the screen.
- Set `display: 'block'` on figures so the line-box descender doesn't add a stray few pixels to your vertical budget.
- Prefer SVG for logos, diagrams, and anything with type in it. A raster diagram at page width needs ≥1280px of source to survive print.
- Photos: keep them under ~1600px wide. The PDF export embeds them at full resolution, and a 6000px photo makes a 40MB PDF.
- Every image needs an `alt`. Figures need a caption below at `--od-size-caption`, muted, on the same page as the image.

## Read the references before you write

`docs/<id>/assets/references/` and `assets/references/` are what the user collected for this document — read them before drafting and take figures, quotes, and citations from there rather than from memory. They are sources, not page content: don't import them into a page. A CSV the page should show as a table is the exception — import it the way `tables-and-charts.md` describes.

## `<ImagePrompt>` — an image to be generated

When the project generates images (Settings → AI images) and this document has them switched on, leave an `<ImagePrompt>` wherever a picture should be drawn instead of a stand-in. Check first:

```bash
npx mosage images --json --doc <id>
```

Use `<ImagePrompt>` only when `mode` is `codex` or `openai` **and** `documents["<id>"]` is `true`. Otherwise do not add any — use `<ImagePlaceholder>` for an image the user must supply.

```tsx
import { ImagePrompt } from 'mosage';

<ImagePrompt
  id="market-map"
  chapter="第二章 市場分析"
  prompt="An isometric map of three market segments as city blocks, soft blue palette, no text"
  alt="Market segments"
  width={642}
  height={360}
/>
```

- `id` — lowercase letters, digits, and dashes, unique in the document. It becomes the file name.
- `chapter` — the chapter heading the image belongs to, exactly as the image folder is named. Leave it out for an image outside any chapter.
- `prompt` — written for an image model: subject, composition, style, palette. Say "no text" unless the image must contain words; captions belong in type, in a `<Figure>`.
- `width` / `height` — the space it takes on the page, in px, like any image. The ratio also decides whether it is drawn landscape, portrait, or square.
- Wrap it in `<Figure caption="…">` when it needs a numbered caption — the image lands inside the figure.
- Never use it for data charts: a chart from numbers is a table, a `<Diagram>`, or an inline SVG built from the data, so the numbers stay true.

Tell the user at hand-off how many prompts you left. Codex draws them with the `generate-images` skill; in OpenAI mode, the **Generate** buttons in the document's Assets tab (or `npx mosage images generate`) draw them. Either way each prompt is replaced by an imported `<img>` of the same size — never write that swap by hand.

## `<ImagePlaceholder>`

When a page needs a real image **the user has to provide** — a chart from their data, a product screenshot, a signed diagram — leave a typed placeholder instead of inventing a stand-in:

```tsx
import { ImagePlaceholder } from 'mosage';

<ImagePlaceholder hint="Revenue by segment, Q1–Q3 2026 — export from the finance dashboard" height={200} />
```

- The `hint` is what the user reads when replacing it. Name the exact artifact and where it comes from — "chart here" is useless.
- Size it to the space it will occupy so the page's vertical budget stays honest after the real image lands.
- **Do not** use placeholders for decoration or stock-photo filler. If type, a table, or an inline SVG can carry the page, do that instead.
- List every placeholder for the user at hand-off — those are the blockers between the draft and a sendable document.

## Export behavior

- **PDF**: images are embedded. The exporter waits for every `<img>` to finish loading before printing, so a slow asset delays the export rather than producing a blank frame.
- **DOCX**: images are embedded in the Word file as pictures at their laid-out size.
- Remote images (a URL on another origin) are left as-is — they render only while that host is reachable, and they may be missing from the PDF if the fetch is slow. Import files into the project instead.
