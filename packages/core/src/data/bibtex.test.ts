import { describe, expect, it } from 'vitest';
import { cleanLatex, parseBibtex, splitNames } from './bibtex';

const BIB = String.raw`
@comment{exported by Zotero}
@string{jtw = "Journal of Taiwan Studies"}

@article{chen2024,
  author  = {Chen, Da-Wen and Lin, Xiao-Ming},
  title   = {{Cloud} Costs in {Taiwan}: A Survey},
  journal = jtw,
  year    = 2024,
  volume  = {12},
  number  = {3},
  pages   = {45--67},
  doi     = {10.1234/jts.2024.003}
}

@book{陳2023,
  author    = {陳大文 and 林小明},
  title     = {雲端架構實務},
  publisher = {臺灣出版社},
  year      = {2023}
}

@techreport{who2022, author = {{World Health Organization}}, title = "Report \& Review", institution = {WHO}, year = {2022}, url = {https://who.int/r}}
@inproceedings{m\"uller, author={M{\"u}ller, Jan}, title={Stra{\ss}e}, booktitle={Proc. X}, date={2021-05-01}}
`;

describe('parseBibtex', () => {
  const sources = parseBibtex(BIB);

  it('reads every entry, skipping comments and string macros', () => {
    expect(sources.map((s) => s.id)).toEqual(['chen2024', '陳2023', 'who2022', 'm\\"uller']);
  });

  it('maps BibTeX fields onto a citable source', () => {
    expect(sources[0]).toEqual({
      id: 'chen2024',
      type: 'article',
      author: ['Chen, Da-Wen', 'Lin, Xiao-Ming'],
      title: 'Cloud Costs in Taiwan: A Survey',
      year: '2024',
      container: 'Journal of Taiwan Studies',
      volume: '12',
      issue: '3',
      pages: '45–67',
      doi: '10.1234/jts.2024.003',
    });
    expect(sources[1]).toMatchObject({
      type: 'book',
      author: ['陳大文', '林小明'],
      publisher: '臺灣出版社',
    });
  });

  it('keeps a braced corporate author whole and reads institutions and dates', () => {
    expect(sources[2]).toMatchObject({
      type: 'report',
      author: ['World Health Organization'],
      title: 'Report & Review',
      publisher: 'WHO',
      url: 'https://who.int/r',
    });
    expect(sources[3]).toMatchObject({
      type: 'chapter',
      author: ['Müller, Jan'],
      year: '2021',
      container: 'Proc. X',
    });
  });
});

describe('LaTeX text', () => {
  it('reduces markup to what it prints', () => {
    expect(cleanLatex('{\\"u}ber and \\emph{this} --- that~one')).toBe(
      'über and this — that\u00A0one',
    );
    expect(splitNames('A, B and {C and D} and E')).toEqual(['A, B', 'C and D', 'E']);
  });
});
