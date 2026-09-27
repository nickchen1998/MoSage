import { describe, expect, it } from 'vitest';
import { around, countTaiVariants, typographyIssues } from './typography';

const found = (text: string) =>
  typographyIssues(text).map((issue) => `${issue.found}→${issue.suggestion}`);

describe('typographyIssues', () => {
  it('flags half-width punctuation beside Chinese', () => {
    expect(found('我們,你們;他們:好嗎?好!')).toEqual([',→，', ';→；', ':→：', '?→？', '!→！']);
    expect(found('結束.')).toEqual(['.→。']);
    expect(found('說明(附件一)如下')).toEqual(['(→（', ')→）']);
  });

  it('leaves numbers, versions, and English alone', () => {
    expect(found('會議 10:30 開始')).toEqual([]);
    expect(found('10:30開會，共1,000元')).toEqual([]);
    expect(found('升級到v2.0版')).toEqual([]);
    expect(found('Hello, world. (Really?)')).toEqual([]);
    expect(found('全形，標點；沒問題：「好」。')).toEqual([]);
  });

  it('asks for 「」 in place of English quotation marks around Chinese', () => {
    expect(found('他說"好"。')).toEqual(['"→「', '"→」']);
    expect(found('所謂“敏捷”開發')).toEqual(['“→「', '”→」']);
    expect(found('引用‘內層’文字')).toEqual(['‘→『', '’→』']);
    expect(found('He said "fine".')).toEqual([]);
  });

  it('reports offsets into the original string', () => {
    const [issue] = typographyIssues('𠮷野家,好');
    expect(issue?.index).toBe(4);
    expect(around('我們在這裡討論了很多事情,結論如下所述', 12, 1, 4)).toBe('…很多事情,結論如下…');
  });
});

describe('countTaiVariants', () => {
  it('counts 台 and 臺 where they name a place or the currency', () => {
    expect(countTaiVariants('臺北市、台中市與新臺幣，還有舞台劇')).toEqual({ plain: 1, formal: 2 });
  });
});
