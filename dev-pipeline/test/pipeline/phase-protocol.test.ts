import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import Handlebars from 'handlebars';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const execute = promisify(execFile);
const skillRoot = path.join(PACKAGE_ROOT, 'src/templates/common/skills/opsx-dev-pipeline');
const stateScript = path.join(skillRoot, 'scripts', 'dev-pipeline-state.mjs');
const directories: string[] = [];

function render(file: string): string {
  return Handlebars.compile(readFileSync(path.join(skillRoot, file), 'utf8'))({
    askTool: 'AskUserQuestion',
    packageVersion: '0.0.0',
    packageLicense: 'MIT',
    packageRepoUrl: 'https://example.invalid/repo',
  });
}

function phaseFile(phase: number): string {
  const names = [
    'entrance',
    'propose',
    'apply',
    'review',
    'unit-tests',
    'archive',
    'commit-push',
    'merge-deliver',
  ];
  return path.join('references', `phase-${phase}-${names[phase]}.md.hbs`);
}

async function state(repo: string, ...args: string[]): Promise<Record<string, unknown>> {
  const result = await execute(process.execPath, [stateScript, ...args, '--view', 'full'], {
    cwd: repo,
  });
  return JSON.parse(result.stdout);
}

// Exercise commands read from the rendered reference instead of reproducing
// routing logic in a test executor. The consumer cwd differs from SKILL_ROOT.
async function followReference(repo: string, phase: number): Promise<number> {
  const reference = render(phaseFile(phase));
  const query = reference.match(/^\s*node "(<SKILL_ROOT>\/scripts\/[^"\n]+)" next "<name>"$/m);
  const transition = reference.match(
    /^\s*node "(<SKILL_ROOT>\/scripts\/[^"\n]+)" transition "<name>" <nextPhase> <nextStep>$/m,
  );
  expect(query, `Phase${phase} must query the next valid Phase`).not.toBeNull();
  expect(transition, `Phase${phase} must consume the query result`).not.toBeNull();
  const script = path.join(skillRoot, 'scripts', path.basename(query?.[1] ?? 'missing'));
  const result = await execute(process.execPath, [script, 'next', 'change'], { cwd: repo });
  const next = JSON.parse(result.stdout) as { nextPhase: number; nextStep: number };
  await state(repo, 'transition', 'change', String(next.nextPhase), String(next.nextStep));
  return next.nextPhase;
}

afterEach(async () => {
  await cleanupDirectories(directories);
});

describe('rendered Pipeline execution protocol', () => {
  it('resolves all Node script examples independently of the consumer cwd', () => {
    const files = ['SKILL.md.hbs', ...Array.from({ length: 8 }, (_, phase) => phaseFile(phase))];
    for (const file of files) {
      const reference = render(file);
      const nodeCommands = [...reference.matchAll(/\bnode\s+("[^"\n]+\.mjs"|[^\s`\n]+\.mjs)/g)];
      expect(nodeCommands.length, file).toBeGreaterThan(0);
      for (const [, target] of nodeCommands) {
        expect(target, `${file}: script must be quoted and rooted at SKILL_ROOT`).toMatch(
          /^"<SKILL_ROOT>\/scripts\/[a-z-]+\.mjs"$/,
        );
        const name = target.slice(1, -1).split('/').at(-1) ?? '';
        expect(fs.existsSync(path.join(skillRoot, 'scripts', name)), `${file}: ${name}`).toBe(true);
      }
    }
  });

  it.each([
    { route: 'trivial', entry: 2, exit: 6, disposition: 'route-skipped' },
    { route: 'standard', entry: 1, exit: 5, disposition: 'route-skipped' },
    { route: 'full', entry: 1, exit: 3, disposition: 'review' },
    { route: 'full', entry: 1, exit: 4, disposition: 'skip-review' },
  ])('runs $route / $disposition entry and Apply commands from the references', async (scenario) => {
    const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx phase protocol-'));
    directories.push(repo);
    await execute('git', ['init', '--quiet'], { cwd: repo });
    await fs.outputFile(path.join(repo, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
    await state(
      repo,
      'init',
      'change',
      'feature/change',
      '--route',
      scenario.route,
      '--skip-feature-association',
    );
    expect(await followReference(repo, 0)).toBe(scenario.entry);
    if (scenario.entry === 1) {
      await state(repo, 'decision', 'change', 'proposalApproved', 'true');
      expect(await followReference(repo, 1)).toBe(2);
    }
    await state(repo, 'decision', 'change', 'implementationConfirmed', 'true');
    if (scenario.route === 'full') {
      await state(repo, 'decision', 'change', 'reviewDisposition', scenario.disposition);
    }
    expect(await followReference(repo, 2)).toBe(scenario.exit);
  }, 15000);
});
