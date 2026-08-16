import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const stateScript = path.join(
  PACKAGE_ROOT,
  'templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);
const createdDirs: string[] = [];
let repo = '';

interface StateResult {
  code: number;
  payload: Record<string, unknown>;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-route-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Route Tester']);
  await run('git', ['config', 'user.email', 'route@example.com']);
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repo }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function state(...args: string[]): Promise<StateResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, [stateScript, ...args], { cwd: repo }, (error, stdout) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
    });
  });
}

function rawState(...args: string[]): Promise<StateResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, [stateScript, ...args], { cwd: repo }, (error, stdout) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, payload: stdout ? JSON.parse(stdout) : {} });
    });
  });
}

describe('route grading', () => {
  describe('init with route', () => {
    it('initializes with default standard route', async () => {
      const result = await rawState(
        'init',
        'default-route',
        'feature/default-route',
        '--skip-feature-association',
      );

      expect(result.code).toBe(0);
      expect(result.payload.state).toMatchObject({ route: 'standard' });
    });

    it('initializes with trivial route', async () => {
      const result = await rawState(
        'init',
        'trivial-route',
        'feature/trivial-route',
        '--skip-feature-association',
        '--route',
        'trivial',
      );

      expect(result.code).toBe(0);
      expect(result.payload.state).toMatchObject({ route: 'trivial' });
    });

    it('initializes with full route', async () => {
      const result = await rawState(
        'init',
        'full-route',
        'feature/full-route',
        '--skip-feature-association',
        '--route',
        'full',
      );

      expect(result.code).toBe(0);
      expect(result.payload.state).toMatchObject({ route: 'full' });
    });

    it('rejects invalid route', async () => {
      const result = await rawState(
        'init',
        'invalid-route',
        'feature/invalid-route',
        '--skip-feature-association',
        '--route',
        'invalid',
      );

      expect(result.code).toBe(11);
      expect(result.payload).toMatchObject({ reason: 'invalid-route' });
    });
  });

  describe('trivial route phase path', () => {
    it('allows Phase 0 to Phase 2 transition', async () => {
      await rawState(
        'init',
        'trivial-p0-p2',
        'feature/trivial-p0-p2',
        '--skip-feature-association',
        '--route',
        'trivial',
      );

      // Set proposal approved to pass gate
      await state('decision', 'trivial-p0-p2', 'proposalApproved', 'true');

      const result = await state('transition', 'trivial-p0-p2', '2', '1');

      expect(result.code).toBe(0);
      expect(result.payload.state).toMatchObject({ currentPhase: 2 });
    });

    it('allows Phase 2 to Phase 6 transition', async () => {
      await rawState(
        'init',
        'trivial-p2-p6',
        'feature/trivial-p2-p6',
        '--skip-feature-association',
        '--route',
        'trivial',
      );

      // Set up state for Phase 2 -> Phase 6
      await state('decision', 'trivial-p2-p6', 'proposalApproved', 'true');
      await state('transition', 'trivial-p2-p6', '2', '1');
      await state('decision', 'trivial-p2-p6', 'implementationConfirmed', 'true');
      await state('set', 'trivial-p2-p6', 'archivePath', '"openspec/archive/trivial-p2-p6"');
      await state('decision', 'trivial-p2-p6', 'postArchiveAction', '"push-only"');

      const result = await state('transition', 'trivial-p2-p6', '6', '1');

      expect(result.code).toBe(0);
      expect(result.payload.state).toMatchObject({ currentPhase: 6 });
    });

    it('rejects Phase 0 to Phase 1 transition for trivial route', async () => {
      await rawState(
        'init',
        'trivial-reject-p1',
        'feature/trivial-reject-p1',
        '--skip-feature-association',
        '--route',
        'trivial',
      );

      const result = await state('transition', 'trivial-reject-p1', '1', '1');

      expect(result.code).toBe(11);
      expect(result.payload).toMatchObject({ reason: 'route-phase-not-allowed' });
    });
  });

  describe('standard route phase path', () => {
    it('allows sequential phase transitions', async () => {
      await rawState(
        'init',
        'standard-seq',
        'feature/standard-seq',
        '--skip-feature-association',
      );

      // Phase 0 -> Phase 1
      const result1 = await state('transition', 'standard-seq', '1', '1');
      expect(result1.code).toBe(0);
      expect(result1.payload.state).toMatchObject({ currentPhase: 1 });
    });
  });

  describe('route field persistence', () => {
    it('persists route through transitions', async () => {
      await rawState(
        'init',
        'route-persist',
        'feature/route-persist',
        '--skip-feature-association',
        '--route',
        'trivial',
      );

      await state('decision', 'route-persist', 'proposalApproved', 'true');
      await state('transition', 'route-persist', '2', '1');

      const getResult = await state('get', 'route-persist');
      expect(getResult.payload.state).toMatchObject({ route: 'trivial', currentPhase: 2 });
    });
  });
});
