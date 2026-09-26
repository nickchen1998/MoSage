import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applySettingsPatch,
  defaultSettings,
  normalizeSettings,
  readSettings,
  usesGeneratedImages,
  writeSettings,
} from './settings.ts';

describe('normalizeSettings', () => {
  it('fills in defaults and drops what is not valid', () => {
    const settings = normalizeSettings({
      imageGeneration: {
        mode: 'codex',
        model: 'dall-e-1',
        quality: 'ultra',
        documents: { alpha: false, 'Bad Id!': true, beta: 'yes' },
      },
    });
    expect(settings.imageGeneration).toEqual({
      mode: 'codex',
      model: defaultSettings().imageGeneration.model,
      quality: 'medium',
      documents: { alpha: false },
    });
    expect(normalizeSettings(null)).toEqual(defaultSettings());
  });

  it('keeps the code remote and a known host, each on its own', () => {
    expect(
      normalizeSettings({ code: { remote: ' git@gitlab.acme.dev:t/q.git ', host: 'gitlab' } }),
    ).toEqual({
      ...defaultSettings(),
      code: { remote: 'git@gitlab.acme.dev:t/q.git', host: 'gitlab' },
    });
    expect(normalizeSettings({ code: { remote: '', host: 'bitbucket' } }).code).toEqual({
      remote: null,
      host: null,
    });
  });
});

describe('applySettingsPatch', () => {
  it('changes only what the patch names', () => {
    const next = applySettingsPatch(defaultSettings(), {
      imageGeneration: { mode: 'openai', documents: { alpha: false } },
    });
    expect(next?.imageGeneration).toMatchObject({
      mode: 'openai',
      quality: 'medium',
      documents: { alpha: false },
    });
  });

  it('refuses the whole patch when any field is invalid', () => {
    expect(
      applySettingsPatch(defaultSettings(), { imageGeneration: { mode: 'dalle' } }),
    ).toBeNull();
    expect(
      applySettingsPatch(defaultSettings(), { imageGeneration: { mode: 'codex', quality: 'max' } }),
    ).toBeNull();
    expect(applySettingsPatch(defaultSettings(), { theme: 'dark' })).toBeNull();
  });
});

describe('usesGeneratedImages', () => {
  it('is off with the mode, and on for every document not switched off', () => {
    const settings = defaultSettings();
    expect(usesGeneratedImages(settings, 'alpha')).toBe(false);
    settings.imageGeneration.mode = 'codex';
    settings.imageGeneration.documents.beta = false;
    expect(usesGeneratedImages(settings, 'alpha')).toBe(true);
    expect(usesGeneratedImages(settings, 'beta')).toBe(false);
  });
});

describe('readSettings / writeSettings', () => {
  it('round-trips through .mosage/settings.json, and a broken file reads as defaults', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mosage-settings-'));
    expect(await readSettings(dir)).toEqual(defaultSettings());
    const settings = defaultSettings();
    settings.imageGeneration.mode = 'openai';
    await writeSettings(dir, settings);
    expect(await readSettings(dir)).toEqual(settings);
    await fs.writeFile(path.join(dir, '.mosage', 'settings.json'), '{ broken');
    expect(await readSettings(dir)).toEqual(defaultSettings());
  });
});
