import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { runCli } from '../../src/cli/index.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.remove(directory)));
});

async function createProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'optimization-cli-'));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, 'openspec'), { recursive: true });
  return root;
}

describe('optimization CLI runtime chain', () => {
  it('writes effective config atomically and exposes the approved route matrix', async () => {
    const root = await createProject();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runCli([
      'node',
      'opsx-dev-pipeline',
      'config',
      'effective',
      '--format',
      'json',
      '--dir',
      root,
    ]);

    const output = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(output.pipeline.routes.trivial.phases).toEqual([0, 2, 6]);
    expect(output.pipeline.routes.standard.phases).toEqual([0, 1, 2, 3, 6]);
    expect(output.pipeline.routes.full.phases).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const effective = parseYaml(
      await readFile(path.join(root, 'openspec/.effective-config.yaml'), 'utf8'),
    );
    expect(effective.pipeline.routes).toEqual(output.pipeline.routes);
  });

  it('supports knowledge --dir and never prints absolute reference paths', async () => {
    const root = await createProject();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runCli([
      'node',
      'opsx-dev-pipeline',
      'knowledge',
      'select',
      '--phase',
      '2',
      '--dir',
      root,
      '--format',
      'json',
    ]);

    const output = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(output.selected[0].file).toBe('phase-2-apply.md.hbs');
    expect(JSON.stringify(output)).not.toContain(PACKAGE_ROOT);
  });

  it('loads .md.hbs content and resolves route via --change', async () => {
    const root = await createProject();
    const stateDirectory = path.join(root, 'openspec/.pipeline-state');
    await mkdir(stateDirectory, { recursive: true });
    await writeFile(
      path.join(stateDirectory, 'demo.json'),
      JSON.stringify({ decisions: { route_choice: 'trivial' } }),
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runCli([
      'node',
      'opsx-dev-pipeline',
      'load',
      '--phase',
      '2',
      '--change',
      'demo',
      '--dir',
      root,
      '--format',
      'json',
    ]);

    const output = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(output.route).toBe('trivial');
    expect(output.reference).toContain('# Phase2: 提案应用 (Apply)');
    expect(output.reference).not.toContain('asset_kind: procedure');
  });

  it('uses the effective config default route when route and change are omitted', async () => {
    const root = await createProject();
    await writeFile(
      path.join(root, 'openspec/overrides.yaml'),
      'pipeline:\n  default_route: full\n',
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runCli([
      'node',
      'opsx-dev-pipeline',
      'load',
      '--phase',
      '7',
      '--dir',
      root,
      '--format',
      'json',
    ]);

    expect(JSON.parse(String(log.mock.calls[0]?.[0])).route).toBe('full');
  });
});
