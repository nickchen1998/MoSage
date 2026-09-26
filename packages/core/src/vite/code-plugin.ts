import { existsSync, type FSWatcher, watch } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type EnvironmentModuleNode,
  type ModuleNode,
  normalizePath,
  type Plugin,
  type ViteDevServer,
} from 'vite';
import type { CodeSource } from '../app/lib/code.ts';
import { codeDir, type RepoState, readFileAt, readRepoState } from '../code/repo.ts';
import { readSettings } from '../files/settings.ts';

export const CODE_QUERY = 'code';
export const CODE_CHANGED_EVENT = 'mosage:code-changed';

export type { CodeSource };

export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

type AnyModule = ModuleNode | EnvironmentModuleNode;

const isCodeModule = (mod: AnyModule) => Boolean(mod.id?.endsWith(`?${CODE_QUERY}`));

const DOCS_MODULE_ID = '\0virtual:mosage/docs';

type Controller = { refresh: () => Promise<void> };
const controllers = new WeakMap<ViteDevServer, Controller>();

/**
 * Re-reads `code/` against origin and reloads every excerpt — after a push, a
 * connect, or a commit made in a terminal.
 */
export async function refreshCode(server: ViteDevServer): Promise<void> {
  await controllers.get(server)?.refresh();
}

/**
 * Loads `?code` imports at build time, like CSV files and diagrams: an excerpt
 * whose lines arrived after the flow packer measured the page would be laid
 * out as empty.
 */
export function codePlugin(opts: { userCwd: string; docsDir?: string }): Plugin {
  const dir = codeDir(opts.userCwd);
  // Vite hands out forward-slash paths on every platform.
  const codePrefix = `${normalizePath(dir)}/`;
  const inCode = (file: string) => normalizePath(file).startsWith(codePrefix);
  const docsRoot = path.resolve(opts.userCwd, opts.docsDir ?? 'docs');

  const docIdOf = (file: string): string | null => {
    const parts = path.relative(docsRoot, file).split(path.sep);
    return parts.length === 2 && /^index\.(tsx|jsx|ts|js)$/.test(parts[1]) ? parts[0] : null;
  };

  /**
   * Documents are re-imported under a fresh token on `mosage:doc-changed`
   * rather than hot-swapped, so the viewer keeps its place. An excerpt whose
   * source or push state changed goes the same way: every module between it
   * and the document is marked, so the re-import fetches them anew.
   */
  const reloadDocuments = (server: ViteDevServer, excerpts: AnyModule[], timestamp: number) => {
    const docIds = new Set<string>();
    const seen = new Set<AnyModule>();
    const walk = (mod: AnyModule) => {
      if (seen.has(mod)) return;
      seen.add(mod);
      server.moduleGraph.invalidateModule(mod as ModuleNode, new Set(), timestamp, true);
      const docId = mod.file ? docIdOf(mod.file) : null;
      if (docId) {
        docIds.add(docId);
        return;
      }
      for (const importer of mod.importers) walk(importer);
    };
    excerpts.forEach(walk);
    if (docIds.size === 0) return;
    const docs = server.moduleGraph.getModuleById(DOCS_MODULE_ID);
    if (docs) server.moduleGraph.invalidateModule(docs);
    server.ws.send({ type: 'custom', event: 'mosage:doc-changed', data: { docIds: [...docIds] } });
  };
  let state: Promise<RepoState> | null = null;
  const repoState = () => {
    state ??= readSettings(opts.userCwd).then((s) => readRepoState(opts.userCwd, s.code.host));
    return state;
  };

  return {
    name: 'mosage:code',
    enforce: 'pre',

    async load(id) {
      const [file, query] = id.split('?');
      if (query !== CODE_QUERY) return null;

      let text: string;
      try {
        text = await fs.readFile(file, 'utf8');
      } catch {
        this.error(`Code file not found: ${file}`);
      }
      this.addWatchFile(file);

      const inside = inCode(file);
      const rel = path
        .relative(inside ? dir : opts.userCwd, file)
        .split(path.sep)
        .join('/');
      // No git, or a repository git cannot read: the excerpt prints without a link.
      const repo = inside ? await repoState().catch(() => null) : null;

      let pushed: CodeSource['pushed'] = null;
      if (repo?.pushedSha) {
        const change = repo.changes.find((c) => c.path === rel);
        const at = repo.pushedAt;
        if (!change) pushed = { sha: repo.pushedSha, at, same: true, lines: null };
        else if (change.state === 'added')
          pushed = { sha: repo.pushedSha, at, same: false, lines: null };
        else {
          const before = await readFileAt(opts.userCwd, repo.pushedSha, rel).catch(() => null);
          pushed = {
            sha: repo.pushedSha,
            at,
            same: false,
            lines: before === null ? null : splitLines(before),
          };
        }
      }

      const source: CodeSource = {
        path: rel,
        lines: splitLines(text),
        remote: repo?.remote ?? null,
        pushed,
      };
      return `export default ${JSON.stringify(source)};`;
    },

    handleHotUpdate({ file, server, modules, timestamp }) {
      if (!inCode(file)) return;
      // Edits change what differs from origin; the next load must not reuse it.
      state = null;
      // Besides the `?code` module, the file is in the graph as that module's
      // watched dependency; either way the way up is a document.
      reloadDocuments(server, modules, timestamp);
      return [];
    },

    configureServer(server) {
      server.watcher.add(dir);

      let gitWatcher: FSWatcher | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let last = '';

      const signature = (s: RepoState) =>
        JSON.stringify([s.remoteUrl, s.branch, s.pushedSha, s.changes]);

      const refresh = async () => {
        state = null;
        const next = await repoState();
        watchGit();
        const sig = signature(next);
        if (sig === last) return;
        last = sig;
        reloadDocuments(
          server,
          [...server.moduleGraph.idToModuleMap.values()].filter(isCodeModule),
          Date.now(),
        );
        server.ws.send({ type: 'custom', event: CODE_CHANGED_EVENT, data: {} });
      };

      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          void refresh().catch(() => {});
        }, 300);
      };

      // Vite's watcher skips `.git`, and a commit or push made in a terminal
      // changes nothing else. `code/.git` appears only once it is connected.
      function watchGit() {
        const gitDir = path.join(dir, '.git');
        if (gitWatcher || !existsSync(gitDir)) return;
        try {
          gitWatcher = watch(gitDir, { recursive: true }, (_event, name) => {
            if (name && /(^|[/\\])(objects|logs)([/\\]|$)/.test(name)) return;
            schedule();
          });
          gitWatcher.on('error', () => {
            gitWatcher?.close();
            gitWatcher = null;
          });
        } catch {
          gitWatcher = null;
        }
      }

      controllers.set(server, { refresh });
      void repoState()
        .then((s) => {
          last = signature(s);
          watchGit();
        })
        .catch(() => {});

      for (const kind of ['add', 'unlink', 'change'] as const) {
        server.watcher.on(kind, (file) => {
          if (inCode(file)) schedule();
        });
      }
      server.httpServer?.once('close', () => {
        gitWatcher?.close();
        if (timer) clearTimeout(timer);
      });
    },
  };
}
