import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { DocxModel, Paragraph, RunStyle } from '../app/lib/docx/model';
import { writeDocx } from '../app/lib/docx/write';
import { parseDocx } from './docx';
import type { Block, Inline } from './markdown';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

const p = (text: string, style?: string, extra = '') =>
  `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const item = (text: string, numId: number, level: number) =>
  p(text, undefined, `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`);

// Styles as a Chinese-language Word writes them: ids are numbers, names are English.
const STYLES = `<w:styles ${NS}>
  <w:style w:styleId="a"><w:name w:val="Normal"/></w:style>
  <w:style w:styleId="1"><w:name w:val="heading 1"/></w:style>
  <w:style w:styleId="2"><w:name w:val="heading 2"/></w:style>
  <w:style w:styleId="a3"><w:name w:val="Title"/></w:style>
  <w:style w:styleId="a5"><w:name w:val="caption"/></w:style>
  <w:style w:styleId="10"><w:name w:val="toc 1"/></w:style>
  <w:style w:styleId="Quote"><w:name w:val="Quote"/></w:style>
  <w:style w:styleId="Code"><w:name w:val="Code"/></w:style>
  <w:style w:styleId="Custom"><w:name w:val="My Heading"/><w:basedOn w:val="1"/></w:style>
</w:styles>`;

const NUMBERING = `<w:numbering ${NS}>
  <w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="decimal"/><w:start w:val="1"/></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const FOOTNOTES = `<w:footnotes ${NS}>
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1"><w:p><w:r><w:t>Measured in July.</w:t></w:r></w:p></w:footnote>
</w:footnotes>`;

const RELS = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId5" Type="image" Target="media/image1.png"/>
  <Relationship Id="rId6" Type="hyperlink" Target="https://example.com/r" TargetMode="External"/>
</Relationships>`;

const picture = `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="Topology"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
const chart = `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

const DOCUMENT = `<w:document ${NS}><w:body>
  ${p('年度報告', 'a3')}
  ${p('目錄', '10')}
  ${p('第一章 緒論', '1')}
  <w:p><w:r><w:t xml:space="preserve">Plain, </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t xml:space="preserve"> and </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r><w:r><w:t xml:space="preserve"> with a </w:t></w:r><w:hyperlink r:id="rId6"><w:r><w:t>link</w:t></w:r></w:hyperlink><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:t>.</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>4</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
  ${item('first', 1, 0)}
  ${item('nested', 1, 1)}
  ${item('second', 1, 0)}
  ${p('')}
  ${item('third', 2, 0)}
  ${p('Sub part', 'Custom')}
  ${picture}
  ${p('Figure 1 Network', 'a5')}
  ${chart}
  ${p('const a = 1;', 'Code')}${p('const b = 2;', 'Code')}
  ${p('A wise saying.', 'Quote')}
  <w:tbl>
    <w:tr><w:tc><w:p><w:r><w:t>Service</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cost</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Both</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>api</w:t></w:r></w:p></w:tc><w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>1,200</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl>
  <w:sectPr><w:pgSz w:w="16838" w:h="11906"/></w:sectPr>
</w:body></w:document>`;

function pack(parts: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(parts).map(([name, data]) => [
        name,
        typeof data === 'string' ? strToU8(data) : data,
      ]),
    ),
  );
}

const text = (nodes: Inline[]): string =>
  nodes
    .map((n) =>
      n.type === 'text'
        ? n.value
        : n.type === 'strong'
          ? `**${text(n.children)}**`
          : n.type === 'em'
            ? `_${text(n.children)}_`
            : n.type === 'link'
              ? `[${text(n.children)}](${n.href})`
              : n.type === 'footnote'
                ? `^(${text(n.children)})`
                : n.type === 'break'
                  ? ' / '
                  : '',
    )
    .join('');

const describeBlock = (b: Block): string => {
  switch (b.type) {
    case 'heading':
      return `h${b.level} ${text(b.children)}`;
    case 'paragraph':
      return `p ${text(b.children)}`;
    case 'list':
      return `${b.ordered ? 'ol' : 'ul'}@${b.start} [${b.items.map((item) => item.map(describeBlock).join(' + ')).join(' | ')}]`;
    case 'figure':
      return `figure ${b.src} "${b.alt}"`;
    case 'code':
      return `code ${JSON.stringify(b.value)}`;
    case 'quote':
      return `quote ${b.children.map(describeBlock).join(' ')}`;
    case 'table':
      return `table ${b.head.map(text).join('|')} // ${b.rows.map((r) => r.map(text).join('|')).join(' // ')} align=${b.align.join(',')}`;
    default:
      return b.type;
  }
};

describe('parseDocx', () => {
  const parsed = parseDocx(
    pack({
      'word/document.xml': DOCUMENT,
      'word/styles.xml': STYLES,
      'word/numbering.xml': NUMBERING,
      'word/footnotes.xml': FOOTNOTES,
      'word/_rels/document.xml.rels': RELS,
      'word/media/image1.png': new Uint8Array([137, 80, 78, 71]),
    }),
  );

  it('reads a report the way its author structured it', () => {
    expect(parsed.blocks.map(describeBlock)).toEqual([
      'h1 第一章 緒論',
      'p Plain, **bold** and _italic_ with a [link](https://example.com/r)^(Measured in July.).',
      'p Page 4',
      'ul@1 [p first + ol@1 [p nested] | p second]',
      'ol@3 [p third]',
      'h1 Sub part',
      'figure word/media/image1.png "Figure 1 Network"',
      'code "const a = 1;\\nconst b = 2;"',
      'quote p A wise saying.',
      'table Service|Cost // Both| // api|1,200 align=,right',
    ]);
  });

  it('takes the title and the page orientation, and says what it left out', () => {
    expect(parsed.frontmatter).toEqual({ title: '年度報告', orientation: 'landscape' });
    expect(parsed.skipped).toEqual({ chart: 1 });
    expect(parsed.media.get('word/media/image1.png')).toMatchObject({ filename: 'image1.png' });
  });

  it('refuses something that is not a Word package', () => {
    expect(() => parseDocx(new Uint8Array([1, 2, 3]))).toThrow(/not a Word file/);
    expect(() => parseDocx(pack({ 'x.txt': 'hi' }))).toThrow(/document.xml is missing/);
  });
});

describe('a round trip through MoSage’s own Word export', () => {
  const style: RunStyle = {
    fonts: { ascii: 'Inter', eastAsia: 'Noto Sans TC' },
    size: 21,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    color: '16181D',
  };
  const para = (value: string, extra: Partial<Paragraph> = {}): Paragraph => ({
    type: 'paragraph',
    role: 'body',
    inlines: [{ type: 'text', text: value, style }],
    props: {},
    ...extra,
  });
  const model: DocxModel = {
    title: 'Round trip',
    sections: [
      {
        blocks: [
          para('Findings', { role: 'heading', level: 1 } as Partial<Paragraph>),
          para('Costs grew in the third quarter.'),
        ],
        page: {
          width: 11906,
          height: 16838,
          margin: { top: 1140, right: 1140, bottom: 1140, left: 1140 },
          header: 600,
          footer: 600,
        },
      },
    ],
    footnotes: [],
    lists: [],
    media: [],
  };

  it('comes back as the headings and paragraphs that went out', () => {
    const back = parseDocx(writeDocx(model));
    expect(back.frontmatter.title).toBe('Round trip');
    expect(back.blocks.map(describeBlock)).toEqual([
      'h1 Findings',
      'p Costs grew in the third quarter.',
    ]);
  });
});
