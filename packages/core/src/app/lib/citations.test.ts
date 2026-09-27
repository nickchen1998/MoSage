import { describe, expect, it } from 'vitest';
import { citeText, compressNumbers, entryRuns, orderSources, type Source } from './citations';

const chen: Source = {
  id: 'chen2024',
  type: 'article',
  author: ['Chen, Da-Wen', 'Lin, Xiao-Ming'],
  title: 'Cloud costs in Taiwan',
  year: 2024,
  container: 'Journal of Taiwan Studies',
  volume: 12,
  issue: 3,
  pages: '45–67',
  doi: '10.1234/jts.2024.003',
};
const 陳: Source = {
  id: 'chen2023',
  type: 'book',
  author: ['陳大文', '林小明', '王美玲'],
  title: '雲端架構實務',
  year: 2023,
  publisher: '臺灣出版社',
};
const who: Source = { id: 'who', author: 'World Health Organization', title: 'Report', year: 2022 };

const text = (runs: ReturnType<typeof entryRuns>) =>
  runs.map((r) => (r.emphasis ? `*${r.text}*` : r.text)).join('');

describe('citeText', () => {
  const number = (id: string) => ({ chen2024: 1, chen2023: 2, who: 3 })[id] ?? 0;

  it('numbers by place in the bibliography, compressing runs', () => {
    expect(citeText([chen], 'numeric', number)).toBe('[1]');
    expect(citeText([who, chen, 陳], 'numeric', number)).toBe('[1–3]');
    expect(citeText([chen], 'numeric', number, { page: '12' })).toBe('[1, p. 12]');
    expect(citeText([陳], 'numeric', number, { page: '12' })).toBe('[2，頁 12]');
  });

  it('writes author–date the way English and Taiwanese APA do', () => {
    expect(citeText([chen], 'author-date', number)).toBe('(Chen & Lin, 2024)');
    expect(citeText([chen, who], 'author-date', number, { page: '4–5' })).toBe(
      '(Chen & Lin, 2024; World Health Organization, 2022, pp. 4–5)',
    );
    expect(citeText([陳], 'author-date', number)).toBe('（陳大文等人，2023）');
    expect(citeText([陳], 'author-date', number, { narrative: true, page: '8' })).toBe(
      '陳大文等人（2023，頁 8）',
    );
    expect(citeText([chen], 'author-date', number, { narrative: true })).toBe('Chen & Lin (2024)');
  });
});

describe('entryRuns', () => {
  it('sets an article with its journal and volume in italics', () => {
    expect(text(entryRuns(chen))).toBe(
      'Chen, Da-Wen, & Lin, Xiao-Ming (2024). Cloud costs in Taiwan. *Journal of Taiwan Studies*, *12*(3), 45–67. https://doi.org/10.1234/jts.2024.003',
    );
  });

  it('sets a Chinese book with full-width marks and its title set off', () => {
    expect(text(entryRuns(陳))).toBe(
      '陳大文、林小明、王美玲（2023）。*雲端架構實務*。臺灣出版社。',
    );
  });

  it('says so when a source has no date', () => {
    expect(text(entryRuns({ id: 'x', author: 'Doe, Jane', title: 'Notes' }))).toBe(
      'Doe, Jane (n.d.). *Notes*.',
    );
  });
});

describe('orderSources and compressNumbers', () => {
  it('keeps a numeric list as written and sorts an author–date one', () => {
    expect(orderSources([who, chen], 'numeric').map((s) => s.id)).toEqual(['who', 'chen2024']);
    expect(orderSources([who, chen], 'author-date').map((s) => s.id)).toEqual(['chen2024', 'who']);
  });

  it('writes ranges of three or more as spans', () => {
    expect(compressNumbers([5, 1, 2, 3, 7, 8])).toBe('1–3, 5, 7, 8');
  });
});
