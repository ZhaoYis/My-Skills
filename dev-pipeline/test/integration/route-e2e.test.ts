import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const stateScript = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);
const createdDirs: string[] = [];
let repo = '';

interface StateResult {
  code: number;
  payload: Record<string, unknown>;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-route-e2e-'));
  createdDirs.push(repo);
  await run('git', ['init', '--quiet']);
  await run('git', ['config', 'user.name', 'Route Tester']);
  await run('git', ['config', 'user.email', 'route@example.com']);
  await fs.ensureDir(path.join(repo, 'openspec', '.pipeline-state'));
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

function runState(args: string[]): Promise<StateResult> {
  return new Promise((resolve) => {
    execFile('node', [stateScript, ...args], { cwd: repo }, (error, stdout) => {
      const code = error?.code ?? 0;
      const payload = stdout ? JSON.parse(stdout) : {};
      resolve({ code, payload });
    });
  });
}

async function writeConfig(routes: Record<string, { description: string; phases: number[] }>) {
  const configContent = `schema: spec-driven
pipeline:
  routes:
${Object.entries(routes)
  .map(
    ([name, route]) => `    ${name}:
      description: "${route.description}"
      phases: [${route.phases.join(', ')}]`,
  )
  .join('\n')}
`;
  await fs.writeFile(path.join(repo, 'openspec', 'config.yaml'), configContent);
}

async function initState(changeName: string, route: string) {
  const result = await runState(['init', changeName, 'main', '--skip-feature-association']);
  expect(result.code).toBe(0);
  expect(result.payload.status).toBe('ok');

  // Set the route field directly by reading and updating the state file
  const statePath = path.join(repo, 'openspec', '.pipeline-state', `${changeName}.json`);
  const state = await fs.readJson(statePath);
  state.route = { choice: route, upgradedFrom: null, upgradedAt: null };
  await fs.writeJson(statePath, state, { spaces: 2 });
}

describe('Route End-to-End Scenarios', () => {
  describe('Trivial Route (typo fix)', () => {
    it('completes Phase 0 → 2 → 6 flow', async () => {
      const changeName = 'fix-typo';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'trivial');

      // Set required gate decisions for Phase 2
      const statePath = path.join(repo, 'openspec', '.pipeline-state', `${changeName}.json`);
      let state = await fs.readJson(statePath);
      state.decisions.proposalApproved = true;
      state.decisions.implementationConfirmed = true;
      await fs.writeJson(statePath, state, { spaces: 2 });

      // Phase 0 → Phase 2
      const toPhase2 = await runState(['transition', changeName, '2', '6']);
      expect(toPhase2.code).toBe(0);
      expect(toPhase2.payload.status).toBe('ok');

      // Set required gate decisions for Phase 6
      state = await fs.readJson(statePath);
      state.tests = { status: 'skipped' };
      state.verify = { status: 'passed' };
      state.archivePath = '/path/to/archive';
      state.decisions.postArchiveAction = 'push-only';
      await fs.writeJson(statePath, state, { spaces: 2 });

      // Phase 2 → Phase 6
      const toPhase6 = await runState(['transition', changeName, '6', '20']);
      if (toPhase6.code !== 0) {
        console.log('Phase 2 → 6 failed:', toPhase6.payload);
      }
      expect(toPhase6.code).toBe(0);
      expect(toPhase6.payload.status).toBe('ok');

      // Verify route is still trivial
      const finalState = await runState(['get', changeName]);
      expect(finalState.payload.state).toMatchObject({
        route: { choice: 'trivial' },
        currentPhase: 6,
      });
    });

    it('blocks transition to Phase 1 (not in trivial route)', async () => {
      const changeName = 'fix-typo-blocked';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'trivial');

      // Try to transition to Phase 1 (should fail)
      const toPhase1 = await runState(['transition', changeName, '1', '3']);
      expect(toPhase1.code).toBe(11);
      expect(toPhase1.payload.reason).toBe('phase-not-in-route');
    });
  });

  describe('Standard Route (feature development)', () => {
    it('completes Phase 0 → 1 → 2 → 5 → 6 flow', async () => {
      const changeName = 'add-feature';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'standard');

      // Phase 0 → Phase 1
      const toPhase1 = await runState(['transition', changeName, '1', '3']);
      expect(toPhase1.code).toBe(0);

      // Set proposal approved (gate for Phase 2)
      await runState(['decision', changeName, 'proposalApproved', 'true']);

      // Phase 1 → Phase 2
      const toPhase2 = await runState(['transition', changeName, '2', '6']);
      expect(toPhase2.code).toBe(0);

      // Set implementation confirmed (gate for Phase 5)
      await runState(['decision', changeName, 'implementationConfirmed', 'true']);

      // Set test status (gate for Phase 5)
      await runState(['set', changeName, 'tests.status', 'passed']);

      // Phase 2 → Phase 5
      const toPhase5 = await runState(['transition', changeName, '5', '15']);
      expect(toPhase5.code).toBe(0);

      // Set verify status (gate for Phase 6)
      await runState(['set', changeName, 'verify.status', 'passed']);
      await runState(['set', changeName, 'archivePath', '/path/to/archive']);
      await runState(['decision', changeName, 'postArchiveAction', '"push-only"']);

      // Phase 5 → Phase 6
      const toPhase6 = await runState(['transition', changeName, '6', '20']);
      expect(toPhase6.code).toBe(0);

      // Verify route is still standard
      const state = await runState(['get', changeName]);
      expect(state.payload.state).toMatchObject({
        route: { choice: 'standard' },
        currentPhase: 6,
      });
    });

    it('blocks transition to Phase 3 (not in standard route)', async () => {
      const changeName = 'add-feature-blocked';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'standard');

      // Try to transition to Phase 3 (should fail)
      const toPhase3 = await runState(['transition', changeName, '3', '9']);
      expect(toPhase3.code).toBe(11);
      expect(toPhase3.payload.reason).toBe('phase-not-in-route');
    });
  });

  describe('Full Route (core logic change)', () => {
    it('completes Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 flow', async () => {
      const changeName = 'core-logic-change';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'full');

      // Phase 0 → Phase 1
      let result = await runState(['transition', changeName, '1', '3']);
      expect(result.code).toBe(0);

      // Set proposal approved
      await runState(['decision', changeName, 'proposalApproved', 'true']);

      // Phase 1 → Phase 2
      result = await runState(['transition', changeName, '2', '6']);
      expect(result.code).toBe(0);

      // Set implementation confirmed
      await runState(['decision', changeName, 'implementationConfirmed', 'true']);

      // Phase 2 → Phase 3
      result = await runState(['transition', changeName, '3', '9']);
      expect(result.code).toBe(0);

      // Phase 3 → Phase 4
      result = await runState(['transition', changeName, '4', '13']);
      expect(result.code).toBe(0);

      // Set test status
      await runState(['set', changeName, 'tests.status', 'passed']);

      // Phase 4 → Phase 5
      result = await runState(['transition', changeName, '5', '15']);
      expect(result.code).toBe(0);

      // Set verify status
      await runState(['set', changeName, 'verify.status', 'passed']);
      await runState(['set', changeName, 'archivePath', '/path/to/archive']);
      await runState(['decision', changeName, 'postArchiveAction', '"merge"']);

      // Phase 5 → Phase 6
      result = await runState(['transition', changeName, '6', '20']);
      expect(result.code).toBe(0);

      // Set delivery info
      await runState(['set', changeName, 'delivery.commitSha', '"abc123"']);
      await runState(['set', changeName, 'delivery.sourcePushed', 'true']);

      // Phase 6 → Phase 7
      result = await runState(['transition', changeName, '7', '23']);
      expect(result.code).toBe(0);

      // Verify route is still full
      const state = await runState(['get', changeName]);
      expect(state.payload.state).toMatchObject({
        route: { choice: 'full' },
        currentPhase: 7,
      });
    });
  });

  describe('Route Upgrade', () => {
    it('upgrades from trivial to standard mid-flow', async () => {
      const changeName = 'upgrade-trivial-to-standard';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'trivial');

      // Set required gate decisions
      const statePath = path.join(repo, 'openspec', '.pipeline-state', `${changeName}.json`);
      const state = await fs.readJson(statePath);
      state.decisions.proposalApproved = true;
      state.decisions.implementationConfirmed = true;
      await fs.writeJson(statePath, state, { spaces: 2 });

      // Phase 0 → Phase 2 (trivial route)
      let result = await runState(['transition', changeName, '2', '6']);
      expect(result.code).toBe(0);

      // Upgrade to standard
      result = await runState(['route', changeName, 'upgrade', 'standard']);
      expect(result.code).toBe(0);
      expect(result.payload.route.choice).toBe('standard');
      expect(result.payload.route.upgradedFrom).toBe('trivial');

      // Now Phase 1 should be accessible (going back)
      result = await runState(['transition', changeName, '1', '3']);
      expect(result.code).toBe(0);

      // Verify upgrade history
      const finalState = await runState(['get', changeName]);
      expect(finalState.payload.state.route).toMatchObject({
        choice: 'standard',
        upgradedFrom: 'trivial',
        upgradedAt: expect.any(String),
      });
    });

    it('prevents downgrade from standard to trivial', async () => {
      const changeName = 'prevent-downgrade';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);
      await initState(changeName, 'standard');

      // Try to downgrade to trivial (should fail)
      const result = await runState(['route', changeName, 'upgrade', 'trivial']);
      expect(result.code).toBe(11);
      expect(result.payload.reason).toBe('route-downgrade-not-allowed');
    });
  });

  describe('Backward Compatibility', () => {
    it('continues old change without route field (defaults to full)', async () => {
      const changeName = 'legacy-change';
      const routes = {
        trivial: { description: 'Trivial changes', phases: [0, 2, 6] },
        standard: { description: 'Standard changes', phases: [0, 1, 2, 5, 6] },
        full: { description: 'Full changes', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
      };

      await writeConfig(routes);

      // Initialize without setting route
      const result = await runState(['init', changeName, 'main', '--skip-feature-association']);
      expect(result.code).toBe(0);

      // Set required gate decisions
      const statePath = path.join(repo, 'openspec', '.pipeline-state', `${changeName}.json`);
      let state = await fs.readJson(statePath);
      state.decisions.proposalApproved = true;
      state.decisions.implementationConfirmed = true;
      await fs.writeJson(statePath, state, { spaces: 2 });

      // Should default to full route and allow all phases
      let transition = await runState(['transition', changeName, '1', '3']);
      expect(transition.code).toBe(0);

      transition = await runState(['transition', changeName, '3', '9']);
      expect(transition.code).toBe(0);

      transition = await runState(['transition', changeName, '4', '13']);
      expect(transition.code).toBe(0);

      // Verify route defaults to full
      state = await runState(['get', changeName]);
      expect(state.payload.state.route.choice).toBe('full');
    });
  });
});
