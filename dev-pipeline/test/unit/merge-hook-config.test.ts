import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeHookConfig } from '../../src/core/init/mergeHookConfig.js';

function generated(command: string) {
  return JSON.stringify({
    _opsxManaged: { package: 'opsx-dev-pipeline', templateVersion: 'new', hooksEnabled: true },
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
  });
}

describe('mergeHookConfig', () => {
  it('accepts JSON with a Windows editor UTF-8 BOM', () => {
    const result = JSON.parse(
      mergeHookConfig(
        '\uFEFF{"permissions":{"deny":["Bash(rm:*)"]}}',
        generated('node hook.mjs'),
        'settings.json',
      ),
    );
    expect(result.permissions).toEqual({ deny: ['Bash(rm:*)'] });
  });

  it.each([
    path.join(
      '.claude',
      'skills',
      'opsx-dev-pipeline',
      'scripts',
      'hooks',
      'block-dangerous-bash.mjs',
    ),
    path.win32.join(
      'C:\\Users\\Test User',
      '.claude',
      'skills',
      'opsx-dev-pipeline',
      'scripts',
      'hooks',
      'block-dangerous-bash.mjs',
    ),
  ])('preserves user settings and mixed Hook entries for %s', (scriptPath) => {
    const userHook = { type: 'command', command: 'node user-hook.mjs' };
    const userConfig = {
      permissions: { deny: ['Bash(rm:*)'] },
      customSetting: { enabled: true },
      _opsxManaged: { templateVersion: 'old', customMetadata: 42 },
      hooks: {
        PostToolUse: [{ matcher: '*', hooks: [userHook] }],
        PreToolUse: [
          {
            matcher: 'Bash',
            customEntryMetadata: 'keep',
            hooks: [{ type: 'command', command: `node "${scriptPath}"` }, userHook],
          },
        ],
      },
    };
    const next = generated(`node "${scriptPath}"`);
    const merged = mergeHookConfig(JSON.stringify(userConfig), next, 'settings.json');
    const parsed = JSON.parse(merged);
    expect(parsed.permissions).toEqual(userConfig.permissions);
    expect(parsed.customSetting).toEqual(userConfig.customSetting);
    expect(parsed._opsxManaged).toMatchObject({ customMetadata: 42, templateVersion: 'new' });
    expect(parsed.hooks.PostToolUse).toEqual(userConfig.hooks.PostToolUse);
    expect(parsed.hooks.PreToolUse[0]).toEqual({
      matcher: 'Bash',
      customEntryMetadata: 'keep',
      hooks: [userHook],
    });
    expect(parsed.hooks.PreToolUse).toHaveLength(2);
    expect(mergeHookConfig(merged, next, 'settings.json')).toBe(merged);
  });

  it('keeps unrelated commands even when they mention the Pipeline script path', () => {
    const command = 'echo opsx-dev-pipeline/scripts/hooks/block-dangerous-bash.mjs';
    const existing = JSON.stringify({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
    });
    const result = JSON.parse(
      mergeHookConfig(existing, generated('node hook.mjs'), 'settings.json'),
    );
    expect(result.hooks.PreToolUse[0].hooks[0].command).toBe(command);
  });

  it.each([
    '{ invalid',
    '[]',
    '{"hooks":null}',
    '{"hooks":{"PreToolUse":{}}}',
  ])('rejects configurations that cannot be safely merged: %s', (content) => {
    expect(() => mergeHookConfig(content, generated('node hook.mjs'), 'settings.json')).toThrow();
  });
});
