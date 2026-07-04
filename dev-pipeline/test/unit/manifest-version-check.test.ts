import { describe, expect, it } from 'vitest';
import { checkManifestVersion, mergeHealthStatus } from '../../src/core/manifest/versionCheck.js';

describe('checkManifestVersion', () => {
  it('reports current when versions match', () => {
    const result = checkManifestVersion('0.1.5', '0.1.5');

    expect(result.status).toBe('current');
    expect(result.healthStatus).toBe('ok');
  });

  it('warns when manifest version is older than the CLI', () => {
    const result = checkManifestVersion('0.1.0', '0.1.5');

    expect(result.status).toBe('outdated');
    expect(result.healthStatus).toBe('warn');
    expect(result.recommendation).toContain('upgrade');
  });

  it('warns when manifest version is newer than the CLI', () => {
    const result = checkManifestVersion('0.2.0', '0.1.5');

    expect(result.status).toBe('ahead');
    expect(result.healthStatus).toBe('warn');
    expect(result.recommendation).toContain('Upgrade the opsx-dev-pipeline package');
  });

  it('warns when versions cannot be parsed', () => {
    const result = checkManifestVersion('dev', '0.1.5');

    expect(result.status).toBe('unknown');
    expect(result.healthStatus).toBe('warn');
  });
});

describe('mergeHealthStatus', () => {
  it('prefers fail, then warn, otherwise ok', () => {
    expect(mergeHealthStatus('ok', 'warn')).toBe('warn');
    expect(mergeHealthStatus('warn', 'ok')).toBe('warn');
    expect(mergeHealthStatus('fail', 'ok')).toBe('fail');
    expect(mergeHealthStatus('ok', 'ok')).toBe('ok');
  });
});
