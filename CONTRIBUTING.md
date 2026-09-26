# Contributing to MoSage

Thanks for your interest in improving MoSage! This guide covers the workflow for contributing to the framework itself — the `mosage` package (runtime, CLI, and project template) and the demo app.

If you're authoring documents inside a scaffolded project, you don't need this file — drive your report through your coding agent or edit `docs/<id>/index.tsx` directly.

## Ways to contribute

- **Report a bug** via the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.yml). Include a minimal reproduction.
- **Propose a feature** via the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.yml). Describe the problem before the solution.
- **Ask a question or share what you're building** in [GitHub Discussions](https://github.com/nickchen1998/MoSage/discussions).
- **Send a pull request** — see below.

For non-trivial changes, please open an issue or discussion first so we can align on direction before you invest the time.

## Repo layout

pnpm + Turbo monorepo.

| Path | Package | Role |
| --- | --- | --- |
| [`packages/core`](packages/core) | `mosage` | The one published package: runtime (document browser, page viewer, outline, themes, assets panel, design panel, PDF/HTML/Word export), Vite plugins, dev API, the `mosage` CLI including `init`, the project template, canonical skills. |
| [`apps/demo`](apps/demo) | private | Local consumer of `mosage` via `workspace:*`. The dogfood target for the framework. |

## Prerequisites

- **Node.js 24** and **pnpm 11** — both pinned in [`.mise.toml`](.mise.toml). `mise install` picks them up; otherwise `corepack enable` will honour the `packageManager` field in `package.json`.
- A Unix-y shell. Windows works via WSL.

## Getting set up

```bash
git clone https://github.com/nickchen1998/MoSage.git
cd MoSage
pnpm install
```

Then run the demo against the local `mosage`:

```bash
pnpm dev
```

`apps/demo` is the fastest way to exercise framework changes — edit `packages/core`, the demo hot-reloads.

**After changing `packages/core/src`, run `pnpm core build` before testing the demo.** Documents import the built `dist` bundle, not the source, so runtime-facing changes don't reach a document until core is rebuilt.

## Useful scripts

```bash
pnpm dev          # turbo: runs demo against local core
pnpm build        # build all packages
pnpm typecheck    # tsc across the graph
pnpm check        # biome (format + lint + organize imports)
pnpm check:fix    # auto-fix what biome can
pnpm test         # vitest
pnpm test:e2e     # playwright — builds core, then drives the e2e fixture project
```

Filter to one package:

```bash
pnpm core <script>   # e.g. pnpm core build
```

## Pull request workflow

1. **Fork & branch.** Branch off `main`. Keep branches focused — one logical change per PR.
2. **Make your change.** Match the surrounding style. Don't reformat unrelated code.
3. **Run the checks before pushing:**
   ```bash
   pnpm check       # must pass — CI enforces it
   pnpm typecheck
   pnpm test
   ```
   `pnpm check:fix` will auto-fix most formatting and lint issues.
4. **Add a changeset if you touched `packages/core`:**
   ```bash
   pnpm changeset
   ```
   Pick the affected package(s) and the right bump:
   - `patch` — bug fixes, internal refactors, polish.
   - `minor` — new public API, additive features.
   - `major` — breaking changes.

   `apps/demo` and root tooling do **not** need a changeset.

   Keep the description **short and direct** — one line, present-tense, what changed from a user's perspective. No paragraphs, no rationale, no "this PR…".

   > Good: `Keep a table header with its first body row when a flow section breaks across pages.`
   >
   > Bad: `This change introduces smarter pagination because the previous packer sometimes left a header stranded…`

   Don't bump versions or edit `CHANGELOG.md` by hand — `changeset version` owns that.
5. **Open the PR.** Describe the problem, the change, and how you tested it. Link related issues. For layout or export changes, attach the exported PDF (or a screenshot of the affected pages) before and after.
6. **Address review feedback** by pushing follow-up commits. We'll squash on merge.

## Style & conventions

- **Biome must pass.** Formatting, lint, and import organisation are all enforced by `pnpm check`.
- **No casual dependencies.** The `core` runtime ships to users — every dep inflates install size. Prefer a small piece of inline code over a new package.
- **Default to writing no comments.** Only add one when the *why* is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. Don't explain *what* the code does; well-named identifiers handle that.
- **Skills under `packages/core/skills/` are canonical.** `mosage init` and `mosage sync:skills` copy them into a workspace's `.agents/skills` and `.claude/skills`.
- **Page geometry lives in one place.** `resolvePageGeometry(meta)` owns the CSS-pixel page size and the `@page` descriptor. Never hardcode sheet dimensions anywhere else.
- **Mutations go through `src/ops/`.** The dev routes and the CLI both call it, so a validation rule is written once.

## Testing

- Unit tests run via `pnpm test` (Vitest). Add tests next to the code (`*.test.ts`) when fixing a bug or adding logic that warrants it. Pure logic — the flow packer, the design serializer, path safety — is expected to be covered.
- End-to-end tests run via `pnpm test:e2e` (Playwright). They build core, boot `mosage dev` against `packages/core/e2e/fixture`, and cover the browser, the viewer, flow pagination, the inspector, the design panel, the dev API, HTML export, the static build, and the CLI. Anything touching those paths needs its case here. Run `npx playwright install chromium` once before the first run.
- For runtime/UI changes, verify the change in `apps/demo` **and in an export** (PDF and HTML), then describe what you exercised in the PR. The viewer and the exporters render the same pages through different paths; a fix that only lands in one of them is incomplete.

## Releases

Releases are cut through [changesets](https://github.com/changesets/changesets). Landing a changeset on `main` opens (or updates) a "chore: release packages" PR; merging that PR builds `mosage` and publishes it to npm from CI. Contributors don't need to publish anything — just land the changeset alongside your code.

## Questions

Open a [discussion](https://github.com/nickchen1998/MoSage/discussions) — happy to help.
