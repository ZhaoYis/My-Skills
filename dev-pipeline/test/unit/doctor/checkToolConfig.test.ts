import { describe, expect, it } from 'vitest';
import { checkToolConfig } from '../../../src/core/doctor/checkToolConfig.js';
import type { PipelineManifest } from '../../../src/core/manifest/types.js';

function makeManifest(overrides: Partial<PipelineManifest> = {}): PipelineManifest {
  return {
    schemaVersion: 2,
    projectName: 'demo',
    tools: ['claude'],
    features: ['base', 'skills'],
    templateVersion: '0.0.0',
    packageName: 'opsx-dev-pipeline',
    managedAssets: [],
    ...overrides,
  };
}

describe('checkToolConfig', () => {
  it('returns valid:true for a manifest with all known identifiers', async () => {
    const manifest = makeManifest({
      stack: 'backend',
      scope: 'project',
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns valid:true when optional stack/scope are omitted', async () => {
    const manifest = makeManifest();

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('reports an error for an unknown tool id', async () => {
    // Cast through unknown to bypass the ToolId type guard and probe the runtime
    // behavior — manifests can be hand-edited.
    const manifest = makeManifest({
      tools: ['claude', 'not-a-tool' as unknown as 'claude'],
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      checkId: 'tool-config',
      severity: 'error',
      path: 'tools[not-a-tool]',
      message: 'unknown tool: not-a-tool',
    });
  });

  it('reports an error for an unknown feature id', async () => {
    const manifest = makeManifest({
      features: ['base', 'something-fake' as unknown as 'base'],
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      checkId: 'tool-config',
      severity: 'error',
      path: 'features[something-fake]',
      message: 'unknown feature: something-fake',
    });
  });

  it('reports an error for an unknown stack id', async () => {
    const manifest = makeManifest({
      stack: 'mobile' as unknown as 'frontend',
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      checkId: 'tool-config',
      severity: 'error',
      path: 'stack',
      message: 'unknown stack: mobile',
    });
  });

  it('reports an error for an unknown scope', async () => {
    const manifest = makeManifest({
      scope: 'global' as unknown as 'project',
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      checkId: 'tool-config',
      severity: 'error',
      path: 'scope',
      message: 'unknown scope: global',
    });
  });

  it('reports multiple errors when several identifiers are invalid', async () => {
    const manifest = makeManifest({
      tools: ['fake' as unknown as 'claude'],
      features: ['whatever' as unknown as 'base'],
      stack: 'unknown-stack' as unknown as 'frontend',
      scope: 'global' as unknown as 'project',
    });

    const result = await checkToolConfig(manifest);

    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(4);
  });
});
