import path from 'node:path';
import fs from 'fs-extra';
import { z } from 'zod';
import {
  LEGACY_MANIFEST_FILE,
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_JSON_FILE,
  PACKAGE_NAME,
  TEMPLATE_VERSION,
} from '../runtime/meta.js';
import type { PipelineManifest } from './types.js';

const manifestSchema = z.object({
  schemaVersion: z.number().default(1),
  projectName: z.string(),
  tool: z.enum(['claude', 'cursor', 'codex']),
  stack: z.enum(['frontend', 'backend', 'fullstack']).optional(),
  techStack: z.string().optional(),
  language: z.enum(['en', 'zh']).optional(),
  scope: z.enum(['user', 'project']).optional(),
  features: z.array(z.enum(['base', 'skills', 'commands', 'docs', 'schema'])),
  templateVersion: z.string().default(TEMPLATE_VERSION),
  packageName: z.string().default(PACKAGE_NAME),
  managedAssets: z
    .array(
      z.object({
        id: z.string(),
        destination: z.string(),
      }),
    )
    .default([]),
});

export type ManifestStorage = 'package-json' | 'standalone';

export interface ManifestReadResult {
  path: string;
  manifest: PipelineManifest;
  storage: ManifestStorage;
}

function normalizeManifest(manifest: PipelineManifest): PipelineManifest {
  return {
    ...manifest,
    managedAssets: manifest.managedAssets.map((asset) => ({
      id: asset.id.replaceAll('\\', '/'),
      destination: asset.destination.replaceAll('\\', '/'),
    })),
  };
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
