# MoSage

[繁體中文](README.md) · **English**

**A local workspace for writing books and theses with an AI.** Open the project folder in Claude Code,
Codex or any agent that reads `AGENTS.md`, and work through kickoff, title and outline, drafting and
revision in conversation. In the browser you read the manuscript typeset like a book, select text to
leave notes for the AI, and accept or reject its suggested rewrites — then export the Word file your
publisher or university asks for.

```bash
npx mosage init my-writing
cd my-writing
npm run dev        # http://localhost:5280
claude             # or: codex — then say "開始" / "start" (or /kickoff)
```

No database, no account: everything is plain files (Markdown + YAML) in the project folder. Images and
reference material are simply copied into it.

## Highlights

- **One project, many books** — each book or thesis lives in `books/<id>/` with its own settings, brief, style guide and chapters.
- **Agent-led kickoff** — on a fresh project the agent interviews you (purpose, readers, voice, length), proposes titles and chapter structures, and scaffolds the outline.
- **Outline board** — drag to reorder chapters, edit titles and summaries, track status per chapter.
- **Book-like preview** — first-line indent, leading and fonts follow the Word export settings.
- **Notes for the AI** — select any text and comment; notes are stored as `<!-- mosage:comment … -->` markers that the `apply-comments` skill processes.
- **Suggestions you approve** — edits to existing prose arrive as `<!-- mosage:suggest … -->` markers shown as a diff with Accept / Reject.
- **Live** — the page updates as the agent edits files.
- **Automatic history** — every change snapshots the previous version; compare and restore in the UI.
- **Where am I** — the UI writes `.mosage/current.json` so "make this paragraph shorter" just works.
- **Word export** — real Word styles (Heading 1–4, body text, quote, caption), TOC field, page numbers, footnotes, tables, images; plus HTML (print to PDF) and merged Markdown.
- **Import** — `mosage import manuscript.docx` splits an existing Word manuscript into chapters by heading style.

## Commands

| Command | |
| --- | --- |
| `npx mosage init <dir>` | Create a project |
| `mosage dev` | Start the writing UI |
| `mosage new <id> --title … --type book\|thesis` | Add a book |
| `mosage status [book] [--json]` | Shelf overview / one book's chapters, words and pending markers |
| `mosage export [book] [docx\|html\|md]` | Export to `output/<book>/` |
| `mosage import <file.docx\|.md> [--book id]` | Import an existing manuscript |
| `mosage sync-skills` | Refresh the agent skills after upgrading |

## Credits

The concepts — an `npx` scaffolder, agent skills shipped inside the workspace, browser comments applied
by the agent, and a dev server that publishes the reader's position — come from
[open-slide](https://github.com/open-slide/open-slide) by Yiwei Ho and
[open-doc](https://github.com/simonliu-ai-product/open-doc) by Simon Liu (both MIT). MoSage is an
independent implementation for long-form writing and Word delivery; it does not copy their code.

## License

[MIT](LICENSE)
