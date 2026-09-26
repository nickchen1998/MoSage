import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { buildDocx } from '../src/node/export/docx.ts';
import { buildHtml } from '../src/node/export/html.ts';
import { exportManuscript, renderManuscript } from '../src/node/export/index.ts';
import { buildMarkdown } from '../src/node/export/markdown.ts';
import type { ManuscriptInput } from '../src/node/export/types.ts';
import { importFile } from '../src/node/import/index.ts';
import { resolveConfig } from '../src/shared/config.ts';
import { CONFIG_FILE, Workspace } from '../src/node/workspace.ts';
import { makePng } from './helpers.ts';

const CHAPTER_ONE = `---
status: draft
summary: 開場
---

# 第一章　出發

她在清晨出發，**天色**還暗，*霧*很濃，~~沒有~~帶傘。這裡有註腳[^1]，還有 \`code\`。

<!-- mosage:comment id=c-1 by=human quote="第二段"
請改得口語一點
-->
第二段文字，換行<br>之後，H<sub>2</sub>O。[官網](https://example.com)

![港口的早晨](../assets/harbor.png)

> [!WARNING]
> 小心浪大。

- 項目一
  - 子項目
- 項目二

1. 第一步
2. 第二步

| 名稱 | 數量 |
|:--|--:|
| 蘋果 | 3 |

\`\`\`js
const a = 1;
\`\`\`

---

<!-- pagebreak -->

![不存在的圖](../assets/missing.png) 與 ![遠端](https://example.com/x.png)

[^1]: 第一章的註腳。
`;

const CHAPTER_TWO = `# 第二章　回來

## 小節

- 清單中的留言
  <!-- mosage:suggest id=s-1 by=ai
  改寫
  -->
  繼續

內文[^1]。

[^1]: 第二章的註腳。
`;

let root: string;

function input(overrides: Record<string, unknown> = {}, exportOverrides: Record<string, unknown> = {}): ManuscriptInput {
  return {
    config: resolveConfig({
      title: '港口之書',
      subtitle: '一個副標',
      author: '王小明',
      export: exportOverrides,
      ...overrides,
    }),
    chapters: [
      { id: '01-start.md', source: CHAPTER_ONE },
      { id: '02-back.md', source: CHAPTER_TWO },
    ],
    root,
  };
}

async function unzip(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (name: string) => (await zip.file(name)?.async('string')) ?? '';
  return { zip, read, names: Object.keys(zip.files) };
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'mosage-export-'));
  mkdirSync(join(root, 'chapters'), { recursive: true });
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'assets', 'harbor.png'), makePng(640, 320));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('buildDocx', () => {
  it('writes the chapters with real styles and no annotation markers', async () => {
    const { read, names } = await unzip(await buildDocx(input()));
    const doc = await read('word/document.xml');
    expect(doc).toContain('第一章　出發');
    expect(doc).toContain('她在清晨出發');
    expect(doc).toContain('第二章　回來');
    expect(doc).not.toContain('mosage:');
    expect(doc).not.toContain('請改得口語一點');
    expect(doc).not.toContain('status: draft');
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain('<w:pStyle w:val="BodyText"/>');
    expect(doc).toContain('<w:pStyle w:val="Title"/>');
    // Links, inline code, callout label, scene break, lists.
    expect(doc).toContain('<w:rStyle w:val="Hyperlink"/>');
    expect(doc).toContain('<w:rStyle w:val="InlineCode"/>');
    expect(doc).toContain('小心');
    expect(doc).toContain('＊　＊　＊');
    expect(doc).toContain('<w:numPr>');
    expect(doc).toContain('<w:vertAlign w:val="subscript"/>');
    // A table and an embedded picture with its caption.
    expect(doc).toContain('<w:tbl>');
    expect(doc).toContain('<w:tblHeader/>');
    expect(doc).toContain('<w:pStyle w:val="Caption"/>');
    expect(names.some((n) => /^word\/media\/.+\.png$/.test(n))).toBe(true);
    // Missing and remote images become placeholders instead of failing.
    expect(doc).toContain('[圖：不存在的圖]');
    expect(doc).toContain('[圖：遠端]');
  });

  it('sets fonts, languages and page geometry from the config', async () => {
    const { read } = await unzip(await buildDocx(input()));
    const styles = await read('word/styles.xml');
    expect(styles).toContain('w:eastAsia="新細明體"');
    expect(styles).toContain('w:ascii="Times New Roman"');
    expect(styles).toContain('w:eastAsia="微軟正黑體"');
    expect(styles).toContain('w:eastAsia="zh-TW"');
    expect(styles).toMatch(/w:styleId="Normal" w:default="(true|1)"/);
    // Body text: 2-character first-line indent at 12pt = 480 twips, 1.5 lines = 360.
    expect(styles).toContain('<w:ind w:firstLine="480"/>');
    expect(styles).toContain('w:line="360"');
    const doc = await read('word/document.xml');
    expect(doc).toContain('<w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>');
    expect(doc).toContain('w:left="1417"');
  });

  it('turns footnotes into Word footnotes, numbered across chapters', async () => {
    const { read } = await unzip(await buildDocx(input()));
    const notes = await read('word/footnotes.xml');
    expect(notes).toContain('第一章的註腳。');
    expect(notes).toContain('第二章的註腳。');
    const doc = await read('word/document.xml');
    expect(doc).toContain('<w:footnoteReference w:id="1"/>');
    expect(doc).toContain('<w:footnoteReference w:id="2"/>');
  });

  it('adds a table of contents, page numbers and page breaks', async () => {
    const { read, names } = await unzip(await buildDocx(input()));
    const doc = await read('word/document.xml');
    expect(doc).toMatch(/<w:instrText[^>]*>TOC [^<]*\\o &quot;1-3&quot;/);
    expect(doc).toContain('<w:pStyle w:val="TOCHeading"/>');
    expect(doc).toContain('目錄');
    expect(await read('word/settings.xml')).toContain('<w:updateFields/>');
    expect(doc).toContain('<w:pgNumType w:start="1" w:fmt="decimal"/>');
    const footers = await Promise.all(names.filter((n) => /footer\d*\.xml$/.test(n)).map(read));
    expect(footers.join('')).toMatch(/PAGE/);
    // Chapter two starts on a new page; so does the paragraph after <!-- pagebreak -->.
    expect(doc).toMatch(/<w:pStyle w:val="Heading1"\/><w:pageBreakBefore\/><\/w:pPr><w:bookmarkStart w:name="_Toc\d+" w:id="\d+"\/><w:r><w:t xml:space="preserve">第二章/);
    expect(doc.match(/<w:pageBreakBefore\/>/g)?.length).toBe(2);
    // Bookmarks for the TOC links have unique ids.
    const ids = [...doc.matchAll(/<w:bookmarkStart w:name="[^"]+" w:id="(\d+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves out the table of contents and title page when turned off', async () => {
    const { read } = await unzip(await buildDocx(input({}, { toc: false, titlePage: false })));
    const doc = await read('word/document.xml');
    expect(doc).not.toContain('TOC \\');
    expect(doc).not.toContain('<w:pStyle w:val="Title"/>');
    expect(await read('word/settings.xml')).not.toContain('updateFields');
  });

  it('gives each chapter its own running header in chapter mode', async () => {
    const { read, names } = await unzip(await buildDocx(input({}, { header: 'chapter' })));
    const headers = await Promise.all(names.filter((n) => /header\d*\.xml$/.test(n)).map(read));
    expect(headers.some((h) => h.includes('第一章　出發'))).toBe(true);
    expect(headers.some((h) => h.includes('第二章　回來'))).toBe(true);
  });

  it('follows the thesis defaults and custom page sizes', async () => {
    const { read } = await unzip(
      await buildDocx(input({ type: 'thesis' }, { pageSize: { width: 182, height: 257 } })),
    );
    expect(await read('word/styles.xml')).toContain('w:eastAsia="標楷體"');
    expect(await read('word/document.xml')).toContain('<w:pgSz w:w="10318" w:h="14570"');
  });

  it('still produces a document for an empty manuscript or odd Markdown', async () => {
    const empty = await unzip(await buildDocx({ ...input(), chapters: [] }));
    expect(await empty.read('word/document.xml')).toContain('港口之書');

    const odd = [
      '# 標題',
      '<div align="center">原始 HTML</div>',
      '',
      '參考[^missing] 與 $x^2$ 與 [ref][r]',
      '',
      '[r]: https://example.com',
      '',
      '|a|b|',
      '|-|-|',
      '||',
      '',
      '- [ ] 待辦',
      '- [x] 完成',
      '',
      '1. ',
      '',
      '> > 巢狀引言',
      '',
      '```',
      '```',
      '',
      '控制字元\u0007\u000b在這裡',
    ].join('\n');
    const result = await unzip(await buildDocx({ ...input(), chapters: [{ id: 'x.md', source: odd }] }));
    const doc = await result.read('word/document.xml');
    expect(doc).toContain('[^missing]');
    expect(doc).toContain('☐ ');
    expect(doc).toContain('控制字元在這裡');
  });
});

describe('buildHtml', () => {
  it('is self-contained and print-ready', async () => {
    const html = await buildHtml(input({ title: '港口<script>之書' }));
    expect(html).not.toContain('mosage:');
    expect(html).not.toContain('請改得口語一點');
    expect(html).not.toContain('<script>');
    expect(html).toContain('港口&lt;script&gt;之書');
    expect(html).toContain('@page');
    expect(html).toContain('size: 210mm 297mm');
    expect(html).toContain('text-indent: 2em');
    expect(html).toMatch(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="港口的早晨">/);
    expect(html).toContain('<figcaption>港口的早晨</figcaption>');
    expect(html).toContain('class="callout callout-warning"');
    expect(html).toContain('<p class="scene-break">＊　＊　＊</p>');
    expect(html).toContain('<div class="page-break"></div>');
    expect(html).toContain('H<sub>2</sub>O');
    // Contents with anchors, and footnotes that do not collide between chapters.
    expect(html).toMatch(/<a href="#ch1-h1">第一章　出發<\/a>/);
    expect(html).toContain('id="ch1-fn-1"');
    expect(html).toContain('id="ch2-fn-1"');
    expect(html).toContain('[圖：不存在的圖]');
  });
});

describe('buildMarkdown', () => {
  it('merges the chapters without frontmatter or markers', () => {
    const md = buildMarkdown({ ...input(), outputDir: join(root, 'output', 'book') });
    expect(md).not.toContain('status: draft');
    expect(md).not.toContain('summary:');
    expect(md).not.toContain('mosage:');
    expect(md).not.toContain('改寫');
    expect(md.startsWith('# 第一章　出發')).toBe(true);
    expect(md).toContain('\n\n# 第二章　回來');
    // Footnotes are namespaced per chapter.
    expect(md).toContain('註腳[^ch1-1]');
    expect(md).toContain('[^ch1-1]: 第一章的註腳。');
    expect(md).toContain('內文[^ch2-1]');
    expect(md).toContain('[^ch2-1]: 第二章的註腳。');
    // Images resolve from the output folder.
    expect(md).toContain('![港口的早晨](../../assets/harbor.png)');
    expect(md).toContain('(https://example.com/x.png)');
  });
});

describe('exportManuscript', () => {
  it('writes <outputDir>/<fileName>.<ext> with a safe file name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mosage-ws-'));
    try {
      mkdirSync(join(dir, 'chapters'));
      mkdirSync(join(dir, 'assets'));
      writeFileSync(join(dir, 'assets', 'harbor.png'), makePng(64, 32));
      writeFileSync(join(dir, 'chapters', '01-start.md'), CHAPTER_ONE);
      writeFileSync(join(dir, 'chapters', '02-back.md'), CHAPTER_TWO);
      writeFileSync(
        join(dir, CONFIG_FILE),
        stringify({
          title: '港口/之書: 初稿?',
          chapters: ['01-start.md', '02-back.md'],
        }),
      );
      const ws = new Workspace(dir);
      const result = await exportManuscript(ws, 'docx');
      expect(result.path).toBe(join(ws.outputDir, '港口之書 初稿.docx'));
      expect(result.bytes).toBe(readFileSync(result.path).length);

      const md = await exportManuscript(ws, 'md');
      expect(readFileSync(md.path, 'utf8')).toContain('](../assets/harbor.png)');

      const html = await renderManuscript(ws, 'html');
      expect(html.contentType).toContain('text/html');
      expect(html.fileName).toBe('港口之書 初稿.html');
      expect(html.data.toString('utf8')).toContain('<!DOCTYPE html>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('docx round trip', () => {
  it('imports an exported manuscript back into chapters', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mosage-roundtrip-'));
    try {
      const file = join(dir, 'book.docx');
      writeFileSync(file, await buildDocx(input()));
      const target = join(dir, 'book');
      const ws = new Workspace(target);
      const result = await importFile(ws, file);

      const chapters = await Promise.all(result.created.map((id) => ws.readChapter(id)));
      const titles = chapters.map((c) => c.source.match(/^# (.+)$/m)?.[1]);
      expect(titles).toContain('第一章　出發');
      expect(titles).toContain('第二章　回來');
      // The title page ends up in the front-matter chapter; the TOC is dropped.
      expect(titles[0]).toBe('前言素材');
      expect(chapters[0].source).toContain('港口之書');
      expect(chapters[0].source).not.toContain('目錄');

      const one = chapters[titles.indexOf('第一章　出發')].source;
      expect(one).toContain('她在清晨出發，**天色**還暗，*霧*很濃，~~沒有~~帶傘。');
      expect(one).toMatch(/這裡有註腳\[\^1\]/);
      expect(one).toContain('[^1]: 第一章的註腳。');
      expect(one).toContain('> [!WARNING]');
      expect(one).toContain('| 名稱 | 數量 |');
      expect(one).toContain('```\nconst a = 1;\n```');
      expect(one).toMatch(/!\[港口的早晨\]\(\.\.\/assets\/imported\/book-1\.png\)/);
      expect(one).not.toMatch(/^港口的早晨$/m);
      expect(result.assets).toContain('assets/imported/book-1.png');

      const two = chapters[titles.indexOf('第二章　回來')].source;
      expect(two).toContain('## 小節');
      expect(two).toMatch(/內文\[\^2\]。/);
      expect(two).toContain('[^2]: 第二章的註腳。');
      expect(result.warnings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
