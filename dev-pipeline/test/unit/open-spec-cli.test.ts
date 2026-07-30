import { describe, expect, it } from 'vitest';
import {
  isOpenSpecCliMissingError,
  resolveOpenSpecInvocation,
} from '../../src/core/init/openSpecCli.js';

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

  it('recognizes command-not-found errors on each platform', () => {
    expect(isOpenSpecCliMissingError({ code: 'ENOENT' }, 'linux')).toBe(true);
    expect(isOpenSpecCliMissingError({ code: 1 }, 'win32')).toBe(true);
    expect(isOpenSpecCliMissingError({ code: '1' }, 'win32')).toBe(true);
  });

  it('does not treat other command failures as a missing CLI', () => {
    expect(isOpenSpecCliMissingError({ code: 1 }, 'linux')).toBe(false);
    expect(isOpenSpecCliMissingError({ code: 2 }, 'win32')).toBe(false);
    expect(isOpenSpecCliMissingError(new Error('failed'), 'win32')).toBe(false);
  });
});
