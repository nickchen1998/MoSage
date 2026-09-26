#!/usr/bin/env node
// End-to-end check of the published package, the way a user meets it:
//
//   npm pack → npx <tarball> init → mosage new / status / export / import
//   → mosage dev → JSON API → (optional) a real browser clicking around.
//
// Run after `npm run build`. Set MOSAGE_E2E_BROWSER=1 to include the browser
// part (needs `playwright` and a Chromium: `npx playwright install chromium`,
// or point PLAYWRIGHT_CHROMIUM_PATH at an existing binary).

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const WIN = process.platform === 'win32';
const work = mkdtempSync(join(tmpdir(), 'mosage-e2e-'));
let server = null;
let failures = 0;

function run(cmd, args, cwd, env = {}) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
    shell: WIN,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function check(name, ok, detail = '') {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not come up at ${url}`);
}

async function main() {
  console.log(`\nworking in ${work}\n`);

  console.log('pack');
  const packed = JSON.parse(
    run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', work], ROOT),
  );
  const tarball = join(work, packed[0].filename);
  const files = packed[0].files.map((f) => f.path);
  check('tarball has the CLI', files.includes('dist/cli.js'));
  check('tarball has the web UI', files.includes('dist/web/index.html'));
  check('tarball has templates', files.includes('template/project/mosage.yaml'));
  check('tarball has skills', files.includes('skills/kickoff/SKILL.md'));
  check(
    'tarball has no tests or sources',
    !files.some((f) => f.startsWith('test/') || f.startsWith('src/')),
  );

  console.log('\nnpx mosage init');
  const out = run(
    'npx',
    ['--yes', `--package=${tarball}`, 'mosage', 'init', 'my-writing', '--no-install', '--no-git'],
    work,
  );
  const project = join(work, 'my-writing');
  check('prints next steps', out.includes('/kickoff'), out);
  for (const f of [
    'mosage.yaml',
    'AGENTS.md',
    'CLAUDE.md',
    '.gitignore',
    'books',
    'notes/README.md',
  ]) {
    check(`creates ${f}`, existsSync(join(project, f)));
  }
  check('installs skills for Codex', existsSync(join(project, '.agents/skills/kickoff/SKILL.md')));
  check(
    'installs skills for Claude Code',
    existsSync(join(project, '.claude/skills/kickoff/SKILL.md')),
  );
  const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  check('pins mosage in package.json', Boolean(pkg.devDependencies?.mosage));

  // Use the packed build inside the project, like `npm install` would.
  run('npm', ['install', '--no-audit', '--no-fund', '--silent', tarball], project);
  const mosage = (...args) => run('npx', ['--no-install', 'mosage', ...args], project);

  console.log('\nmosage new / status');
  mosage('new', 'field-notes', '--title', '田野筆記', '--type', 'book');
  mosage('new', 'thesis', '--title', '生成式 AI 與寫作', '--type', 'thesis');
  const book = join(project, 'books/field-notes');
  check(
    'creates a book folder',
    existsSync(join(book, 'book.yaml')) && existsSync(join(book, 'brief.md')),
  );
  writeFileSync(
    join(book, 'chapters/01-start.md'),
    '---\nstatus: draft\n---\n\n# 第一章　出發\n\n這是第一段，有一個註腳[^1]。\n\n<!-- mosage:comment by=human\n寫長一點\n-->\n第二段。\n\n| 欄 | 值 |\n| --- | --- |\n| 一 | 1 |\n\n[^1]: 註腳內容。\n',
  );
  const yaml = readFileSync(join(book, 'book.yaml'), 'utf8').replace(
    'chapters: []',
    'chapters:\n  - 01-start.md',
  );
  writeFileSync(join(book, 'book.yaml'), yaml);
  const lib = JSON.parse(mosage('status', '--json'));
  check('status lists both books', lib.books?.length === 2, JSON.stringify(lib).slice(0, 200));
  const status = JSON.parse(mosage('status', 'field-notes', '--json'));
  check('status counts the comment', status.totals.comments === 1);
  check(
    'status reports the marker line',
    status.notes?.[0]?.line === 9,
    JSON.stringify(status.notes),
  );

  console.log('\nmosage export');
  mosage('export', 'field-notes', 'docx');
  mosage('export', 'field-notes', 'html');
  mosage('export', 'field-notes', 'md');
  const outDir = join(project, 'output/field-notes');
  const outputs = existsSync(outDir) ? readdirSync(outDir) : [];
  check(
    'writes a .docx',
    outputs.some((f) => f.endsWith('.docx')),
    outputs.join(', '),
  );
  check(
    'writes a .html',
    outputs.some((f) => f.endsWith('.html')),
  );
  const md = outputs.find((f) => f.endsWith('.md'));
  check(
    'writes a .md without markers',
    md && !readFileSync(join(outDir, md), 'utf8').includes('mosage:'),
  );

  console.log('\nmosage import');
  const docx = join(
    outDir,
    outputs.find((f) => f.endsWith('.docx')),
  );
  const imported = mosage('import', docx, '--book', 'reimported', '--title', '匯入測試');
  check('imports the exported Word file', /匯入 \d+ 個章節/.test(imported), imported);
  const again = JSON.parse(mosage('status', 'reimported', '--json'));
  check(
    'imported chapter keeps its title',
    again.chapters.some((c) => c.title.includes('出發')),
    JSON.stringify(again.chapters.map((c) => c.title)),
  );

  console.log('\nmosage dev');
  const port = 5400 + Math.floor(Math.random() * 400);
  server = spawn('npx', ['--no-install', 'mosage', 'dev', '--port', String(port), '--no-open'], {
    cwd: project,
    env: { ...process.env, NO_COLOR: '1' },
    shell: WIN,
    stdio: 'ignore',
  });
  const base = `http://localhost:${port}`;
  await waitFor(`${base}/api/library`);
  const html = await (await fetch(`${base}/`)).text();
  check('serves the web UI', html.includes('<div id="root">'));
  const library = await (await fetch(`${base}/api/library`)).json();
  check('API lists the books', library.books.length === 3);
  const exported = await fetch(`${base}/api/books/field-notes/export/docx`);
  check(
    'API exports Word',
    exported.ok &&
      exported.headers.get('content-type')?.includes('wordprocessingml') &&
      (await exported.arrayBuffer()).byteLength > 1000,
  );

  if (process.env.MOSAGE_E2E_BROWSER) await browser(base);
}

async function browser(base) {
  console.log('\nbrowser');
  const { chromium } = await import('playwright');
  const b = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${base}/#/`);
    await page.waitForSelector('.book-card');
    check('bookshelf shows the books', (await page.locator('a.book-card').count()) === 3);

    await page.goto(`${base}/#/b/field-notes`);
    await page.waitForSelector('.chapter-row');
    check('outline shows the chapter', (await page.locator('.chapter-row').count()) === 1);

    await page.goto(`${base}/#/b/field-notes/read/01-start.md`);
    await page.waitForSelector('.chapter-doc');
    check('reader renders the heading', (await page.locator('h1').innerText()).includes('出發'));
    check('reader shows the pending comment', (await page.locator('.note-human').count()) === 1);

    // Comment on the first paragraph through the UI.
    const para = page.locator('.block-paragraph').first();
    await para.hover();
    await para.locator('.block-tools button').first().click();
    await page.locator('.note-input').fill('加一個例子');
    await page.getByRole('button', { name: '送出' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.note-human').length === 2);
    const source = readFileSync(
      join(work, 'my-writing/books/field-notes/chapters/01-start.md'),
      'utf8',
    );
    check('UI comment is written into the Markdown file', source.includes('加一個例子'));

    // Live update: the "AI" edits the file, the page follows.
    writeFileSync(
      join(work, 'my-writing/books/field-notes/chapters/01-start.md'),
      source.replace('第二段。', '第二段，AI 剛剛改寫了這裡。'),
    );
    await page.waitForSelector('text=AI 剛剛改寫了這裡', { timeout: 8000 });
    check('page updates live when the file changes', true);
    check('no page errors', errors.length === 0, errors.join('\n'));
  } catch (err) {
    check('browser flow', false, String(err));
    await page.screenshot({ path: join(work, 'e2e-failure.png') }).catch(() => {});
  } finally {
    await b.close();
  }
}

try {
  await main();
} catch (err) {
  failures++;
  console.error(`\n✗ ${err.stack ?? err}`);
} finally {
  if (server?.pid && WIN) {
    try {
      execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  } else server?.kill();
  if (failures === 0) rmSync(work, { recursive: true, force: true });
  console.log(
    failures
      ? `\n${failures} check(s) failed — files kept in ${work}\n`
      : '\nall e2e checks passed\n',
  );
  process.exit(failures ? 1 : 0);
}
