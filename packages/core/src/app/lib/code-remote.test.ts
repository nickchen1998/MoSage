import { describe, expect, it } from 'vitest';
import { commitLink, fileLink, parseRemote, printedLink } from './code-remote.ts';

describe('parseRemote', () => {
  it('reads GitHub remotes in every form git prints', () => {
    const want = {
      host: 'github',
      webUrl: 'https://github.com/acme/q3-code',
      slug: 'acme/q3-code',
    };
    expect(parseRemote('https://github.com/acme/q3-code.git')).toEqual(want);
    expect(parseRemote('https://github.com/acme/q3-code')).toEqual(want);
    expect(parseRemote('git@github.com:acme/q3-code.git')).toEqual(want);
    expect(parseRemote('ssh://git@github.com/acme/q3-code.git')).toEqual(want);
    expect(parseRemote('https://token@github.com/acme/q3-code.git/')).toEqual(want);
  });

  it('keeps GitLab subgroups and self-hosted domains', () => {
    expect(parseRemote('git@gitlab.com:acme/data/q3-code.git')).toEqual({
      host: 'gitlab',
      webUrl: 'https://gitlab.com/acme/data/q3-code',
      slug: 'acme/data/q3-code',
    });
    expect(parseRemote('ssh://git@gitlab.acme.dev:2222/team/q3.git')?.webUrl).toBe(
      'https://gitlab.acme.dev/team/q3',
    );
    expect(parseRemote('https://gitlab.acme.dev:8443/team/q3.git')?.webUrl).toBe(
      'https://gitlab.acme.dev:8443/team/q3',
    );
  });

  it('needs to be told which host an unrecognised domain runs', () => {
    expect(parseRemote('https://git.acme.dev/team/q3.git')).toBeNull();
    expect(parseRemote('https://git.acme.dev/team/q3.git', 'gitlab')?.host).toBe('gitlab');
  });

  it('refuses what is not a repository address', () => {
    expect(parseRemote('/srv/git/q3.git')).toBeNull();
    expect(parseRemote('https://github.com/acme')).toBeNull();
    expect(parseRemote('https://github.com/acme/q3/extra')).toBeNull();
    expect(parseRemote('file:///srv/git/q3.git', 'github')).toBeNull();
    expect(parseRemote('not a url')).toBeNull();
    expect(parseRemote('-u@github.com:acme/q3.git')).toBeNull();
    expect(parseRemote('ssh://-oProxyCommand=x/acme/q3.git', 'github')).toBeNull();
  });
});

describe('links', () => {
  const sha = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
  const github = parseRemote('git@github.com:acme/q3-code.git');
  const gitlab = parseRemote('git@gitlab.com:acme/data/q3-code.git');
  if (!github || !gitlab) throw new Error('fixtures');

  it('writes each host’s own line anchor', () => {
    expect(fileLink(github, sha, 'etl/transform.py', 12, 38)).toBe(
      `https://github.com/acme/q3-code/blob/${sha}/etl/transform.py#L12-L38`,
    );
    expect(fileLink(gitlab, sha, 'etl/transform.py', 12, 38)).toBe(
      `https://gitlab.com/acme/data/q3-code/-/blob/${sha}/etl/transform.py#L12-38`,
    );
    expect(fileLink(github, sha, 'a.py', 5, 5)).toMatch(/#L5$/);
    expect(fileLink(gitlab, sha, 'a.py')).not.toContain('#');
  });

  it('escapes paths in links and leaves them readable on paper', () => {
    expect(fileLink(github, sha, '報表/月 營收.sql', 1, 3)).toContain(
      '/%E5%A0%B1%E8%A1%A8/%E6%9C%88%20%E7%87%9F%E6%94%B6.sql#L1-L3',
    );
    expect(printedLink(github, sha, '報表/月 營收.sql', 1, 3)).toBe(
      'github.com/acme/q3-code/blob/a1b2c3d4e5f6/報表/月 營收.sql#L1-L3',
    );
  });

  it('links commits', () => {
    expect(commitLink(github, sha)).toBe(`https://github.com/acme/q3-code/commit/${sha}`);
    expect(commitLink(gitlab, sha)).toBe(`https://gitlab.com/acme/data/q3-code/-/commit/${sha}`);
  });
});
