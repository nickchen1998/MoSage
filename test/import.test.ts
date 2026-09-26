import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import type { Book } from '../src/node/book.ts';
import { BOOK_FILE } from '../src/node/book.ts';
import { htmlToMarkdown, importFile, splitManuscript } from '../src/node/import/index.ts';
import { makeBook, makePng } from './helpers.ts';

let dir: string;
let ws: Book;
let src: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mosage-import-'));
  ws = makeBook(dir);
  src = join(dir, 'source');
  mkdirSync(join(src, 'img'), { recursive: true });
  writeFileSync(join(src, 'img', 'map.png'), makePng(20, 10));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function chapter(id: string): Promise<string> {
  return (await ws.readChapter(id)).source;
}

function titleOf(source: string): string | undefined {
  return source.match(/^# (.+)$/m)?.[1];
}

describe('importFile (Markdown)', () => {
  it('cuts at every H1, keeps the text before it, and moves footnotes and images', async () => {
    const file = join(src, '書稿.md');
    writeFileSync(
      file,
      [
        '---',
        'title: 舊的 frontmatter',
        '---',
        '',
        '獻給我的家人。',
        '',
        '# 第一章　起點',
        '',
        '第一章內文[^a]，附圖：',
        '',
        '![地圖](img/map.png "路線")',
        '',
        '## 第一節',
        '',
        '小節內文。',
        '',
        '# 第二章　終點',
        '',
        '第二章內文[^b]，再看一次 ![地圖](./img/map.png) 和 ![不見了](img/none.png)。',
        '',
        '[^a]: 第一章的註腳。',
        '[^b]: 第二章的註腳。',
        '',
      ].join('\n'),
    );
    const result = await importFile(ws, file);
    expect(result.created).toHaveLength(3);
    const [front, one, two] = await Promise.all(result.created.map(chapter));
    expect(titleOf(front)).toBe('前言素材');
    expect(front).toContain('獻給我的家人。');
    expect(front).not.toContain('舊的 frontmatter');
    expect(front).toContain('status: draft');

    expect(titleOf(one)).toBe('第一章　起點');
    expect(one).toContain('第一章內文[^a]');
    expect(one).toContain('[^a]: 第一章的註腳。');
    expect(one).not.toContain('[^b]:');
    expect(one).toContain('![地圖](../assets/imported/map.png "路線")');
    expect(one).toContain('## 第一節');

    expect(titleOf(two)).toBe('第二章　終點');
    expect(two).toContain('[^b]: 第二章的註腳。');
    expect(two).not.toContain('[^a]:');
    expect(two).toContain('![地圖](../assets/imported/map.png)');
    expect(two).toContain('![不見了](img/none.png)');

    // One copy of the image, and a warning about the missing one.
    expect(result.assets).toEqual(['assets/imported/map.png']);
    expect(existsSync(join(ws.root, 'assets', 'imported', 'map.png'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('img/none.png'))).toBe(true);

    const config = await ws.loadConfig();
    expect(config.chapters).toEqual(result.created);
  });

  it('splits at H2 when there is no H1, promoting every heading one level', async () => {
    const file = join(src, 'notes.md');
    writeFileSync(
      file,
      '## 甲章\n\n甲的內容。\n\n### 甲一\n\n細節。\n\n## 乙章\n\n乙的內容。\n\n#### 更深\n',
    );
    const result = await importFile(ws, file);
    const sources = await Promise.all(result.created.map(chapter));
    expect(sources.map(titleOf)).toEqual(['甲章', '乙章']);
    expect(sources[0]).toContain('\n## 甲一\n');
    expect(sources[0]).not.toContain('###');
    expect(sources[1]).toContain('\n### 更深');
    expect(result.warnings).toEqual([]);
  });

  it('imports text without headings as one chapter named after the file, with a warning', async () => {
    const file = join(src, '我的草稿.txt');
    writeFileSync(file, '第一段。\n\n第二段。\n');
    const result = await importFile(ws, file);
    expect(result.created).toHaveLength(1);
    const source = await chapter(result.created[0]);
    expect(titleOf(source)).toBe('我的草稿');
    expect(source).toContain('第一段。\n\n第二段。');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('標題');
    expect(result.warnings[0]).toContain('AI');
  });

  it('keeps everything in one chapter without split, and can leave chapters unlisted', async () => {
    const file = join(src, 'whole.md');
    writeFileSync(file, '# 一\n\n內容一\n\n# 二\n\n內容二\n');
    const result = await importFile(ws, file, { split: false, listed: false });
    expect(result.created).toHaveLength(1);
    const source = await chapter(result.created[0]);
    expect(titleOf(source)).toBe('whole');
    expect(source).toContain('## 一');
    expect(source).toContain('## 二');
    expect((await ws.loadConfig()).chapters).toEqual([]);
  });

  it('never overwrites existing chapters and names front matter in English for English books', async () => {
    writeFileSync(join(ws.root, BOOK_FILE), stringify({ title: 'Book', language: 'en-US' }));
    const file = join(src, 'draft.md');
    writeFileSync(file, 'Preface text.\n\n# One\n\nBody.\n');
    const first = await importFile(ws, file);
    const second = await importFile(ws, file);
    expect(new Set([...first.created, ...second.created]).size).toBe(4);
    expect(titleOf(await chapter(first.created[0]))).toBe('Front matter');
    expect(readFileSync(join(ws.chaptersDir, first.created[1]), 'utf8')).toContain('Body.');
  });

  it('rejects files it cannot read', async () => {
    const file = join(src, 'old.doc');
    writeFileSync(file, 'binary');
    await expect(importFile(ws, file)).rejects.toThrow('.docx');
    await expect(importFile(ws, join(src, 'nope.md'))).rejects.toThrow('找不到檔案');
  });
});

describe('htmlToMarkdown', () => {
  it('turns mammoth footnotes into GFM footnotes and header-less tables into GFM tables', () => {
    const html = [
      '<h1><a id="_Toc1"></a>第一章</h1>',
      '<p>本文<sup><a href="#footnote-1" id="footnote-ref-1">[1]</a></sup>，連到<a href="#_Toc1">第一章</a>，網址 <a href="https://example.com">https://example.com</a>。</p>',
      '<table><tr><td><p>甲</p></td><td><p>乙</p></td></tr><tr><td><p>1</p></td><td><p>2|3</p></td></tr></table>',
      '<ul><li>一</li><li>二<ol><li>子</li></ol></li></ul>',
      '<pre>line 1<br />  line 2</pre>',
      '<p class="scene-break">＊　＊　＊</p>',
      '<blockquote class="callout"><p><strong>提示</strong></p><p>內容</p></blockquote>',
      '<ol><li id="footnote-1"><p> 註腳文字。 <a href="#footnote-ref-1">↑</a></p></li></ol>',
    ].join('');
    const md = htmlToMarkdown(html);
    expect(md).toContain('# 第一章');
    expect(md).toContain('本文[^1]，連到第一章，網址 <https://example.com>。');
    expect(md).toContain('| 甲 | 乙 |\n| --- | --- |\n| 1 | 2\\|3 |');
    expect(md).toContain('- 一\n- 二\n  1. 子');
    expect(md).toContain('```\nline 1\n  line 2\n```');
    expect(md).toContain('\n---\n');
    expect(md).toContain('> [!TIP]\n> 內容');
    expect(md).toContain('[^1]: 註腳文字。');
    expect(md).not.toContain('↑');
    expect(md).not.toContain('footnote-ref');
  });
});

describe('splitManuscript', () => {
  it('gives each chapter the link definitions it uses', () => {
    const { chapters } = splitManuscript(
      '# 甲\n\n見 [網站][site]。\n\n# 乙\n\n無。\n\n[site]: https://example.com\n',
      {
        split: true,
        fallbackTitle: 'x',
        frontMatterTitle: '前言素材',
      },
    );
    expect(chapters.map((c) => c.title)).toEqual(['甲', '乙']);
    expect(chapters[0].body).toContain('[site]: https://example.com');
    expect(chapters[1].body).toBe('無。');
  });
});
