# mosage

**English** · [繁體中文](README.zh-TW.md)

Scaffold an [MoSage](https://github.com/nickchen1998/MoSage) workspace — documents as React, one component per printed page.

```bash
npx mosage init my-docs
cd my-docs
pnpm dev
```

The scaffolded workspace ships with the `create-doc` and `doc-authoring` agent skills preconfigured (`.agents/skills`, linked into `.claude/skills`), a sample document, and the `mosage` dev/build/preview scripts.

It also writes a `pnpm-workspace.yaml` allowing esbuild's postinstall to run. pnpm blocks build scripts by default and Vite cannot start without that one; the file is inert under npm, yarn, and bun.

## Flags

```
mosage init [dir]
  -f, --force        overwrite a non-empty target directory
  -n, --name <name>  package name (defaults to the folder name)
  --use-pnpm         (or --use-npm / --use-yarn / --use-bun)
  --no-install       skip dependency installation
  --no-git           skip git init and the initial commit
```

MIT
