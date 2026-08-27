import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const scriptPath = path.join(
  PACKAGE_ROOT,
  'src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs',
);
const createdDirs: string[] = [];
let repo = '';

interface ModuleResult {
  code: number;
  stdout: string;
  stderr: string;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-route-transition-'));
  createdDirs.push(repo);
  await runCommand('git', ['init', '--quiet'], repo);
  await runCommand('git', ['config', 'user.name', 'Test'], repo);
  await runCommand('git', ['config', 'user.email', 'test@test.com'], repo);
  await fs.ensureDir(path.join(repo, 'openspec', '.pipeline-state'));
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

function runCommand(command: string, args: string[], cwd: string): Promise<ModuleResult> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

function runScript(args: string[]): Promise<ModuleResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, [scriptPath, ...args, '--view', 'full'], { cwd: repo }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

async function createState(name: string, route?: string) {
  const state: Record<string, unknown> = {
    schemaVersion: 3,
    _version: 0,
    changeName: name,
    sourceBranch: 'main',
    targetBranch: null,
    currentPhase: 0,
    currentStep: 1,
    status: 'active',
    executionMode: 'pipeline',
    decisions: { proposalApproved: true, implementationConfirmed: true },
    phaseHistory: [
      {
        phase: 0,
        step: 1,
        executedBy: 'pipeline',
        status: 'in-progress',
        startedAt: '2026-01-01 00:00:00',
        completedAt: null,
        decisions: {},
        gatesBypassed: [],
      },
    ],
    gatesBypassed: [],
    review: { currentRound: 0, rounds: [], reportPath: null, status: 'pending' },
    tests: { command: null, attempts: 0, status: 'passed', detail: null },
    verify: { command: null, attempts: 0, status: 'passed', detail: null },
    archivePath: '/tmp/archive',
    delivery: {
      commitSha: null,
      mergeCommitSha: null,
      sourcePushed: false,
      targetPushed: false,
      tag: null,
    },
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    createdBy: 'test',
    createdByEmail: 'test@test.com',
    machineInfo: { platform: 'test', hostname: 'test', osRelease: 'test', nodeVersion: 'test', arch: 'test' },
    featureInfo: null,
    fingerprintId: '',
    fingerprintNonce: '',
  };
  if (route) {
    state.route = { choice: route, upgradedFrom: null, upgradedAt: null };
  }
  await fs.outputFile(
    path.join(repo, 'openspec', '.pipeline-state', `${name}.json`),
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

async function writeConfig(routesYaml: string) {
  await fs.outputFile(
    path.join(repo, 'openspec', 'config.yaml'),
    `schema: spec-driven\npipeline:\n  routes:\n${routesYaml}`,
  );
}

describe('Route Validation in Transitions', () => {
  it('allows transition to phase in route (trivial route, phase 2)', async () => {
    await createState('test-change', 'trivial');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    const result = await runScript(['transition', 'test-change', '2', '6']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('ok');
  });

  it('blocks transition to phase not in route (trivial route, phase 1)', async () => {
    await createState('test-change', 'trivial');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    const result = await runScript(['transition', 'test-change', '1', '3']);
    expect(result.code).toBe(11);
    expect(JSON.parse(result.stdout).reason).toBe('phase-not-in-route');
  });

  it('allows all phases for full route', async () => {
    await createState('test-change', 'full');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    const result = await runScript(['transition', 'test-change', '1', '3']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('ok');
  });

  it('uses default full route when config has no routes', async () => {
    await createState('test-change');
    // No config file → defaults to full route

    const result = await runScript(['transition', 'test-change', '1', '3']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('ok');
  });

  it('blocks phase 3 and 4 for standard route', async () => {
    await createState('test-change', 'standard');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    const result3 = await runScript(['transition', 'test-change', '3', '9']);
    expect(result3.code).toBe(11);
    expect(JSON.parse(result3.stdout).reason).toBe('phase-not-in-route');

    const result4 = await runScript(['transition', 'test-change', '4', '13']);
    expect(result4.code).toBe(11);
    expect(JSON.parse(result4.stdout).reason).toBe('phase-not-in-route');
  });

  it('allows phase 5 for standard route', async () => {
    await createState('test-change', 'standard');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    const result = await runScript(['transition', 'test-change', '5', '15']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('ok');
  });
});

describe('Route Upgrade Command', () => {
  it('upgrades from trivial to standard', async () => {
    await createState('test-change', 'trivial');

    const result = await runScript(['route', 'test-change', 'upgrade', 'standard']);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.status).toBe('ok');
    expect(output.route.choice).toBe('standard');
    expect(output.route.upgradedFrom).toBe('trivial');
    expect(output.route.upgradedAt).toBeTruthy();
  });

  it('upgrades from standard to full', async () => {
    await createState('test-change', 'standard');

    const result = await runScript(['route', 'test-change', 'upgrade', 'full']);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.route.choice).toBe('full');
    expect(output.route.upgradedFrom).toBe('standard');
  });

  it('prevents downgrade from full to standard', async () => {
    await createState('test-change', 'full');

    const result = await runScript(['route', 'test-change', 'upgrade', 'standard']);
    expect(result.code).toBe(11);
    expect(JSON.parse(result.stdout).reason).toBe('route-downgrade-not-allowed');
  });

  it('prevents downgrade from standard to trivial', async () => {
    await createState('test-change', 'standard');

    const result = await runScript(['route', 'test-change', 'upgrade', 'trivial']);
    expect(result.code).toBe(11);
    expect(JSON.parse(result.stdout).reason).toBe('route-downgrade-not-allowed');
  });

  it('rejects invalid route name', async () => {
    await createState('test-change', 'trivial');

    const result = await runScript(['route', 'test-change', 'upgrade', 'invalid-route']);
    expect(result.code).toBe(11);
    expect(JSON.parse(result.stdout).reason).toBe('invalid-route-name');
  });

  it('allows transition after upgrade (trivial → standard enables phase 1)', async () => {
    await createState('test-change', 'trivial');
    await writeConfig(
      `    trivial:\n      description: "Trivial changes"\n      phases: [0, 2, 6]\n    standard:\n      description: "Standard changes"\n      phases: [0, 1, 2, 5, 6]\n    full:\n      description: "Full changes"\n      phases: [0, 1, 2, 3, 4, 5, 6, 7]\n`,
    );

    // First upgrade
    const upgradeResult = await runScript(['route', 'test-change', 'upgrade', 'standard']);
    expect(upgradeResult.code).toBe(0);

    // Now phase 1 should be allowed
    const transitionResult = await runScript(['transition', 'test-change', '1', '3']);
    expect(transitionResult.code).toBe(0);
    expect(JSON.parse(transitionResult.stdout).status).toBe('ok');
  });
});

describe('Backward Compatibility', () => {
  it('old state file without route field defaults to full route', async () => {
    // Create state without route field
    await createState('test-change');
    // Remove route field if it exists
    const statePath = path.join(repo, 'openspec', '.pipeline-state', 'test-change.json');
    const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
    delete state.route;
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

    // Should allow transition to any phase (full route behavior)
    const result = await runScript(['transition', 'test-change', '1', '3']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).status).toBe('ok');
  });

  it('get command returns route information', async () => {
    await createState('test-change', 'standard');

    const result = await runScript(['get', 'test-change']);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.state.route).toBeDefined();
    expect(output.state.route.choice).toBe('standard');
  });
});
