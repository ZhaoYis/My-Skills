import { describe, expect, it } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';

describe('runInit', () => {
  it('rejects unsupported tool ids before installation', async () => {
    await expect(
      runInit({ dir: '/tmp', tool: 'vscode' as 'claude', yes: true, dryRun: true }),
    ).rejects.toThrow('Unsupported tool: vscode');
  });

  it.each([
    'prototype',
    'opsx-pr',
    'opsx-ci-triage',
  ])('rejects the removed %s feature', async (feature) => {
    await expect(
      runInit({ dir: '/tmp', tool: 'claude', yes: true, dryRun: true, feature: [feature] }),
    ).rejects.toThrow(`Unknown feature(s): ${feature}`);
  });
});
