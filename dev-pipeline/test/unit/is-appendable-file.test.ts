import { describe, expect, it } from 'vitest';
import { isAppendableInstallFile } from '../../src/core/init/isAppendableInstallFile.js';
import type { InstallFile } from '../../src/core/assets/types.js';

describe('isAppendableInstallFile', () => {
  it('returns true for .gitignore by basename', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/.gitignore',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns true for CLAUDE.md by basename', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/CLAUDE.md',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns true for config.yaml by basename', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/openspec/config.yaml',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns true for .md extension files', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/docs/README.md',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns true for .mdc extension files', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/.cursor/rules/some-rule.mdc',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns true for .txt extension files', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/NOTES.txt',
    };
    expect(isAppendableInstallFile(file)).toBe(true);
  });

  it('returns false for non-template kind files', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'static',
      destinationPath: '/project/.gitignore',
    };
    expect(isAppendableInstallFile(file)).toBe(false);
  });

  it('returns false for non-appendable basenames and extensions', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'template',
      destinationPath: '/project/tsconfig.json',
    };
    expect(isAppendableInstallFile(file)).toBe(false);
  });

  it('returns false for .gitignore with static kind', () => {
    const file: Pick<InstallFile, 'kind' | 'destinationPath'> = {
      kind: 'static',
      destinationPath: '/project/.gitignore',
    };
    expect(isAppendableInstallFile(file)).toBe(false);
  });
});
