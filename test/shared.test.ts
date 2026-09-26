import { describe, expect, it } from 'vitest';
import { formatMarker, parseMarker } from '../src/shared/annotations.ts';
import { resolveConfig } from '../src/shared/config.ts';
import { diffText } from '../src/shared/diff.ts';
import {
  acceptSuggestion,
  EditConflict,
  insertComment,
  removeAnnotation,
  replaceRange,
  setFrontmatter,
  setTitle,
} from '../src/shared/edits.ts';
import { parseChapter, stripMarkers } from '../src/shared/markdown.ts';
import { countWords } from '../src/shared/wordcount.ts';

const CHAPTER = `---
status: draft
summary: 開場
---

# 第一章　出發

第一段文字。

<!-- mosage:comment id=c-1 by=human quote="第二段"
請改得口語一點
-->
第二段文字。

<!-- mosage:suggest id=s-1 by=ai note="更精簡"
第三段，精簡版。
-->
第三段文字，比較囉嗦的版本。

## 小節

最後一段。
`;

describe('countWords', () => {
  it('counts CJK characters one by one and Latin words as words', () => {
    expect(countWords('我愛寫作')).toBe(4);
    expect(countWords('Hello world')).toBe(2);
    expect(countWords('用 Claude Code 寫書，共 3 章')).toBe(8);
    expect(countWords('React元件')).toBe(3);
    expect(countWords('don’t stop — e-mail')).toBe(3);
  });
});

describe('markers', () => {
  it('round-trips attributes and body', () => {
    const text = formatMarker(
      'comment',
      { id: 'c-1', by: 'human', quote: 'a "b" -- c' },
      '改寫\n第二行',
    );
    const parsed = parseMarker(text);
    expect(parsed?.kind).toBe('comment');
    expect(parsed?.attrs).toEqual({ id: 'c-1', by: 'human', quote: 'a "b" -- c' });
    expect(parsed?.body).toBe('改寫\n第二行');
    expect(text.slice(4, -3)).not.toContain('--');
  });

  it('accepts one-line markers written by an agent', () => {
    const parsed = parseMarker('<!-- mosage:comment by=ai 這裡需要資料來源 -->');
    expect(parsed?.attrs.by).toBe('ai');
    expect(parsed?.body).toBe('這裡需要資料來源');
  });

  it('ignores ordinary HTML comments', () => {
    expect(parseMarker('<!-- TODO -->')).toBeNull();
  });
});

describe('parseChapter', () => {
  const parsed = parseChapter(CHAPTER);

  it('reads frontmatter, title and outline', () => {
    expect(parsed.frontmatter).toEqual({ status: 'draft', summary: '開場' });
    expect(parsed.title).toBe('第一章　出發');
    expect(parsed.headings.map((h) => [h.depth, h.text])).toEqual([
      [1, '第一章　出發'],
      [2, '小節'],
    ]);
  });

  it('attaches markers to the block below them', () => {
    const [comment, suggestion] = parsed.annotations;
    expect(parsed.blocks[comment.blockIndex!].node.type).toBe('paragraph');
    expect(CHAPTER.slice(parsed.blocks[comment.blockIndex!].start)).toMatch(/^第二段/);
    expect(suggestion.kind).toBe('suggest');
    expect(suggestion.by).toBe('ai');
    expect(CHAPTER.slice(parsed.blocks[suggestion.blockIndex!].start)).toMatch(/^第三段文字/);
  });

  it('does not count markers as words', () => {
    expect(parsed.words).toBe(
      countWords('第一章出發第一段文字第二段文字第三段文字比較囉嗦的版本小節最後一段'),
    );
  });

  it('gives markers without an id a stable one', () => {
    const src = '<!-- mosage:comment\n看這裡\n-->\n段落\n';
    expect(parseChapter(src).annotations[0].id).toBe(
      parseChapter(`# T\n\n${src}`).annotations[0].id,
    );
  });
});

describe('edits', () => {
  it('inserts a comment above a block and removes it byte for byte', () => {
    const parsed = parseChapter(CHAPTER);
    const block = parsed.blocks.find((b) => CHAPTER.slice(b.start).startsWith('最後一段'))!;
    const { source, id } = insertComment(CHAPTER, {
      blockStart: block.start,
      blockText: CHAPTER.slice(block.start, block.end),
      body: '加一個例子',
      quote: '最後',
    });
    const added = parseChapter(source).annotations.find((a) => a.id === id)!;
    expect(added.body).toBe('加一個例子');
    expect(added.quote).toBe('最後');
    expect(removeAnnotation(source, id)).toBe(CHAPTER);
  });

  it('refuses to comment on a block that changed', () => {
    expect(() =>
      insertComment(CHAPTER, { blockStart: 0, blockText: '不存在的段落', body: 'x' }),
    ).toThrow(EditConflict);
  });

  it('accepts a suggestion by replacing its block', () => {
    const out = acceptSuggestion(CHAPTER, 's-1');
    expect(out).toContain('第三段，精簡版。\n\n## 小節');
    expect(out).not.toContain('囉嗦');
    expect(out).not.toContain('mosage:suggest');
    expect(out).toContain('mosage:comment id=c-1');
  });

  it('accepts an insertion suggestion', () => {
    const src = '# T\n\n<!-- mosage:suggest span=0\n新段落。\n-->\n舊段落。\n';
    expect(acceptSuggestion(src, parseChapter(src).annotations[0].id)).toBe(
      '# T\n\n新段落。\n\n舊段落。\n',
    );
  });

  it('replaces a range only when it still matches', () => {
    expect(replaceRange('abc', 1, 2, 'b', 'X')).toBe('aXc');
    expect(() => replaceRange('abc', 1, 2, 'z', 'X')).toThrow(EditConflict);
  });

  it('edits frontmatter and title', () => {
    const withStatus = setFrontmatter(CHAPTER, 'status', 'done');
    expect(parseChapter(withStatus).frontmatter.status).toBe('done');
    expect(parseChapter(withStatus).frontmatter.summary).toBe('開場');
    expect(parseChapter(setTitle(CHAPTER, '第一章　啟程')).title).toBe('第一章　啟程');
    expect(setTitle('內文\n', '新章')).toBe('# 新章\n\n內文\n');
    expect(setFrontmatter('# A\n', 'status', 'idea')).toBe('---\nstatus: idea\n---\n\n# A\n');
  });

  it('strips markers for export', () => {
    const out = stripMarkers(CHAPTER);
    expect(out).not.toContain('mosage:');
    expect(out).toContain('第二段文字。');
  });
});

describe('diffText', () => {
  it('diffs Chinese by character', () => {
    const parts = diffText('今天天氣很好', '今天天氣不錯');
    expect(parts).toEqual([
      { type: 'same', text: '今天天氣' },
      { type: 'remove', text: '很好' },
      { type: 'add', text: '不錯' },
    ]);
  });
});

describe('resolveConfig', () => {
  it('fills defaults per project type', () => {
    const book = resolveConfig({ title: '書' });
    expect(book.type).toBe('book');
    expect(book.stage).toBe('kickoff');
    expect(book.export.fileName).toBe('書');
    const thesis = resolveConfig({ type: 'thesis', export: { fontSize: 13 } });
    expect(thesis.export.fonts.body).toBe('標楷體');
    expect(thesis.export.fontSize).toBe(13);
    expect(resolveConfig({ export: { pageSize: 'a5' } }).export.pageSize).toBe('A5');
  });
});
