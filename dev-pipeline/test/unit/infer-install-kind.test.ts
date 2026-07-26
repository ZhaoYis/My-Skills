import { describe, expect, it } from 'vitest';
import { inferInstallKind } from '../../src/core/uninstall/inferInstallKind.js';

describe('inferInstallKind', () => {
  it('returns template for .hbs files', () => {
    expect(inferInstallKind('my-template.hbs')).toBe('template');
  });

  it('returns template for .hbs bundle entries', () => {
    expect(inferInstallKind('common:bundle-entry.hbs')).toBe('template');
  });

  it('returns template for common-readme', () => {
    expect(inferInstallKind('common-readme')).toBe('template');
  });

  it('returns template for IDs ending in -command', () => {
    expect(inferInstallKind('some-feature-command')).toBe('template');
    expect(inferInstallKind('opsx-command')).toBe('template');
  });

  it('returns template for IDs ending in -docs', () => {
    expect(inferInstallKind('api-docs')).toBe('template');
    expect(inferInstallKind('common-docs')).toBe('template');
  });

  it('returns template for IDs ending in -command-guide', () => {
    expect(inferInstallKind('setup-command-guide')).toBe('template');
    expect(inferInstallKind('opsx-command-guide')).toBe('template');
  });

  it('returns static for unknown IDs', () => {
    expect(inferInstallKind('common-base')).toBe('static');
    expect(inferInstallKind('some-file.json')).toBe('static');
    expect(inferInstallKind('cli-scripts')).toBe('static');
  });

  it('returns static for IDs ending in something similar but not exact match', () => {
    expect(inferInstallKind('command')).toBe('static');
    expect(inferInstallKind('docs-not-matching')).toBe('static');
  });

  it('returns template for .hbs in the asset ID directly even with other prefixes', () => {
    expect(inferInstallKind('any-prefix-file.hbs')).toBe('template');
  });
});
