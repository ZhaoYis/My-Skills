import path from 'node:path';
import type { PipelineManifest } from '../manifest/types.js';
import type { PathEscapeHealthResult, StackIssue } from './types.js';

/** Identifier for the check that emits `checkId` on issues it raises. */
export const CHECK_PATH_ESCAPES_ID = 'path-escapes';

/**
 * Detect managed asset destinations that would escape the project root. This is a
 * guard against manifests with `..` traversal or absolute paths that happen to
 * point outside `targetDir`.
 *
 * Rules:
 *  - For user-scope assets whose destination is already absolute (host-level
 *    config such as `~/.claude/`), the check is skipped because those paths
 *    intentionally live outside the project root.
 *  - Every other destination is resolved against `targetDir`. If
 *    `path.relative(targetDir, abs)` starts with `..` (or returns an absolute
 *    path on Windows when the drive differs), the asset escapes the project
 *    root and we emit an `error`.
 */
export async function checkPathEscapes(
  targetDir: string,
  manifest: PipelineManifest,
): Promise<PathEscapeHealthResult> {
  const issues: StackIssue[] = [];

  for (const asset of manifest.managedAssets) {
    const isAbsolute = path.isAbsolute(asset.destination);

    if (manifest.scope === 'user' && isAbsolute) {
      // User-scope assets with absolute destinations live outside the project
      // root by design; nothing to check here.
      continue;
    }

    const absPath = isAbsolute
      ? path.normalize(asset.destination)
      : path.resolve(targetDir, asset.destination);

    const rel = path.relative(targetDir, absPath);

    const escapes = rel === '..' || rel.startsWith(`..${path.sep}`) || rel.startsWith('../');

    if (escapes || path.isAbsolute(rel)) {
      issues.push({
        checkId: CHECK_PATH_ESCAPES_ID,
        path: `managedAssets[${asset.id}].destination`,
        severity: 'error',
        message: `managed asset escapes project root: ${asset.destination}`,
      });
    }
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
