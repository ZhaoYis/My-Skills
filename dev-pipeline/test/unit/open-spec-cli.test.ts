import { describe, expect, it } from 'vitest';
import { resolveOpenSpecInvocation } from '../../src/core/init/openSpecCli.js';

describe('resolveOpenSpecInvocation', () => {
  it.each([
    ['--version'],
    ['init', '--tools', 'claude'],
  ])('runs openspec %s through the npm command shim on Windows', (...args) => {
    expect(resolveOpenSpecInvocation(args, 'win32')).toEqual({
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'openspec.cmd', ...args],
    });
  });

  it('runs openspec directly on non-Windows platforms', () => {
    expect(resolveOpenSpecInvocation(['--version'], 'linux')).toEqual({
      command: 'openspec',
      args: ['--version'],
    });
  });
});
