import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { runInit } from '../../src/core/init/runInit.js';
import { cleanupDirectories } from '../helpers/cleanup.js';

const execFileAsync = promisify(execFile);
const createdDirs: string[] = [];

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

async function runKb(dir: string, ...args: string[]) {
  return execFileAsync(
    process.execPath,
    [path.join(dir, 'openspec/knowledge/scripts/kb.mjs'), ...args],
    { cwd: dir },
  );
}

describe('knowledge base', () => {
  it('installs and completes the capture, review, search, and proposal-link workflow', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-kb-'));
    createdDirs.push(dir);
    await runInit({
      dir,
      tool: 'claude',
      stack: 'backend',
      yes: true,
      force: false,
      dryRun: false,
    });

    const knowledge = path.join(dir, 'openspec/knowledge');
    const script = path.join(knowledge, 'scripts/kb.mjs');
    expect(await fs.pathExists(script)).toBe(true);
    expect(await fs.pathExists(path.join(knowledge, '.schemas/entry.schema.json'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/skills/kb/SKILL.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '.claude/commands/opsx/kb.md'))).toBe(true);

    const captureArgs = [
      'capture',
      '--type',
      'fact',
      '--title',
      'Login uses JWT',
      '--statement',
      'The login endpoint returns a JWT.',
      '--domain',
      'auth',
      '--feature',
      'jwt,api',
      '--owner',
      'team-auth',
      '--captured-by',
      'tester',
    ];
    const preview = await runKb(dir, ...captureArgs);
    expect(preview.stdout).toContain('Preview KB-0001');
    expect(await fs.pathExists(path.join(knowledge, 'entries/KB-0001.md'))).toBe(false);

    await expect(
      runKb(
        dir,
        ...captureArgs.map((value) => (value === 'jwt,api' ? 'unknown-tag' : value)),
        '--write',
      ),
    ).rejects.toThrow();

    await runKb(
      dir,
      ...captureArgs,
      '--source-kind',
      'code',
      '--source-locator',
      'src/auth/login.ts:42',
      '--source-title',
      'Login implementation',
      '--source-summary',
      'The endpoint signs and returns a JWT.',
      '--write',
    );
    expect(await fs.pathExists(path.join(knowledge, 'sources/SRC-0001.md'))).toBe(true);
    let index = await fs.readJson(path.join(knowledge, 'index.json'));
    expect(index.entries['KB-0001']).toMatchObject({ status: 'draft', confidence: 'high' });
    expect(index.entries['KB-0001'].autoTags).toContain('needs-review');

    await runKb(
      dir,
      'review',
      'KB-0001',
      '--action',
      'confirm',
      '--reviewer',
      'reviewer',
      '--write',
    );
    const search = await runKb(dir, 'search', 'JWT', '--json');
    expect(JSON.parse(search.stdout)).toHaveLength(1);

    const proposal = path.join(dir, 'openspec/changes/login-refresh/proposal.md');
    await fs.outputFile(proposal, '# Proposal\n\nUses [KB-0001] as confirmed knowledge.\n');
    await runKb(dir, 'link', '--from-proposal', proposal, '--change', 'login-refresh', '--write');
    index = await fs.readJson(path.join(knowledge, 'index.json'));
    expect(index.index.byChange['login-refresh']).toEqual(['KB-0001']);
  });
});
