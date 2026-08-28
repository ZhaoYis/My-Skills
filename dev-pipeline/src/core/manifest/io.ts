import path from 'node:path';
import fs from 'fs-extra';
import { z } from 'zod';
import type { ToolId } from '../adapters/types.js';
import {
  LEGACY_MANIFEST_FILE,
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
  PACKAGE_NAME,
  TEMPLATE_VERSION,
} from '../runtime/meta.js';
import type { ManagedAssetRecord, PipelineManifest } from './types.js';

/** Manifest schema versions we know how to read. Bumped when the on-disk shape changes. */
export const CURRENT_SCHEMA_VERSION = 2;

/** Top-level tool directory prefixes we use to infer a managed asset's owning tool
 *  when the legacy manifest doesn't carry an explicit `tool` field. */
const TOOL_DIRECTORY_PREFIXES: readonly ToolId[] = [
  'claude',
  'cursor',
  'codex',
  'opencode',
] as const;

const toolIdSchema = z.enum(['claude', 'cursor', 'codex', 'opencode']);

const managedAssetSchema = z.object({
  id: z.string(),
  destination: z.string(),
  tool: toolIdSchema.optional(),
});

const manifestSchema = z.object({
  schemaVersion: z.number().default(CURRENT_SCHEMA_VERSION),
  projectName: z.string(),
  tool: toolIdSchema.optional(),
  tools: z.array(toolIdSchema).default([]),
  stack: z.enum(['frontend', 'backend', 'fullstack']).optional(),
  techStack: z.string().optional(),
  language: z.enum(['en', 'zh']).optional(),
  scope: z.enum(['user', 'project']).optional(),
  features: z.array(z.enum(['base', 'skills', 'commands', 'docs', 'schema', 'hooks'])),
  templateVersion: z.string().default(TEMPLATE_VERSION),
  packageName: z.string().default(PACKAGE_NAME),
  managedAssets: z.array(managedAssetSchema).default([]),
});

export type ManifestStorage = 'package-json' | 'standalone';

export interface ManifestReadResult {
  path: string;
  manifest: PipelineManifest;
  storage: ManifestStorage;
}

/** Infer which tool owns a managed asset from its destination path and (optionally)
 *  its asset id. Returns `undefined` when neither signal indicates a known tool, i.e.
 *  the asset is shared (README.md, openspec/..., CLAUDE.md etc. for assets whose id
 *  doesn't encode a tool prefix). */
export function inferAssetTool(destination: string, assetId?: string): ToolId | undefined {
  const normalized = destination.replaceAll('\\', '/');
  for (const tool of TOOL_DIRECTORY_PREFIXES) {
    const prefix = `.${tool}/`;
    if (normalized.startsWith(prefix) || normalized === `.${tool}`) {
      return tool;
    }
  }
  // Fallback for tool-scoped assets whose destination lives outside any tool directory
  // (e.g. `claude-docs` → CLAUDE.md). The asset id always encodes the tool for these.
  if (assetId) {
    for (const tool of TOOL_DIRECTORY_PREFIXES) {
      if (assetId === tool || assetId.startsWith(`${tool}-`)) {
        return tool;
      }
    }
  }
  return undefined;
}

/** Whether a managed asset is tool-attributable (i.e. lives inside a tool's directory).
 *  Used to decide whether the asset should be tagged with `tool` on write. */
export function isToolAttributableAsset(record: ManagedAssetRecord): boolean {
  if (record.tool) return true;
  return inferAssetTool(record.destination) !== undefined;
}

function normalizeManagedAsset(record: ManagedAssetRecord): ManagedAssetRecord {
  const normalized: ManagedAssetRecord = {
    id: record.id.replaceAll('\\', '/'),
    destination: record.destination.replaceAll('\\', '/'),
  };
  if (record.tool) {
    normalized.tool = record.tool;
  } else {
    const inferred = inferAssetTool(normalized.destination, normalized.id);
    if (inferred) normalized.tool = inferred;
  }
  return normalized;
}

function dedupeTools(tools: ToolId[]): ToolId[] {
  const seen = new Set<ToolId>();
  const result: ToolId[] = [];
  for (const tool of tools) {
    if (seen.has(tool)) continue;
    seen.add(tool);
    result.push(tool);
  }
  return result;
}

function normalizeManifest(manifest: PipelineManifest): PipelineManifest {
  // Prefer the explicit `tools` array as the source of truth (preserves installation
  // order). Fall back to the legacy single `tool` field for v1 manifests.
  const tools = dedupeTools(
    manifest.tools && manifest.tools.length > 0
      ? manifest.tools
      : manifest.tool
        ? [manifest.tool]
        : [],
  );

  const managedAssets = manifest.managedAssets.map(normalizeManagedAsset);

  const normalized: PipelineManifest = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectName: manifest.projectName,
    tools,
    stack: manifest.stack,
    techStack: manifest.techStack,
    language: manifest.language,
    scope: manifest.scope,
    features: manifest.features,
    templateVersion: manifest.templateVersion,
    packageName: manifest.packageName,
    managedAssets,
  };

  if (manifest.tool) {
    normalized.tool = manifest.tool;
  } else if (tools.length === 1 && tools[0]) {
    normalized.tool = tools[0];
  }

  return normalized;
}

function parseManifest(raw: unknown): PipelineManifest {
  return normalizeManifest(manifestSchema.parse(raw));
}

export function getManifestCandidates(dir: string): string[] {
  return [path.join(dir, MANIFEST_FILE), path.join(dir, LEGACY_MANIFEST_FILE)];
}

async function removeStandaloneManifestFiles(dir: string): Promise<void> {
  await Promise.all(
    getManifestCandidates(dir).map(async (filePath) => {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    }),
  );
}

export async function readManifest(dir: string): Promise<ManifestReadResult | null> {
  const packageJsonPath = path.join(dir, PACKAGE_JSON_FILE);
  if (await fs.pathExists(packageJsonPath)) {
    const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>;
    if (pkg[MANIFEST_PACKAGE_JSON_KEY]) {
      return {
        path: packageJsonPath,
        manifest: parseManifest(pkg[MANIFEST_PACKAGE_JSON_KEY]),
        storage: 'package-json',
      };
    }
  }

  for (const filePath of getManifestCandidates(dir)) {
    if (await fs.pathExists(filePath)) {
      const raw = await fs.readJson(filePath);
      return {
        path: filePath,
        manifest: parseManifest(raw),
        storage: 'standalone',
      };
    }
  }

  return null;
}

export async function removeManifest(dir: string, storage: ManifestStorage): Promise<void> {
  if (storage === 'package-json') {
    const packageJsonPath = path.join(dir, PACKAGE_JSON_FILE);
    if (await fs.pathExists(packageJsonPath)) {
      const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>;
      delete pkg[MANIFEST_PACKAGE_JSON_KEY];
      await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    }
  }

  await removeStandaloneManifestFiles(dir);
}

export async function writeManifest(dir: string, manifest: PipelineManifest): Promise<string> {
  const normalizedManifest = normalizeManifest(manifest);
  const packageJsonPath = path.join(dir, PACKAGE_JSON_FILE);
  if (await fs.pathExists(packageJsonPath)) {
    const pkg = (await fs.readJson(packageJsonPath)) as Record<string, unknown>;
    pkg[MANIFEST_PACKAGE_JSON_KEY] = normalizedManifest;
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    await removeStandaloneManifestFiles(dir);
    return packageJsonPath;
  }

  const filePath = path.join(dir, MANIFEST_FILE);
  await fs.writeJson(filePath, normalizedManifest, { spaces: 2 });
  // Set restrictive permissions: owner read/write only (0o600)
  // This prevents other users on shared systems from modifying the manifest
  // which could lead to path traversal or other attacks during uninstall/sync
  try {
    await fs.chmod(filePath, 0o600);
  } catch {
    // Ignore permission errors (e.g., on Windows or read-only filesystems)
  }
  return filePath;
}
