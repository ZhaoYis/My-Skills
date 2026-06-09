import { describe, expect, it } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';

describe('runInit', () => {
  it('rejects unsupported tool ids before installation', async () => {
    await expect(
      runInit({ dir: '/tmp', tool: 'vscode' as 'claude', yes: true, dryRun: true })
    ).rejects.toThrow('Unsupported tool: vscode');
  });

  it('rejects unknown feature flags before installation', async () => {
    await expect(
      runInit({ dir: '/tmp', tool: 'claude', yes: true, dryRun: true, feature: ['not-a-feature'] })
    ).rejects.toThrow('Unknown feature(s): not-a-feature');
  });
});
