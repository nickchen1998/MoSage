import { mkdtempSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeContext } from '../vite/routes/context.ts';
import { readCodeFile } from './code.ts';
import { OpsError } from './documents.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'mosage-code-ops-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('readCodeFile', () => {
  it('reads a file in code/, and nothing a path or symlink leads out to', async () => {
    const project = path.join(root, 'project');
    await fs.mkdir(path.join(project, 'code'), { recursive: true });
    await fs.writeFile(path.join(project, 'code', 'a.py'), 'a = 1\n');
    await fs.writeFile(path.join(root, 'secret.txt'), 'no\n');
    await fs.symlink(path.join(root, 'secret.txt'), path.join(project, 'code', 'link.txt'));
    const ctx = makeContext({ userCwd: project, coreVersion: '0.0.0' });

    expect(await readCodeFile(ctx, 'a.py')).toMatchObject({
      path: 'a.py',
      text: 'a = 1\n',
      href: null,
    });
    await expect(readCodeFile(ctx, 'link.txt')).rejects.toBeInstanceOf(OpsError);
    await expect(readCodeFile(ctx, '../secret.txt')).rejects.toMatchObject({ status: 400 });
    await expect(readCodeFile(ctx, 'missing.py')).rejects.toMatchObject({ status: 404 });
  });
});
