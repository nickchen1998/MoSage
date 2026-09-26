import { describe, expect, it } from 'vitest';
import { generateThemesModule, parseFrontmatter } from './themes-plugin.ts';

describe('parseFrontmatter', () => {
  it('reads the declared fields and strips quotes', () => {
    const { fm, body } = parseFrontmatter(
      `---
name: "Corporate Neutral"
description: 'One blue accent'
pageSize: A4
mode: light
---

# Corporate Neutral

Body copy.`,
      'corporate-neutral',
    );
    expect(fm).toEqual({
      name: 'Corporate Neutral',
      description: 'One blue accent',
      pageSize: 'A4',
      mode: 'light',
    });
    expect(body.startsWith('# Corporate Neutral')).toBe(true);
  });

  it('falls back to the id when there is no frontmatter', () => {
    const { fm, body } = parseFrontmatter('# Just a heading\n', 'plain');
    expect(fm.name).toBe('plain');
    expect(fm.description).toBe('');
    expect(body).toBe('# Just a heading');
  });
});

describe('generateThemesModule', () => {
  const themes = [
    {
      id: 'with-demo',
      frontmatter: { name: 'With demo', description: '', pageSize: 'A4', mode: 'light' },
      body: '# With demo',
      demoAbs: '/tmp/themes/with-demo.demo.tsx',
    },
    {
      id: 'no-demo',
      frontmatter: { name: 'No demo', description: '', pageSize: '', mode: '' },
      body: '# No demo',
      demoAbs: null,
    },
  ];

  it('exports metadata for every theme', () => {
    const code = generateThemesModule(themes, false);
    expect(code).toContain('"id":"with-demo"');
    expect(code).toContain('"id":"no-demo"');
    expect(code).toContain('"hasDemo":true');
    expect(code).toContain('"hasDemo":false');
  });

  it('only emits an import case for themes that have a demo', () => {
    const code = generateThemesModule(themes, false);
    expect(code).toContain('case "with-demo": return import(');
    expect(code).not.toContain('case "no-demo": return import(');
  });

  it('serves demos through the @fs path in dev', () => {
    const code = generateThemesModule(themes, true);
    expect(code).toContain('@fs/tmp/themes/with-demo.demo.tsx');
  });
});
