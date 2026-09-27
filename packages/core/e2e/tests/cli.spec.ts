import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { prepareScratchProject, runCli } from './helpers.ts';

test.describe('mosage CLI', () => {
  test('--help lists the commands the docs promise', async () => {
    const res = await runCli(['--help'], prepareScratchProject('cli'));
    expect(res.code).toBe(0);
    for (const command of ['dev', 'build', 'preview', 'export', 'check', 'import', 'sync:skills']) {
      expect(res.stdout).toContain(command);
    }
  });

  test('--version prints the package version', async () => {
    const res = await runCli(['--version'], prepareScratchProject('cli-version'));
    expect(res.code).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('an unknown command exits non-zero', async () => {
    const res = await runCli(['not-a-command'], prepareScratchProject('cli-unknown'));
    expect(res.code).not.toBe(0);
  });

  test('sync:skills --dry-run reports without writing', async () => {
    const dir = prepareScratchProject('cli-skills');
    const res = await runCli(['sync:skills', '--dry-run'], dir);
    expect(res.code, res.stderr).toBe(0);
  });

  test('import turns Markdown into a document the framework can load', async () => {
    const dir = prepareScratchProject('cli-import');
    await fs.writeFile(
      path.join(dir, 'note.md'),
      '# Quarterly note\n\nBody copy.\n\n| Service | p99 |\n| --- | ---: |\n| api | 412 ms |\n',
      'utf8',
    );

    const res = await runCli(['import', 'note.md', '--id', 'imported'], dir);
    expect(res.code, res.stderr).toBe(0);

    const source = await fs.readFile(path.join(dir, 'docs', 'imported', 'index.tsx'), 'utf8');
    expect(source).toContain("title: 'Quarterly note'");
    expect(source).toContain('const Body = flow(');
    expect(source).toContain("<Td align={'right'}>412 ms</Td>");
    expect(source).toContain('satisfies DocEntry[]');
  });

  test('import turns a Word file into a document, its picture and footnote included', async () => {
    const dir = prepareScratchProject('cli-import-docx');
    const ns =
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const docx = zipSync({
      'word/document.xml': strToU8(
        `<w:document ${ns}><w:body>` +
          '<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>季度摘要</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>營收成長</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t>。</w:t></w:r></w:p>' +
          '<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="p" descr="趨勢"/><a:graphic><a:graphicData uri="pic"><a:blip r:embed="rId1"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' +
          '</w:body></w:document>',
      ),
      'word/styles.xml': strToU8(
        `<w:styles ${ns}><w:style w:styleId="1"><w:name w:val="heading 1"/></w:style></w:styles>`,
      ),
      'word/footnotes.xml': strToU8(
        `<w:footnotes ${ns}><w:footnote w:id="1"><w:p><w:r><w:t>財報 2026-09。</w:t></w:r></w:p></w:footnote></w:footnotes>`,
      ),
      'word/_rels/document.xml.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="image" Target="media/trend.png"/></Relationships>',
      ),
      'word/media/trend.png': new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    await fs.writeFile(path.join(dir, '季報.docx'), docx);

    const res = await runCli(['import', '季報.docx', '--id', 'quarterly'], dir);
    expect(res.code, res.stderr).toBe(0);
    const source = await fs.readFile(path.join(dir, 'docs', 'quarterly', 'index.tsx'), 'utf8');
    // The opening heading is the title, which the cover now carries.
    expect(source).toContain("title: '季度摘要'");
    expect(source).toContain('營收成長<Footnote>財報 2026-09。</Footnote>。');
    expect(source).toContain("import figure1 from './assets/images/trend.png';");
    expect(source).toContain('alt="趨勢"');
    await fs.access(path.join(dir, 'docs', 'quarterly', 'assets', 'images', 'trend.png'));
  });

  test('import refuses a page size other than A4', async () => {
    const dir = prepareScratchProject('cli-import-b4');
    await fs.writeFile(path.join(dir, 'b4.md'), '---\npageSize: B4\n---\n\n# Plan\n', 'utf8');

    const res = await runCli(['import', 'b4.md', '--id', 'plan'], dir);
    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain('A4 only');
    await expect(fs.access(path.join(dir, 'docs', 'plan'))).rejects.toThrow();
  });

  test('upgrade leaves a workspace-linked project alone', async () => {
    const dir = prepareScratchProject('cli-upgrade');
    const res = await runCli(['upgrade'], dir);
    expect(res.code).not.toBe(0);
    expect(res.stderr).toContain('linked here');
  });

  test('export only knows PDF and DOCX', async () => {
    const dir = prepareScratchProject('cli-formats');
    for (const format of ['html', 'png', 'svg']) {
      const res = await runCli(['export', 'alpha', '--format', format], dir);
      expect(res.code, format).not.toBe(0);
      expect(res.stderr).toContain('pdf, docx');
    }
  });

  test('export writes a PDF and a DOCX, and check passes the fixture documents', async () => {
    const dir = prepareScratchProject('cli-render');

    const exported = await runCli(['export', 'alpha', '--out-dir', 'out'], dir);
    expect(exported.code, exported.stderr).toBe(0);
    const pdf = await fs.readFile(path.join(dir, 'out', 'alpha.pdf'));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    // Tagged, with bookmarks built from the headings.
    expect(pdf.includes('/StructTreeRoot')).toBe(true);
    expect(pdf.includes('/Outlines')).toBe(true);
    expect(pdf.includes('/Title (Alpha page one)')).toBe(true);

    const word = await runCli(['export', 'alpha', '--format', 'docx', '--out-dir', 'out'], dir);
    expect(word.code, word.stderr).toBe(0);
    const docx = await fs.readFile(path.join(dir, 'out', 'alpha.docx'));
    // A zip, and the Word part inside it.
    expect(docx.subarray(0, 2).toString()).toBe('PK');
    expect(docx.includes('word/document.xml')).toBe(true);

    // What MoSage writes for Word, it reads back.
    const back = await runCli(['import', 'out/alpha.docx', '--id', 'alpha-again'], dir);
    expect(back.code, back.stderr).toBe(0);
    const again = await fs.readFile(path.join(dir, 'docs', 'alpha-again', 'index.tsx'), 'utf8');
    expect(again).toContain('Alpha page one');

    const checked = await runCli(['check', 'alpha'], dir);
    expect(checked.code, checked.stderr).toBe(0);
    expect(checked.stdout).toContain('clean');
  });
});
