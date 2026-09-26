# Code excerpts — `code/`, `<CodeExcerpt>`, `<CodeList>`

A document that explains code shows **excerpts of real files**, and each
excerpt links to the exact version on GitHub or GitLab. The reader of a printed
copy gets the lines on paper plus a link fixed to the commit those lines came
from — the link keeps showing them after the code moves on.

## Where the code lives

- Every file a document excerpts goes in **`code/`** at the project root, in
  whatever folders make sense (`code/etl/transform.py`, `code/sql/report.sql`).
  Write the code there; never paste it into the document as a string.
- `code/` is **its own git repository**, pushed to GitHub or GitLab. The project
  repository ignores it (`/code/` in `.gitignore`).
- Check its state before writing about it:

  ```bash
  npx mosage code            # origin, the pushed commit, files that differ
  npx mosage code --json     # the same, for you to read
  ```

## Excerpting a file

```tsx
import { CodeExcerpt, Ref } from 'mosage';
import transform from '../../code/etl/transform.py?code';

<p>清洗規則見 <Ref to="clean-orders" />。</p>
<CodeExcerpt
  id="clean-orders"
  src={transform}
  lines="12-38"        // the file's own line numbers; omit for the whole file
  omit="22-31"         // lines inside `lines` to leave out, e.g. "22-31, 40-44"
  caption="訂單清洗規則"
/>
```

- The `?code` import is read at build time, like a `.csv`, so the excerpt is
  laid out with its final lines.
- Line numbers on the page are **the file's own** — a reader following the link
  lands on the same numbers. Never renumber, retype or reformat the code.
- One excerpt is one unbreakable block. Keep it under ~40 lines; for more, use
  `omit`, or split it into two excerpts with their own captions.
- Choose `lines` from the file as it is now. If the file changes, check the
  range still covers what the caption describes.
- `lines` past the end of the file, or an `omit` outside `lines`, prints an
  error in place of the excerpt, and `mosage check` reports it.

`<CodeExcerpt>` is numbered like `<Figure>` — `<Ref to>` works, and it gets its
own sequence. In a Chinese document, set the words once in `meta.labels`:

```tsx
export const meta: DocMeta = {
  // …
  labels: { figure: '圖', table: '表', code: '程式', codeLines: '第 {range} 行', codeOmitted: '省略第 {range} 行' },
};
```

## The appendix

A printed copy cannot be clicked, so a document with excerpts ends with a list
of them — each one's file, lines, page and link:

```tsx
import { CodeList } from 'mosage';

<h1>附錄　程式碼清單</h1>
<CodeList />
```

It fills in after the pages are scanned, like `<TableOfContents>`.

## Publishing the code

The link an excerpt prints points at the commit origin has **as of the last
push**. Until then:

| Excerpt status | Meaning | Printed |
| --- | --- | --- |
| pushed | origin shows exactly these lines | the link |
| changed | the pushed file differs here | the link — to the **old** lines |
| new | origin has no such file | no link |
| local | `code/` has no GitHub or GitLab origin | no link |

So after writing or editing code:

```bash
npx mosage code push -m "Add the order-cleaning excerpt"
```

It commits everything in `code/` and pushes with the user's own git sign-in.
`mosage check` warns about every excerpt whose link would not show what is
printed; the Download button in the viewer asks before exporting one.

If `code/` is not connected yet, ask the user for the repository address (an
empty repository they created on GitHub or GitLab), then:

```bash
npx mosage code connect https://github.com/<owner>/<repo>
npx mosage code connect https://git.example.com/team/repo --host gitlab   # self-hosted, unrecognised domain
```

`connect` saves the address with the project; in a fresh clone of the project,
`npx mosage code connect` with no address brings `code/` back.

Never push anything the user has not seen, never force-push, and never put a
token in a remote URL — if the push fails for want of a sign-in, tell the user
what git said.
