// `mosage dev` — a small local HTTP server: JSON API over the project files,
// server-sent events when anything on disk changes (so you watch the AI write
// in real time), and the prebuilt web UI.

import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar, { type FSWatcher } from 'chokidar';
import { type ChapterStatus, type ProjectType, STAGES, type Stage } from '../shared/config.ts';
import {
  acceptSuggestion,
  EditConflict,
  insertComment,
  removeAnnotation,
  replaceRange,
} from '../shared/edits.ts';
import { type Book, type FileFolder, isChapterId, ProjectError } from './book.ts';
import type { ExportFormat } from './export/index.ts';
import type { Project } from './project.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface ServerOptions {
  port?: number;
  host?: string;
  webDir?: string;
  /** Folder copied to books/<id>/ when the UI creates a book. */
  bookTemplateDir?: string;
}

export interface RunningServer {
  url: string;
  server: Server;
  close(): Promise<void>;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function defaultWebDir(): string {
  return fileURLToPath(new URL('./web/', import.meta.url));
}

function send(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(text);
}

/** send() for route handlers, which return true once they answered. */
function reply(res: ServerResponse, status: number, body: unknown): true {
  send(res, status, body);
  return true;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 60 * 1024 * 1024) throw new HttpError(413, 'request too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  } catch {}
  throw new HttpError(400, 'invalid JSON body');
}

function hostnameOf(host: string | undefined): string {
  if (!host) return '';
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0];
}

/**
 * The server writes to the author's files, so a web page on another origin
 * must not be able to drive it: block DNS rebinding (unexpected Host) and
 * cross-site mutations (Origin / Sec-Fetch-Site).
 */
function guard(req: IncomingMessage, allowAnyHost: boolean) {
  if (!allowAnyHost && !LOCAL_HOSTS.has(hostnameOf(req.headers.host).toLowerCase())) {
    throw new HttpError(403, 'unexpected host');
  }
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new HttpError(403, 'cross-site request blocked');
  }
  const origin = req.headers.origin;
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== req.headers.host) throw new HttpError(403, 'origin mismatch');
  }
  if (req.method !== 'DELETE') {
    const type = req.headers['content-type'] ?? '';
    if (!type.startsWith('application/json')) {
      throw new HttpError(415, 'content-type must be application/json');
    }
  }
}

function str(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be a string`);
  return value;
}

function int(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, `${name} must be a non-negative integer`);
  }
  return value;
}

function optionalStr(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export async function startServer(
  project: Project,
  opts: ServerOptions = {},
): Promise<RunningServer> {
  const host = opts.host ?? '127.0.0.1';
  const allowAnyHost = !['127.0.0.1', 'localhost', '::1'].includes(host);
  const webDir = opts.webDir ?? defaultWebDir();
  const templateDir = opts.bookTemplateDir;
  const clients = new Set<ServerResponse>();

  const broadcast = (event: Record<string, unknown>) => {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(data);
  };

  // Seed history with what is on disk now, so the first change is undoable.
  for (const bookId of await project.listBookIds()) {
    const book = project.book(bookId);
    for (const id of await book.listChapterFiles()) {
      try {
        book.history.remember(id, (await book.readChapter(id)).source);
      } catch {}
    }
  }

  const watcher: FSWatcher = chokidar.watch([project.booksDir, project.configPath], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    ignored: (path) => path.endsWith('.mosage-tmp') || path.includes(`${sep}node_modules${sep}`),
  });
  const pending = new Map<string, NodeJS.Timeout>();
  watcher.on('all', (_event, path) => {
    clearTimeout(pending.get(path));
    pending.set(
      path,
      setTimeout(async () => {
        pending.delete(path);
        // books/<book>/chapters/<file>.md
        const [bookId, folder, file, extra] = relative(project.booksDir, path).split(sep);
        if (bookId && !bookId.startsWith('..')) {
          if (folder === 'chapters' && file && !extra && isChapterId(file)) {
            try {
              const book = project.book(bookId);
              await book.history.observe(file, (await book.readChapter(file)).source);
            } catch {}
            broadcast({ type: 'chapter', book: bookId, id: file });
          } else if (folder === 'assets') {
            broadcast({ type: 'assets', book: bookId });
          }
          broadcast({ type: 'book', book: bookId });
        }
        broadcast({ type: 'library' });
      }, 80),
    );
  });

  const libraryRoutes = async (
    req: IncomingMessage,
    res: ServerResponse,
    route: string,
  ): Promise<boolean> => {
    switch (route) {
      case 'GET /library': {
        const defaults = await project.loadDefaults();
        return reply(res, 200, {
          name: basename(project.root),
          author: typeof defaults.author === 'string' ? defaults.author : '',
          books: await project.listBooks(),
        });
      }
      case 'POST /books': {
        if (!templateDir) throw new HttpError(500, 'book template missing');
        const body = await readJson(req);
        const type = optionalStr(body.type);
        if (type && !['book', 'thesis', 'other'].includes(type)) {
          throw new HttpError(400, 'invalid type');
        }
        const book = await project.createBook(templateDir, {
          id: optionalStr(body.id),
          title: optionalStr(body.title),
          type: type as ProjectType | undefined,
        });
        return reply(res, 201, { id: book.id });
      }
      case 'POST /books/order': {
        const body = await readJson(req);
        if (!Array.isArray(body.books)) throw new HttpError(400, 'books must be an array');
        await project.setBookOrder(body.books.map((b) => str(b, 'book')));
        return reply(res, 200, { ok: true });
      }
      case 'POST /current': {
        const body = await readJson(req);
        await project.writeCurrent(body);
        return reply(res, 200, { ok: true });
      }
      case 'GET /events': {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
        res.write('retry: 1500\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return true;
      }
    }
    return false;
  };

  const bookRoutes = async (
    req: IncomingMessage,
    res: ServerResponse,
    book: Book,
    parts: string[],
    url: URL,
  ): Promise<boolean> => {
    const route = routeKey(req.method ?? 'GET', parts);
    const id = parts[1];

    switch (route) {
      case 'GET /':
        return reply(res, 200, await book.summarize());

      case 'POST /config': {
        const body = await readJson(req);
        await book.updateConfig((doc) => {
          for (const key of ['title', 'subtitle', 'author'] as const) {
            if (typeof body[key] === 'string') doc.set(key, (body[key] as string).trim());
          }
          if (typeof body.stage === 'string') {
            if (!STAGES.includes(body.stage as Stage)) throw new HttpError(400, 'invalid stage');
            doc.set('stage', body.stage);
          }
          if (typeof body.targetWords === 'number' && body.targetWords >= 0) {
            doc.set('targetWords', Math.round(body.targetWords));
          }
        });
        return reply(res, 200, await book.summarize());
      }

      case 'POST /order': {
        const body = await readJson(req);
        if (!Array.isArray(body.chapters)) throw new HttpError(400, 'chapters must be an array');
        await book.setChapterOrder(body.chapters.map((c) => str(c, 'chapter')));
        return reply(res, 200, await book.summarize());
      }

      case 'POST /chapters': {
        const body = await readJson(req);
        const newId = await book.createChapter(str(body.title, 'title'), {
          summary: optionalStr(body.summary),
        });
        return reply(res, 201, { id: newId });
      }

      case 'GET /chapters/:id':
        return reply(res, 200, await book.readChapter(id));

      case 'PUT /chapters/:id': {
        const body = await readJson(req);
        const version = await book.writeChapter(
          id,
          str(body.source, 'source'),
          optionalStr(body.baseVersion),
        );
        return reply(res, 200, { version });
      }

      case 'PATCH /chapters/:id': {
        const body = await readJson(req);
        let base = optionalStr(body.baseVersion);
        if (typeof body.title === 'string') base = await book.setChapterTitle(id, body.title, base);
        if (typeof body.summary === 'string') {
          base = await book.setChapterSummary(id, body.summary, base);
        }
        if (typeof body.status === 'string') {
          base = await book.setChapterStatus(id, body.status as ChapterStatus, base);
        }
        return reply(res, 200, { version: base });
      }

      case 'POST /chapters/:id/list': {
        const body = await readJson(req);
        await book.addToOrder(id, typeof body.position === 'number' ? body.position : undefined);
        return reply(res, 200, await book.summarize());
      }

      case 'POST /chapters/:id/unlist':
        await book.removeFromOrder(id);
        return reply(res, 200, await book.summarize());

      case 'POST /chapters/:id/replace': {
        const body = await readJson(req);
        const start = int(body.start, 'start');
        const end = int(body.end, 'end');
        const expected = str(body.expected, 'expected');
        const text = str(body.text, 'text');
        const version = await book.transformChapter(id, (s) =>
          replaceRange(s, start, end, expected, text),
        );
        return reply(res, 200, { version });
      }

      case 'POST /chapters/:id/comments': {
        const body = await readJson(req);
        let newId = '';
        const version = await book.transformChapter(id, (s) => {
          const out = insertComment(s, {
            blockStart: int(body.blockStart, 'blockStart'),
            blockText: str(body.blockText, 'blockText'),
            body: str(body.body, 'body'),
            quote: optionalStr(body.quote),
          });
          newId = out.id;
          return out.source;
        });
        return reply(res, 201, { id: newId, version });
      }

      case 'DELETE /chapters/:id/annotations/:ann': {
        const version = await book.transformChapter(id, (s) => removeAnnotation(s, parts[3]));
        return reply(res, 200, { version });
      }

      case 'POST /chapters/:id/annotations/:ann/accept': {
        const version = await book.transformChapter(id, (s) => acceptSuggestion(s, parts[3]));
        return reply(res, 200, { version });
      }

      case 'GET /chapters/:id/history':
        book.chapterPath(id);
        return reply(res, 200, { snapshots: await book.history.list(id) });

      case 'GET /chapters/:id/history/:snap':
        book.chapterPath(id);
        return reply(res, 200, { source: await book.history.read(id, parts[3]) });

      case 'POST /chapters/:id/history/:snap/restore': {
        const snapshot = await book.history.read(id, parts[3]);
        const current = await book.readChapter(id);
        await book.history.snapshot(id, current.source, true);
        const version = await book.writeChapter(id, snapshot);
        return reply(res, 200, { version });
      }

      case 'GET /doc/brief':
      case 'GET /doc/style': {
        const file = join(book.root, parts[1] === 'brief' ? 'brief.md' : 'STYLE.md');
        const source = existsSync(file) ? await readFile(file, 'utf8') : '';
        return reply(res, 200, { source });
      }

      case 'PUT /doc/brief':
      case 'PUT /doc/style': {
        const body = await readJson(req);
        const file = join(book.root, parts[1] === 'brief' ? 'brief.md' : 'STYLE.md');
        await writeFile(file, str(body.source, 'source'));
        return reply(res, 200, { ok: true });
      }

      case 'GET /files':
        return reply(res, 200, await book.listFiles());

      case 'POST /files': {
        const body = await readJson(req);
        const folder = str(body.folder, 'folder') as FileFolder;
        const data = Buffer.from(str(body.data, 'data'), 'base64');
        const name = await book.saveFile(folder, str(body.name, 'name'), data);
        return reply(res, 201, { name, path: `${folder}/${name}` });
      }

      case 'DELETE /files': {
        const folder = url.searchParams.get('folder') ?? '';
        const name = url.searchParams.get('name') ?? '';
        await book.trashFile(folder as FileFolder, name);
        return reply(res, 200, { ok: true });
      }

      case 'GET /export/docx':
      case 'GET /export/html':
      case 'GET /export/md': {
        const format = parts[1] as ExportFormat;
        // Loaded on demand: the exporters pull in the heavy docx library.
        const { renderManuscript } = await import('./export/index.ts');
        const file = await renderManuscript(book, format);
        res.writeHead(200, {
          'content-type': file.contentType,
          'content-length': file.data.length,
          'content-disposition': `attachment; filename="${book.id}.${format}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
          'cache-control': 'no-store',
        });
        res.end(file.data);
        return true;
      }
    }
    return false;
  };

  const api = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
    const method = req.method ?? 'GET';
    if (await libraryRoutes(req, res, `${method} /${parts.join('/')}`)) return;
    if (parts[0] === 'books' && parts[1] && parts[1] !== 'order') {
      if (await bookRoutes(req, res, project.book(parts[1]), parts.slice(2), url)) return;
    }
    throw new HttpError(404, `no route for ${method} ${url.pathname}`);
  };

  /** Files of the project (images under assets/, etc.) — never dotfiles. */
  const serveProjectFile = async (res: ServerResponse, rel: string) => {
    const path = resolve(project.root, normalize(rel).replace(/^([/\\])+/, ''));
    const inside = relative(project.root, path);
    if (
      inside.startsWith('..') ||
      inside.split(sep).some((seg) => seg.startsWith('.')) ||
      !existsSync(path) ||
      !(await stat(path)).isFile()
    ) {
      throw new HttpError(404, 'not found');
    }
    res.writeHead(200, {
      'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(await readFile(path));
  };

  const serveWeb = async (res: ServerResponse, pathname: string) => {
    const file = resolve(webDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    const target =
      file.startsWith(resolve(webDir)) && existsSync(file) && (await stat(file)).isFile()
        ? file
        : join(webDir, 'index.html');
    if (!existsSync(target)) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('MoSage web UI is not built. Run `npm run build:web` in the mosage package.');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      'cache-control': target.includes(`${sep}assets${sep}`)
        ? 'max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(await readFile(target));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      guard(req, allowAnyHost);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname.startsWith('/files/')) {
        return await serveProjectFile(
          res,
          decodeURIComponent(url.pathname.slice('/files/'.length)),
        );
      }
      return await serveWeb(res, url.pathname);
    } catch (err) {
      const status =
        err instanceof HttpError || err instanceof ProjectError
          ? err.status
          : err instanceof EditConflict
            ? 409
            : (err as NodeJS.ErrnoException)?.code === 'ENOENT'
              ? 404
              : 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: (err as Error).message ?? String(err) });
      else res.end();
    }
  });

  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 25_000);

  const port = await listen(server, host, opts.port ?? 5280);
  const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  return {
    url: `http://${shownHost.includes(':') ? `[${shownHost}]` : shownHost}:${port}`,
    server,
    async close() {
      clearInterval(heartbeat);
      for (const res of clients) res.end();
      await watcher.close();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

/** `POST /chapters/:id/annotations/:ann/accept` style key for the switch. */
function routeKey(method: string, parts: string[]): string {
  if (parts.length === 0) return `${method} /`;
  const shape = parts.map((part, i) => {
    if (parts[0] !== 'chapters') return part;
    if (i === 1) return ':id';
    if (i === 3 && parts[2] === 'annotations') return ':ann';
    if (i === 3 && parts[2] === 'history') return ':snap';
    return part;
  });
  return `${method} /${shape.join('/')}`;
}

/** Listen on `port`, or the next free one. */
async function listen(server: Server, host: string, port: number): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await new Promise<void>((ok, fail) => {
        server.once('error', fail);
        server.listen(port + attempt, host, () => {
          server.off('error', fail);
          ok();
        });
      });
      return (server.address() as AddressInfo).port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port === 0) throw err;
    }
  }
  throw new Error(`No free port found from ${port}`);
}
