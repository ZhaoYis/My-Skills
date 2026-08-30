import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectInputs } from '../../src/core/init/collectInputs.js';
import { collectExistingLanguage } from '../../src/core/init/resolveExistingLanguage.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';

vi.mock('prompts', () => ({
  default: vi.fn(),
}));

const createdDirs: string[] = [];
const manifest: PipelineManifest = {
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

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('document language selection', () => {
  it('defaults non-interactive initialization to Chinese and accepts an override', async () => {
    const defaults = await collectInputs('/tmp/demo', { yes: true, stack: 'frontend' }, new Map());
    const english = await collectInputs(
      '/tmp/demo',
      { yes: true, stack: 'frontend', language: 'en' },
      new Map(),
    );

    expect(defaults.language).toBe('zh');
    expect(english.language).toBe('en');
  });

  it('rejects unsupported language codes', async () => {
    await expect(
      collectInputs(
        '/tmp/demo',
        { yes: true, stack: 'frontend', language: 'ja' as 'zh' },
        new Map(),
      ),
    ).rejects.toThrow('Invalid language: ja');
  });

  it('prompts when an existing project is missing language metadata', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-existing-language-'));
    createdDirs.push(dir);
    vi.mocked(prompts).mockResolvedValueOnce({ language: 'en' });

    const selection = await collectExistingLanguage(dir, {}, manifest);

    expect(selection).toEqual({ language: 'en', configNeedsUpdate: true });
    expect(vi.mocked(prompts)).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'language', initial: 0 }),
      expect.objectContaining({ onCancel: expect.any(Function) }),
    );
  });

  it('uses config language as the non-interactive legacy default', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-existing-language-'));
    createdDirs.push(dir);
    await fs.outputFile(path.join(dir, 'openspec/config.yaml'), 'language: en\nschema: frontend\n');

    const selection = await collectExistingLanguage(dir, { yes: true }, manifest);

    expect(selection).toEqual({ language: 'en', configNeedsUpdate: false });
    expect(prompts).not.toHaveBeenCalled();
  });
});
