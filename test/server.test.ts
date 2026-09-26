import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Project } from '../src/node/project.ts';
import { type RunningServer, startServer } from '../src/node/server.ts';
import { parseChapter } from '../src/shared/markdown.ts';

const BOOK_TEMPLATE = join(import.meta.dirname, '..', 'template', 'book');
const PROJECT_TEMPLATE = join(import.meta.dirname, '..', 'template', 'project');

let dir: string;
let project: Project;
let server: RunningServer;

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${server.url}/api${path}`, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mosage-server-'));
  await writeFile(join(dir, 'mosage.yaml'), await readFile(join(PROJECT_TEMPLATE, 'mosage.yaml')));
  project = new Project(dir);
  server = await startServer(project, { port: 0, bookTemplateDir: BOOK_TEMPLATE, webDir: dir });
});

afterAll(async () => {
  await server?.close();
  await rm(dir, { recursive: true, force: true });
});

describe('dev server API', () => {
  it('starts with an empty shelf', async () => {
    const { data } = await call<{ books: unknown[] }>('GET', '/library');
    expect(data.books).toEqual([]);
  });

  it('creates a book with project defaults applied', async () => {
    await project.updateConfig((doc) => doc.set('author', '陳作者'));
    const created = await call<{ id: string }>('POST', '/books', {
      title: 'AI Writing Guide',
      type: 'thesis',
    });
    expect(created.status).toBe(201);
    expect(created.data.id).toBe('ai-writing-guide');
    const { data } = await call<{
      config: { title: string; type: string; author: string; export: { fonts: { body: string } } };
      hasBrief: boolean;
    }>('GET', '/books/ai-writing-guide');
    expect(data.config.title).toBe('AI Writing Guide');
    expect(data.config.type).toBe('thesis');
    expect(data.config.author).toBe('陳作者');
    expect(data.config.export.fonts.body).toBe('標楷體');
    expect(data.hasBrief).toBe(false);
  });

  it('creates, orders and edits chapters', async () => {
    const a = await call<{ id: string }>('POST', '/books/ai-writing-guide/chapters', {
      title: 'Why',
      summary: '為什麼要寫',
    });
    const b = await call<{ id: string }>('POST', '/books/ai-writing-guide/chapters', {
      title: '第二章　方法',
    });
    expect(a.data.id).toBe('01-why.md');
    expect(b.data.id).toBe('02-chapter.md');

    await call('POST', '/books/ai-writing-guide/order', { chapters: [b.data.id, a.data.id] });
    const book = await call<{ chapters: { id: string; summary: string; status: string }[] }>(
      'GET',
      '/books/ai-writing-guide',
    );
    expect(book.data.chapters.map((c) => c.id)).toEqual(['02-chapter.md', '01-why.md']);
    expect(book.data.chapters[1].summary).toBe('為什麼要寫');
    expect(book.data.chapters[1].status).toBe('idea');

    await call('PATCH', '/books/ai-writing-guide/chapters/01-why.md', {
      title: '第一章　為什麼',
      status: 'draft',
    });
    const src = await call<{ source: string }>('GET', '/books/ai-writing-guide/chapters/01-why.md');
    const parsed = parseChapter(src.data.source);
    expect(parsed.title).toBe('第一章　為什麼');
    expect(parsed.frontmatter.status).toBe('draft');
  });

  it('round-trips a comment and a suggestion', async () => {
    const path = '/books/ai-writing-guide/chapters/01-why.md';
    const { data } = await call<{ source: string; version: string }>('GET', path);
    const withBody = `${data.source}第一段。\n\n第二段。\n`;
    await call('PUT', path, { source: withBody, baseVersion: data.version });

    const parsed = parseChapter(withBody);
    const para = parsed.blocks.find((blk) => withBody.slice(blk.start).startsWith('第二段'))!;
    const commented = await call<{ id: string }>('POST', `${path}/comments`, {
      blockStart: para.start,
      blockText: withBody.slice(para.start, para.end),
      body: '寫長一點',
      quote: '第二',
    });
    expect(commented.status).toBe(201);

    const lib = await call<{ books: { totals: { comments: number } }[] }>('GET', '/library');
    expect(lib.data.books[0].totals.comments).toBe(1);

    // The agent answers with a suggestion.
    const now = await call<{ source: string }>('GET', path);
    const answered = now.data.source.replace(
      /<!-- mosage:comment[\s\S]*?-->\n/,
      '<!-- mosage:suggest by=ai note="加長"\n第二段，加長之後的版本。\n-->\n',
    );
    await writeFile(join(dir, 'books/ai-writing-guide/chapters/01-why.md'), answered);
    const suggestion = parseChapter(answered).annotations[0];
    const accepted = await call('POST', `${path}/annotations/${suggestion.id}/accept`, {});
    expect(accepted.status).toBe(200);
    const final = await call<{ source: string }>('GET', path);
    expect(final.data.source).toContain('第二段，加長之後的版本。');
    expect(final.data.source).not.toContain('mosage:');
  });

  it('rejects stale writes', async () => {
    const path = '/books/ai-writing-guide/chapters/01-why.md';
    const res = await call('PUT', path, { source: 'x', baseVersion: 'stale' });
    expect(res.status).toBe(409);
    const edit = await call('POST', `${path}/replace`, {
      start: 0,
      end: 3,
      expected: 'nope',
      text: 'x',
    });
    expect(edit.status).toBe(409);
  });

  it('stores uploaded files in the book folder without overwriting', async () => {
    const png = Buffer.from('fake-png').toString('base64');
    const first = await call<{ path: string }>('POST', '/books/ai-writing-guide/files', {
      folder: 'assets',
      name: '../圖 一.png',
      data: png,
    });
    const second = await call<{ path: string }>('POST', '/books/ai-writing-guide/files', {
      folder: 'assets',
      name: '圖 一.png',
      data: png,
    });
    expect(first.data.path).toBe('assets/圖-一.png');
    expect(second.data.path).toBe('assets/圖-一-2.png');
    const files = await call<{ assets: { name: string; used: boolean }[] }>(
      'GET',
      '/books/ai-writing-guide/files',
    );
    expect(files.data.assets.map((f) => f.name)).toEqual(['圖-一-2.png', '圖-一.png']);
    const img = await fetch(
      `${server.url}/files/books/ai-writing-guide/assets/${encodeURIComponent('圖-一.png')}`,
    );
    expect(await img.text()).toBe('fake-png');
  });

  it('keeps history snapshots and restores them', async () => {
    const path = '/books/ai-writing-guide/chapters/02-chapter.md';
    const { data } = await call<{ source: string; version: string }>('GET', path);
    await call('PUT', path, { source: `${data.source}新內容。\n`, baseVersion: data.version });
    const { data: hist } = await call<{ snapshots: { id: string }[] }>('GET', `${path}/history`);
    expect(hist.snapshots.length).toBeGreaterThan(0);
    await call('POST', `${path}/history/${hist.snapshots[0].id}/restore`, {});
    const after = await call<{ source: string }>('GET', path);
    expect(after.data.source).toBe(data.source);
  });

  it('writes the current position for the agent', async () => {
    await call('POST', '/current', {
      view: 'read',
      book: 'ai-writing-guide',
      chapter: '01-why.md',
    });
    const current = JSON.parse(await readFile(join(dir, '.mosage/current.json'), 'utf8'));
    expect(current.chapter).toBe('01-why.md');
    expect(current.updatedAt).toBeTruthy();
  });

  it('blocks cross-origin writes, foreign hosts and path traversal', async () => {
    const cross = await call('POST', '/current', {}, { origin: 'https://evil.example' });
    expect(cross.status).toBe(403);
    // fetch() won't let us forge Host, so use a raw request (DNS rebinding).
    const hostStatus = await new Promise<number>((resolve, reject) => {
      const url = new URL(`${server.url}/api/library`);
      request(url, { headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
        .on('error', reject)
        .end();
    });
    expect(hostStatus).toBe(403);
    const traversal = await fetch(`${server.url}/files/..%2F..%2Fetc%2Fpasswd`);
    expect(traversal.status).toBe(404);
    const dotfile = await fetch(`${server.url}/files/.mosage/current.json`);
    expect(dotfile.status).toBe(404);
    const plain = await fetch(`${server.url}/api/current`, { method: 'POST', body: '{}' });
    expect(plain.status).toBe(415);
  });

  it('pushes a live event when a chapter changes on disk', async () => {
    const res = await fetch(`${server.url}/api/events`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    await writeFile(
      join(dir, 'books/ai-writing-guide/chapters/01-why.md'),
      '# 第一章　為什麼\n\nAI 改了這一章。\n',
    );
    let received = '';
    const deadline = Date.now() + 5000;
    while (!received.includes('"id":"01-why.md"') && Date.now() < deadline) {
      const { value } = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined }>((r) => setTimeout(() => r({ value: undefined }), 500)),
      ]);
      if (value) received += decoder.decode(value);
    }
    await reader.cancel();
    expect(received).toContain('"book":"ai-writing-guide"');
    expect(received).toContain('"id":"01-why.md"');
  });
});
