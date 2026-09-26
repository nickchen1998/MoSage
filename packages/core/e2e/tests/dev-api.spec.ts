import { expect, test } from '@playwright/test';
import { deleteDoc, devServerUrl, duplicateDoc, readDocSource, TINY_PNG } from './helpers.ts';

test.describe('dev API — documents', () => {
  test('duplicate copies a document to a fresh id', async ({ request }) => {
    try {
      await duplicateDoc(request, 'alpha', 'alpha-copy');
      expect(await readDocSource('alpha-copy')).toContain('Alpha page one');
    } finally {
      await deleteDoc(request, 'alpha-copy');
    }
  });

  test('duplicate refuses an id that already exists', async ({ request }) => {
    const res = await request.post('/__docs/alpha/duplicate', { data: { newId: 'edit-target' } });
    expect(res.status()).toBe(409);
  });

  test('rename rewrites meta.title in the source', async ({ request }) => {
    try {
      await duplicateDoc(request, 'alpha', 'rename-target');
      const res = await request.patch('/__docs/rename-target', { data: { title: 'Renamed Doc' } });
      expect(res.status()).toBe(200);
      expect(await readDocSource('rename-target')).toContain("title: 'Renamed Doc'");
    } finally {
      await deleteDoc(request, 'rename-target');
    }
  });

  test('delete removes the document folder', async ({ request }) => {
    await duplicateDoc(request, 'alpha', 'delete-target');
    const res = await request.delete('/__docs/delete-target');
    expect(res.status()).toBe(200);
    await expect(readDocSource('delete-target')).rejects.toThrow();
  });

  test('an unknown document is a 404, not a 500', async ({ request }) => {
    const res = await request.delete('/__docs/no-such-document');
    expect(res.status()).toBe(404);
  });
});

test.describe('dev API — folders', () => {
  test('a folder can be created, assigned, renamed, and deleted', async ({ request }) => {
    const created = await request.post('/__folders', {
      data: { name: 'API Folder', icon: { type: 'emoji', value: '📁' } },
    });
    expect(created.status()).toBe(200);
    const folder = (await created.json()) as { id: string };

    try {
      const assigned = await request.put('/__folders/assign', {
        data: { docId: 'alpha', folderId: folder.id },
      });
      expect(assigned.status()).toBe(200);

      const manifest = (await (await request.get('/__folders')).json()) as {
        assignments: Record<string, string>;
      };
      expect(manifest.assignments.alpha).toBe(folder.id);

      const renamed = await request.patch(`/__folders/${folder.id}`, {
        data: { name: 'API Folder Renamed' },
      });
      expect(renamed.status()).toBe(200);
    } finally {
      await request.put('/__folders/assign', { data: { docId: 'alpha', folderId: null } });
      await request.delete(`/__folders/${folder.id}`);
    }
  });
});

test.describe('dev API — assets', () => {
  const scope = 'alpha';
  const file = 'e2e-pixel.png';

  test.afterEach(async ({ request }) => {
    await request.delete(`/__assets/${scope}/${file}`);
  });

  test('an asset can be uploaded, listed, served, and deleted', async ({ request }) => {
    const uploaded = await request.post(`/__assets/${scope}/${file}?overwrite=1`, {
      data: TINY_PNG,
      headers: { 'content-type': 'image/png' },
    });
    expect(uploaded.ok()).toBe(true);

    const list = (await (await request.get(`/__assets/${scope}`)).json()) as {
      assets: { name: string }[];
    };
    expect(list.assets.map((a) => a.name)).toContain(file);

    const raw = await request.get(`/__assets/${scope}/${file}`);
    expect(raw.status()).toBe(200);
    expect((await raw.body()).length).toBe(TINY_PNG.length);

    const removed = await request.delete(`/__assets/${scope}/${file}`);
    expect(removed.ok()).toBe(true);
  });

  test('a traversing asset name is refused', async ({ request }) => {
    const res = await request.get(`/__assets/${scope}/${encodeURIComponent('../../secret.txt')}`);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('dev API — mutation guard', () => {
  test('a cross-site mutation is blocked', async ({ request }) => {
    const res = await request.delete(`${devServerUrl}/__docs/alpha`, {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(res.status()).toBe(403);
    expect(await readDocSource('alpha')).toContain('Alpha page one');
  });

  test('a mismatched origin is blocked', async ({ request }) => {
    const res = await request.delete(`${devServerUrl}/__docs/alpha`, {
      headers: { origin: 'http://evil.example' },
    });
    expect(res.status()).toBe(403);
  });

  test('a JSON body is required where the route says so', async ({ request }) => {
    const res = await request.patch(`${devServerUrl}/__docs/alpha`, {
      headers: { 'content-type': 'text/plain' },
      data: 'title=nope',
    });
    expect(res.status()).toBe(415);
  });
});
