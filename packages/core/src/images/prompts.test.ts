import { describe, expect, it } from 'vitest';
import { findImagePrompts, imagePathFor, replaceImagePrompt } from './prompts.ts';

const DOC = `import { type DocEntry, flow, ImagePrompt } from 'mosage';
import type { CSSProperties } from 'react';

const Body = flow(
  <>
    <h1>第二章：市場分析</h1>
    <ImagePrompt
      id="market-map"
      chapter="第二章 市場分析"
      prompt="An isometric map of the three market segments"
      alt="Market segments"
      width={642}
      height={360}
    />
    <ImagePrompt id="team-photo" prompt={\`A team at work\`} width={300} style={{ margin: '0 auto' }} />
  </>,
);

export default [Body] satisfies DocEntry[];
`;

describe('findImagePrompts', () => {
  it('reads every prompt with its placement', () => {
    const [map, team] = findImagePrompts(DOC);
    expect(map).toMatchObject({
      id: 'market-map',
      prompt: 'An isometric map of the three market segments',
      alt: 'Market segments',
      width: 642,
      height: 360,
      problem: null,
    });
    expect(team).toMatchObject({ id: 'team-photo', width: 300, height: null });
    // `chapter` is left over from when images were filed by chapter.
    expect(map).not.toHaveProperty('chapter');
  });

  it('flags prompts that cannot be generated as written', () => {
    const source = `const x = (
      <>
        <ImagePrompt id="Bad Id" prompt="x" />
        <ImagePrompt id="empty" prompt="" />
        <ImagePrompt id="twice" prompt="a" />
        <ImagePrompt id="twice" prompt="b" />
        <ImagePrompt id="slash" chapter="a/b" prompt="c" />
      </>
    );`;
    const problems = findImagePrompts(source).map((entry) => entry.problem);
    expect(problems[0]).toMatch(/lowercase/);
    expect(problems[1]).toMatch(/empty/);
    expect(problems[2]).toBeNull();
    expect(problems[3]).toMatch(/more than once/);
    expect(problems[4]).toBeNull();
  });
});

describe('imagePathFor', () => {
  it('files every image directly under images/', () => {
    expect(imagePathFor({ id: 'a' })).toBe('assets/images/a.png');
  });
});

describe('replaceImagePrompt', () => {
  it('swaps the prompt for an imported <img> of the same size', () => {
    const next = replaceImagePrompt(DOC, 'market-map', './assets/images/market-map.png');
    expect(next).toContain("import imgMarketMap from './assets/images/market-map.png';");
    expect(next).toContain(
      "<img src={imgMarketMap} alt='Market segments' style={{ width: 642, height: 360, objectFit: 'cover', display: 'block' }} />",
    );
    expect(next).not.toContain('id="market-map"');
    // The other prompt still needs the component.
    expect(next).toContain("import { type DocEntry, flow, ImagePrompt } from 'mosage';");
  });

  it('keeps the author’s own style and drops the import once no prompt is left', () => {
    let next = replaceImagePrompt(DOC, 'market-map', './assets/images/x/market-map.png') ?? '';
    next = replaceImagePrompt(next, 'team-photo', './assets/images/team-photo.png') ?? '';
    expect(next).toContain("style={{ width: 300, display: 'block', ...{ margin: '0 auto' } }}");
    expect(next).toContain("import { type DocEntry, flow } from 'mosage';");
    expect(findImagePrompts(next)).toEqual([]);
  });

  it('falls back to the prompt text for alt, and avoids taken identifiers', () => {
    const source = `import { ImagePrompt } from 'mosage';\nconst imgChart = 1;\nconst x = <ImagePrompt id="chart" prompt="A bar chart" />;\n`;
    const next = replaceImagePrompt(source, 'chart', './assets/images/chart.png') ?? '';
    expect(next).toContain("import imgChart2 from './assets/images/chart.png';");
    expect(next).toContain("alt='A bar chart'");
    expect(next).not.toContain("from 'mosage'");
  });

  it('returns null for an id the source does not have', () => {
    expect(replaceImagePrompt(DOC, 'missing', './x.png')).toBeNull();
  });
});
