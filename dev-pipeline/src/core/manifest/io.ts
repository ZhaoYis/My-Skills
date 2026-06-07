import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import { LEGACY_MANIFEST_FILE, MANIFEST_FILE, PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import type { PipelineManifest } from './types.js';

const manifestSchema = z.object({
  schemaVersion: z.number().default(1),
  projectName: z.string(),
  tool: z.enum(['claude', 'cursor', 'codex', 'generic']),
  features: z.array(z.enum(['base', 'skills', 'commands', 'docs'])),
  templateVersion: z.string().default(TEMPLATE_VERSION),
  packageName: z.string().default(PACKAGE_NAME),
  managedAssets: z.array(z.object({
    id: z.string(),
    destination: z.string()
  })).default([])
});

export function getManifestCandidates(dir: string): string[] {
  return [path.join(dir, MANIFEST_FILE), path.join(dir, LEGACY_MANIFEST_FILE)];
}

export async function readManifest(dir: string): Promise<{ path: string; manifest: PipelineManifest } | null> {
  for (const filePath of getManifestCandidates(dir)) {
    if (await fs.pathExists(filePath)) {
      const raw = await fs.readJson(filePath);
      return { path: filePath, manifest: manifestSchema.parse(raw) };
    }
  }

  return null;
}

export async function writeManifest(dir: string, manifest: PipelineManifest): Promise<string> {
  const filePath = path.join(dir, MANIFEST_FILE);
  await fs.writeJson(filePath, manifest, { spaces: 2 });
  return filePath;
}
