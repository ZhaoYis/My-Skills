import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectExistingLanguage,
  readConfigLanguage,
} from '../../src/core/init/resolveExistingLanguage.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

const createdDirs: string[] = [];
const baseManifest: PipelineManifest = {
  schemaVersion: 2,
  projectName: 'demo',
  tool: 'claude',
  tools: ['claude'],
  stack: 'frontend',
  features: [],
  templateVersion: '0.2.1',
  packageName: 'opsx-dev-pipeline',
  managedAssets: [],
};

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-resolve-existing-language-'));
  createdDirs.push(dir);
  return dir;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('readConfigLanguage', () => {
  it('returns undefined when openspec/config.yaml is missing', async () => {
    const dir = await createTempDir();
    expect(await readConfigLanguage(dir)).toBeUndefined();
  });

  it('returns undefined when the config has no language line', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'schema: frontend\ncontext: ""\n');
    expect(await readConfigLanguage(dir)).toBeUndefined();
  });

  it('returns "zh" from a plain language line', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'schema: frontend\nlanguage: zh\n');
    expect(await readConfigLanguage(dir)).toBe('zh');
  });

  it('returns "en" when the language value is double-quoted', async () => {
    const dir = await createTempDir();
    await fs.outputFile(
      path.join(dir, 'openspec/config.yaml'),
      'language: "en"\nschema: frontend\n',
    );
    expect(await readConfigLanguage(dir)).toBe('en');
  });

  it('returns "en" when the language value is single-quoted', async () => {
    const dir = await createTempDir();
    await fs.outputFile(
      path.join(dir, 'openspec/config.yaml'),
      "language: 'en'\nschema: frontend\n",
    );
    expect(await readConfigLanguage(dir)).toBe('en');
  });

  it('ignores a language line with an inline trailing comment', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: zh  # default\n');
    expect(await readConfigLanguage(dir)).toBe('zh');
  });

  it('returns undefined when the language line has an unsupported value', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: ja\n');
    expect(await readConfigLanguage(dir)).toBeUndefined();
  });
});

describe('collectExistingLanguage', () => {
  it('returns manifest language without prompting in non-interactive mode', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: en\n');

    const selection = await collectExistingLanguage(
      dir,
      { yes: true },
      { ...baseManifest, language: 'en' },
    );
    expect(selection).toEqual({ language: 'en', configNeedsUpdate: false });
    expect(prompts).not.toHaveBeenCalled();
  });

  it('flags configNeedsUpdate when config.yaml lacks the language line', async () => {
    const dir = await createTempDir();

    const selection = await collectExistingLanguage(
      dir,
      { yes: true },
      { ...baseManifest, language: 'en' },
    );
    expect(selection).toEqual({ language: 'en', configNeedsUpdate: true });
  });

  it('honors an explicit --language override when manifest already has a value', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: en\n');

    const selection = await collectExistingLanguage(
      dir,
      { yes: true, language: 'zh' },
      { ...baseManifest, language: 'en' },
    );

    expect(selection).toEqual({ language: 'zh', configNeedsUpdate: true });
  });

  it('falls back to config language when manifest language is missing', async () => {
    const dir = await createTempDir();
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: en\n');

    const selection = await collectExistingLanguage(dir, { yes: true }, baseManifest);

    expect(selection).toEqual({ language: 'en', configNeedsUpdate: false });
    expect(prompts).not.toHaveBeenCalled();
  });

  it('prompts when manifest and config both lack language metadata', async () => {
    const dir = await createTempDir();
    vi.mocked(prompts).mockResolvedValueOnce({ language: 'en' });

    const selection = await collectExistingLanguage(dir, {}, baseManifest);

    expect(selection).toEqual({ language: 'en', configNeedsUpdate: true });
    expect(vi.mocked(prompts)).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'language', type: 'select' }),
      expect.objectContaining({ onCancel: expect.any(Function) }),
    );
  });

  it('does not prompt when --yes is set and both manifest/config are missing language', async () => {
    const dir = await createTempDir();

    const selection = await collectExistingLanguage(dir, { yes: true }, baseManifest);

    expect(selection.language).toBe('zh');
    expect(prompts).not.toHaveBeenCalled();
  });
});
