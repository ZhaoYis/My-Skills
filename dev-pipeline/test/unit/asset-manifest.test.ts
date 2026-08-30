import { describe, expect, it } from 'vitest';
import { assetManifest } from '../../src/core/assets/manifest.js';
import type { AssetDefinition, AssetKind, AssetScope } from '../../src/core/assets/types.js';

const REQUIRED_ASSET_IDS = [
  'common-readme',
  'common-gitignore',
  'frontend-schema-bundle',
  'backend-schema-bundle',
  'fullstack-schema-bundle',
  'stack-config',
  'opsx-dev-pipeline-skill-bundle',
  'opsx-grill-me-skill-bundle',
  'opsx-grilling-skill-bundle',
  'opsx-dev-spec-design-skill-bundle',
  'opsx-init-skill-bundle',
  'opsx-dev-pipeline-command',
  'opsx-propose-command',
  'opsx-apply-command',
  'opsx-archive-command',
  'opsx-verify-command',
  'opsx-sync-command',
  'opsx-explore-command',
  'opsx-grill-me-command',
  'opsx-grilling-command',
  'opsx-dev-spec-design-command',
  'opsx-init-command',
  'claude-docs',
  'cursor-docs',
  'cursor-command-guide',
  'pipeline-hooks-script-bundle',
  'claude-settings-hooks',
  'opencode-config-hooks',
];

const VALID_KINDS: AssetKind[] = ['template', 'static', 'bundle'];
const VALID_SCOPES: AssetScope[] = ['common', 'tool'];
const VALID_FEATURES = ['base', 'skills', 'commands', 'docs', 'schema', 'hooks'];
const VALID_STACKS = ['frontend', 'backend', 'fullstack'];
const VALID_TOOLS = ['claude', 'cursor', 'codex', 'opencode'];

describe('assetManifest structural integrity', () => {
  it('contains every required asset id exactly once', () => {
    const ids = assetManifest.map((asset) => asset.id);
    expect(ids).toEqual(expect.arrayContaining(REQUIRED_ASSET_IDS));
    for (const required of REQUIRED_ASSET_IDS) {
      expect(ids.filter((id) => id === required)).toHaveLength(1);
    }
  });

  it('has no duplicate asset ids', () => {
    const ids = assetManifest.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares only valid kinds, scopes, features, stacks, and tools', () => {
    for (const asset of assetManifest) {
      expect(VALID_KINDS).toContain(asset.kind);
      expect(VALID_SCOPES).toContain(asset.scope);
      expect(VALID_FEATURES).toContain(asset.feature);

      if (asset.stacks) {
        for (const stack of asset.stacks) {
          expect(VALID_STACKS).toContain(stack);
        }
      }

      if (asset.tools) {
        for (const tool of asset.tools) {
          expect(VALID_TOOLS).toContain(tool);
        }
      }
    }
  });

  it('requires tools to be set on tool-scoped assets', () => {
    for (const asset of assetManifest) {
      if (asset.scope === 'tool') {
        expect(asset.tools, `tool-scoped asset ${asset.id} must declare tools`).toBeDefined();
        expect(asset.tools?.length).toBeGreaterThan(0);
      }
    }
  });

  it('emits source and destination for every asset', () => {
    for (const asset of assetManifest) {
      expect(asset.source.length).toBeGreaterThan(0);
      expect(asset.destination.length).toBeGreaterThan(0);
    }
  });

  it('includes appendExtensions only for bundle assets that opt in', () => {
    for (const asset of assetManifest) {
      if (asset.writePolicy?.appendExtensions) {
        expect(asset.writePolicy.appendExtensions.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('assetManifest key bindings', () => {
  it('routes each stack-specific schema bundle to its own stack only', () => {
    const frontend = assetManifest.find((asset) => asset.id === 'frontend-schema-bundle');
    const backend = assetManifest.find((asset) => asset.id === 'backend-schema-bundle');
    const fullstack = assetManifest.find((asset) => asset.id === 'fullstack-schema-bundle');

    expect(frontend?.stacks).toEqual(['frontend']);
    expect(backend?.stacks).toEqual(['backend']);
    expect(fullstack?.stacks).toEqual(['fullstack']);
  });

  it('keeps the claude pipeline command limited to claude/cursor/opencode', () => {
    const command = assetManifest.find((asset) => asset.id === 'opsx-dev-pipeline-command');
    expect(command?.tools).toEqual(['claude', 'cursor', 'opencode']);
    expect(command?.toolDestinations?.cursor).toBeDefined();
  });

  it('routes standalone opsx commands through tool-specific destinations when set', () => {
    const commandIds = [
      'opsx-propose-command',
      'opsx-apply-command',
      'opsx-archive-command',
      'opsx-verify-command',
      'opsx-sync-command',
      'opsx-explore-command',
    ];
    for (const id of commandIds) {
      const asset = assetManifest.find((candidate) => candidate.id === id);
      expect(asset?.toolDestinations?.cursor, `${id} should have cursor override`).toBeDefined();
      expect(asset?.toolDestinations?.codex, `${id} should have codex override`).toBeDefined();
    }
  });

  it('only ships hooks-related assets for claude and opencode', () => {
    const hookAssets = assetManifest.filter((asset) => asset.feature === 'hooks');
    expect(hookAssets.length).toBeGreaterThan(0);
    const toolScopeHooks = hookAssets.filter((asset) => asset.scope === 'tool');
    for (const asset of toolScopeHooks) {
      expect(asset.tools).toHaveLength(1);
      expect(['claude', 'opencode']).toContain(asset.tools?.[0]);
    }
    const commonScopeHooks = hookAssets.filter((asset) => asset.scope === 'common');
    for (const asset of commonScopeHooks) {
      expect(asset.tools).toEqual(['claude', 'opencode']);
    }
  });

  it('declares conflict resolution for init/sync/upgrade on mutable assets', () => {
    const mutable = assetManifest.filter(
      (asset) => asset.id === 'opsx-dev-pipeline-command' || asset.id === 'opsx-propose-command',
    );
    for (const asset of mutable) {
      expect(asset.writePolicy?.onConflict).toEqual({
        init: 'overwrite',
        sync: 'overwrite',
        upgrade: 'overwrite',
      });
    }
  });

  it('treats common-readme and common-gitignore as user-maintained (skip on conflict)', () => {
    const userOwned: AssetDefinition[] = [];
    for (const id of ['common-readme', 'common-gitignore']) {
      const asset = assetManifest.find((candidate) => candidate.id === id);
      expect(asset, `${id} should exist`).toBeDefined();
      userOwned.push(asset as AssetDefinition);
    }
    for (const asset of userOwned) {
      expect(asset.writePolicy?.onConflict).toEqual({
        init: 'skip',
        sync: 'skip',
        upgrade: 'skip',
      });
    }
  });

  it('limits every bundle to the bundle kind', () => {
    for (const asset of assetManifest.filter((asset) => asset.kind === 'bundle')) {
      expect(asset.includeExtensions).toBeDefined();
      expect(asset.includeExtensions?.length).toBeGreaterThan(0);
    }
  });
});
