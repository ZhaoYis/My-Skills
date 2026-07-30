import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePackageRoot } from '../../src/core/runtime/resolvePackageRoot.js';

describe('resolvePackageRoot', () => {
  it('finds the package root from source files', async () => {
    const root = await resolvePackageRoot(import.meta.url);
    expect(path.basename(root)).toBe('dev-pipeline');
  });
});
