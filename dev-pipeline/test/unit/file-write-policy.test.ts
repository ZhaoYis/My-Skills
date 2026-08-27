import { describe, expect, it } from 'vitest';
import {
  findAssetDefinition,
  resolveFileWritePolicy,
} from '../../src/core/init/fileWritePolicy.js';

function resolve(
  assetId: string,
  destinationPath: string,
  kind: 'template' | 'static',
  mode = 'init' as const,
) {
  return resolveFileWritePolicy(findAssetDefinition(assetId), { destinationPath, kind }, mode);
}

describe('fileWritePolicy', () => {
  it('resolves asset-specific append strategies', () => {
    // common-readme / common-gitignore 用户维护，存在即跳过：append 策略无意义，固定为 none
    expect(resolve('common-readme', '/project/README.md', 'template').appendStrategy).toBe('none');
    expect(
      resolve('stack-config', '/project/openspec/config.yaml', 'template').appendStrategy,
    ).toBe('config-merge');
    expect(resolve('common-gitignore', '/project/.gitignore', 'template').appendStrategy).toBe(
      'none',
    );
  });

  it('applies bundle selectors to individual members', () => {
    expect(
      resolve(
        'frontend-schema-bundle:templates/proposal.md.hbs',
        '/project/openspec/schemas/frontend/templates/proposal.md',
        'template',
      ).appendStrategy,
    ).toBe('simple');
    expect(
      resolve(
        'frontend-schema-bundle:schema.yaml.hbs',
        '/project/openspec/schemas/frontend/schema.yaml',
        'template',
      ).appendStrategy,
    ).toBe('none');
    expect(
      resolve(
        'opsx-dev-pipeline-skill-bundle:scripts/archive.mjs',
        '/project/.claude/skills/opsx-dev-pipeline/scripts/archive.mjs',
        'static',
      ).appendStrategy,
    ).toBe('none');
  });

  it('resolves mode-specific conflict actions', () => {
    expect(
      resolve('opsx-propose-command', '/project/.claude/commands/opsx/propose.md', 'template')
        .onConflict,
    ).toBe('overwrite');
    expect(
      resolveFileWritePolicy(
        findAssetDefinition('opsx-propose-command'),
        { destinationPath: '/project/.claude/commands/opsx/propose.md', kind: 'template' },
        'sync',
      ).onConflict,
    ).toBe('overwrite');
    expect(
      resolveFileWritePolicy(
        findAssetDefinition('opsx-propose-command'),
        { destinationPath: '/project/.claude/commands/opsx/propose.md', kind: 'template' },
        'upgrade',
      ).onConflict,
    ).toBe('overwrite');
  });

  it('uses non-appendable prompt defaults for unknown assets', () => {
    expect(
      resolveFileWritePolicy(
        undefined,
        { destinationPath: '/project/custom.md', kind: 'template' },
        'upgrade',
      ),
    ).toEqual({ appendStrategy: 'none', onConflict: 'prompt' });
  });
});
