import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HOOK = path.resolve(
  process.cwd(),
  'src/templates/common/scripts/hooks/block-sensitive-write.mjs',
);

interface HookResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runHook(payload: object, toolName = 'Write'): HookResult {
  const envelope = JSON.stringify({
    tool_name: toolName,
    tool_input: payload,
  });
  const result = spawnSync('node', [HOOK], {
    input: envelope,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function parseDenyReason(stdout: string): string | null {
  try {
    const json = JSON.parse(stdout);
    return json?.hookSpecificOutput?.permissionDecisionReason ?? null;
  } catch {
    return null;
  }
}

describe('block-sensitive-write', () => {
  it('denies writing .env', () => {
    const result = runHook({ file_path: '/repo/.env' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-env-blocked');
  });

  it('denies writing .env.local', () => {
    const result = runHook({ file_path: '/repo/.env.local' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-env-blocked');
  });

  it('denies writing foo.env.production (env suffix pattern)', () => {
    const result = runHook({ file_path: '/repo/config/foo.env.production' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-env-blocked');
  });

  it('denies writing private.key', () => {
    const result = runHook({ file_path: '/etc/ssl/private.key' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-key-blocked');
  });

  it('denies writing certificate.pem', () => {
    const result = runHook({ file_path: '/certs/certificate.pem' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-key-blocked');
  });

  it('denies writing keystore.p12', () => {
    const result = runHook({ file_path: '/keys/keystore.p12' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-key-blocked');
  });

  it('denies writing credentials.json', () => {
    const result = runHook({ file_path: '/home/user/credentials.json' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-credentials-blocked');
  });

  it('denies writing service-account.json', () => {
    const result = runHook({ file_path: '/gcp/service-account.json' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-credentials-blocked');
  });

  it('denies writing openspec/.pipeline-state/*.json (with helpful reason)', () => {
    const result = runHook({ file_path: '/repo/openspec/.pipeline-state/add-feature.json' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('pipeline-state-write-blocked');
  });

  it('denies writing .git/HEAD', () => {
    const result = runHook({ file_path: '/repo/.git/HEAD' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('git-internal-write-blocked');
  });

  it('allows normal src/*.ts', () => {
    const result = runHook({ file_path: '/repo/src/index.ts' });
    expect(result.status).toBe(0);
  });

  it('allows docs and markdown files', () => {
    for (const p of ['/repo/README.md', '/repo/docs/spec.md', '/repo/CONTRIBUTING']) {
      const result = runHook({ file_path: p });
      expect(result.status, `unexpected deny for: ${p}`).toBe(0);
    }
  });

  it('accepts OpenCode lowercase write/edit tool names', () => {
    for (const tool of ['write', 'edit', 'multi_edit']) {
      const result = runHook({ filePath: '/repo/.env' }, tool);
      expect(result.status, `expected deny for tool=${tool}`).toBe(2);
      expect(parseDenyReason(result.stdout)).toBe('sensitive-env-blocked');
    }
  });

  it('accepts filePath (camelCase) field for OpenCode payloads', () => {
    const result = runHook({ filePath: '/repo/secrets.pem' }, 'write');
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('sensitive-key-blocked');
  });

  it('ignores Bash tool (handled by other hook)', () => {
    const result = runHook({ file_path: '/repo/.env' }, 'Bash');
    expect(result.status).toBe(0);
  });

  it('ignores Read tool', () => {
    const result = runHook({ file_path: '/repo/.env' }, 'Read');
    expect(result.status).toBe(0);
  });

  it('allows when file_path is missing (soft fallback)', () => {
    const result = runHook({});
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/WARN/);
  });

  it('normalizes Windows-style backslashes in paths', () => {
    const result = runHook({ file_path: '\\repo\\openspec\\.pipeline-state\\foo.json' });
    expect(result.status).toBe(2);
    expect(parseDenyReason(result.stdout)).toBe('pipeline-state-write-blocked');
  });
});
