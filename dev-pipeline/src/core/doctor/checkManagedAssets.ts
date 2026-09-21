import fs from 'node:fs';
import path from 'node:path';
import type { PipelineManifest } from '../manifest/types.js';
import type { ManagedAssetHealthResult, StackIssue } from './types.js';

/** Identifier for the check that emits `checkId` on issues it raises. */
export const CHECK_MANAGED_ASSETS_ID = 'managed-assets';

/**
 * Verify that every entry in `manifest.managedAssets` still resolves to a file on
 * disk that the CLI can read.
 *
 * Failure modes:
 *  - missing: `fs.existsSync` returns false → emit `error` "managed asset missing: …"
 *  - unreadable: `fs.readFileSync` throws (e.g. permission denied) → emit `error`
 *    "managed asset unreadable: …"
 *
 * We intentionally skip content hashing here: introducing a `fingerprint` field in
 * the manifest schema is out of scope for this check.
 */
export async function checkManagedAssets(
  targetDir: string,
  manifest: PipelineManifest,
): Promise<ManagedAssetHealthResult> {
  const issues: StackIssue[] = [];

  for (const asset of manifest.managedAssets) {
    const absPath = path.isAbsolute(asset.destination)
      ? asset.destination
      : path.join(targetDir, asset.destination);

    if (!fs.existsSync(absPath)) {
      issues.push({
        checkId: CHECK_MANAGED_ASSETS_ID,
        path: `managedAssets[${asset.id}].destination`,
        severity: 'error',
        message: `managed asset missing: ${asset.destination}`,
      });
      continue;
    }

    try {
      fs.readFileSync(absPath);
    } catch {
      issues.push({
        checkId: CHECK_MANAGED_ASSETS_ID,
        path: `managedAssets[${asset.id}].destination`,
        severity: 'error',
        message: `managed asset unreadable: ${asset.destination}`,
      });
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
