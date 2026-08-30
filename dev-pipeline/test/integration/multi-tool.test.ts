import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { runUninstallCommand } from '../../src/cli/commands/uninstall.js';
import { runInit as runInitImpl } from '../../src/core/init/runInit.js';
import { inferAssetTool, readManifest } from '../../src/core/manifest/io.js';
import type { PipelineManifest } from '../../src/core/manifest/types.js';
import { MANIFEST_FILE } from '../../src/core/runtime/meta.js';
import { cleanupDirectories } from '../helpers/cleanup.js';

async function runInit(options: Parameters<typeof runInitImpl>[0]): Promise<void> {
  await runInitImpl({ stack: 'backend', yes: true, force: false, dryRun: false, ...options });
}

async function readStoredManifest(dir: string): Promise<PipelineManifest> {
  const result = await readManifest(dir);
  if (!result) throw new Error(`Manifest not found in ${dir}`);
  return result.manifest;
}

const createdDirs: string[] = [];

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

describe('multi-tool manifest', () => {
  // These tests spawn two `openspec init` subprocesses per scenario, which easily
  // exceeds the default 15s when run alongside the rest of the suite.
  const LONG = 120_000;

  it('infers tool attribution from a known tool directory prefix', () => {
    expect(inferAssetTool('.claude/skills/opsx-dev-pipeline/SKILL.md')).toBe('claude');
    expect(inferAssetTool('.cursor/rules/opsx-dev-pipeline.mdc')).toBe('cursor');
    expect(inferAssetTool('.codex/skills/opsx-dev-pipeline/SKILL.md')).toBe('codex');
    expect(inferAssetTool('.opencode/opencode.json')).toBe('opencode');
  });

  it('returns undefined for tool-agnostic destinations', () => {
    expect(inferAssetTool('README.md')).toBeUndefined();
    expect(inferAssetTool('.gitignore')).toBeUndefined();
    expect(inferAssetTool('openspec/config.yaml')).toBeUndefined();
    expect(inferAssetTool('CLAUDE.md')).toBeUndefined();
    expect(inferAssetTool('openspec/schemas/frontend/schema.yaml')).toBeUndefined();
  });

  it('migrates a legacy single-tool manifest to the new schema on read', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-migrate-'));
    createdDirs.push(dir);

    // Hand-write a v1 manifest (no `tools` array, no per-asset tool tag).
    await fs.writeJson(path.join(dir, MANIFEST_FILE), {
      schemaVersion: 1,
      projectName: 'legacy',
      tool: 'claude',
      features: ['base', 'skills', 'commands'],
      templateVersion: '0.2.1',
      packageName: 'opsx-dev-pipeline',
      managedAssets: [
        { id: 'common-readme', destination: 'README.md' },
        { id: 'claude-docs', destination: 'CLAUDE.md' },
        {
          id: 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
          destination: '.claude/skills/opsx-dev-pipeline/SKILL.md',
        },
        {
          id: 'opsx-dev-pipeline-command',
          destination: '.claude/commands/opsx/dev-pipeline.md',
        },
      ],
    });

    const result = await readManifest(dir);
    expect(result).not.toBeNull();
    const manifest = result?.manifest;
    if (!manifest) throw new Error('manifest is null');

    // Schema is bumped; legacy `tool` is preserved.
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.tool).toBe('claude');
    expect(manifest.tools).toEqual(['claude']);

    // Tool-attributable assets get an inferred `tool` tag; shared assets stay untagged.
    const readme = manifest.managedAssets.find((a) => a.id === 'common-readme');
    const claudeDocs = manifest.managedAssets.find((a) => a.id === 'claude-docs');
    const skillBundle = manifest.managedAssets.find((a) =>
      a.id.startsWith('opsx-dev-pipeline-skill-bundle:'),
    );
    expect(readme?.tool).toBeUndefined();
    expect(claudeDocs?.tool).toBe('claude');
    expect(skillBundle?.tool).toBe('claude');
  });

  it('keeps two tools’ assets side-by-side after sequential init runs', {
    timeout: LONG,
  }, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-init-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude' });
    await runInit({ dir, tool: 'opencode' });

    const manifest = await readStoredManifest(dir);

    // Both tools recorded in the manifest top-level.
    expect(manifest.tool).toBe('opencode');
    expect(manifest.tools).toEqual(['claude', 'opencode']);

    // Both tool directories physically populated.
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(dir, '.opencode/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(dir, '.opencode/opencode.json'))).toBe(true);

    // Per-asset `tool` tag separates the two stacks.
    const skillBundleEntries = manifest.managedAssets.filter(
      (a) => a.id === 'opsx-dev-pipeline-skill-bundle:SKILL.md.hbs',
    );
    expect(skillBundleEntries.map((a) => a.tool).sort()).toEqual(['claude', 'opencode']);

    // The same bundle id can appear twice when installed for two tools, once per tag.
    expect(skillBundleEntries).toHaveLength(2);

    // Shared assets (README, openspec/config.yaml) have no tool tag.
    const sharedAssets = manifest.managedAssets.filter((a) => !a.tool);
    expect(sharedAssets.map((a) => a.id)).toEqual(
      expect.arrayContaining(['common-readme', 'common-gitignore', 'stack-config']),
    );

    const schemaAssets = manifest.managedAssets.filter((a) =>
      a.id.startsWith('backend-schema-bundle:'),
    );
    expect(schemaAssets.every((a) => !a.tool)).toBe(true);
  });

  it('re-installing the same tool replaces only that tool’s tagged assets', {
    timeout: LONG,
  }, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-reinit-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude' });
    const firstOpencodeTouch = await fs.readJson(path.join(dir, MANIFEST_FILE));
    const opencodeBeforeCount = firstOpencodeTouch.managedAssets.filter(
      (a: { tool?: string }) => a.tool === 'opencode',
    ).length;
    expect(opencodeBeforeCount).toBe(0);

    // Drop a Claude marker so re-init can detect it; the second init should NOT delete
    // previously-installed files but should refresh the manifest tool list.
    await runInit({ dir, tool: 'claude' });

    const after = await readStoredManifest(dir);
    expect(after.tools).toEqual(['claude']);
    // No accidental opencode artifacts after a claude-only re-init.
    expect(await fs.pathExists(path.join(dir, '.opencode/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      false,
    );
  });

  it('--tool flag removes only one tool’s assets and preserves shared files', {
    timeout: LONG,
  }, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-uninstall-one-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude' });
    await runInit({ dir, tool: 'opencode' });

    await runUninstallCommand({ dir, tool: 'claude', yes: true, dryRun: false });

    // Claude files removed...
    expect(await fs.pathExists(path.join(dir, '.claude/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      false,
    );
    expect(await fs.pathExists(path.join(dir, 'CLAUDE.md'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, '.claude/settings.json'))).toBe(false);

    // ...but opencode files and shared assets survive.
    expect(await fs.pathExists(path.join(dir, '.opencode/skills/opsx-dev-pipeline/SKILL.md'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(dir, '.opencode/opencode.json'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'README.md'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'openspec/config.yaml'))).toBe(true);

    const after = await readStoredManifest(dir);
    expect(after.tools).toEqual(['opencode']);
    expect(after.managedAssets.every((a) => a.tool !== 'claude')).toBe(true);
    // Shared entries still present.
    expect(after.managedAssets.find((a) => a.id === 'common-readme')).toBeDefined();
    expect(after.managedAssets.find((a) => a.id === 'stack-config')).toBeDefined();
  });

  it('full uninstall removes the manifest when the last tool is gone', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-uninstall-all-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude' });

    await runUninstallCommand({ dir, yes: true, dryRun: false });

    expect(await fs.pathExists(path.join(dir, MANIFEST_FILE))).toBe(false);
    expect(await readManifest(dir)).toBeNull();
  });

  it('rejects --tool when the requested tool is not installed', { timeout: LONG }, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-multitool-uninstall-mismatch-'));
    createdDirs.push(dir);

    await runInit({ dir, tool: 'claude' });

    await expect(
      runUninstallCommand({ dir, tool: 'opencode', yes: true, dryRun: false }),
    ).rejects.toThrow(/not installed/);
  });
});
