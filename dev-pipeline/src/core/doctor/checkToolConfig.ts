import {
  ALL_FEATURE_IDS,
  type FeatureId,
  type InstallScope,
  type StackId,
  type ToolId,
} from '../adapters/types.js';
import type { PipelineManifest } from '../manifest/types.js';
import type { StackIssue, ToolConfigHealthResult } from './types.js';

/** Identifier for the check that emits `checkId` on issues it raises. */
export const CHECK_TOOL_CONFIG_ID = 'tool-config';

const VALID_TOOL_IDS: readonly ToolId[] = ['claude', 'cursor', 'codex', 'opencode'];
const VALID_STACK_IDS: readonly StackId[] = ['frontend', 'backend', 'fullstack'];
const VALID_SCOPES: readonly InstallScope[] = ['project', 'user'];
const VALID_FEATURE_SET: ReadonlySet<FeatureId> = new Set(ALL_FEATURE_IDS);

/**
 * Validate the enum-like identifiers that show up in a manifest:
 *  - `tools[]` entries must be known ToolIds.
 *  - `features[]` entries must be known FeatureIds.
 *  - `stack` (when set) must be a known StackId.
 *  - `scope` (when set) must be a known InstallScope.
 *
 * Unknown identifiers corrupt downstream selection logic (e.g. resolving a tool
 * adapter or feature template). Anything unrecognized is reported as an `error`
 * so the user gets a clear signal before `sync` / `upgrade` try to use it.
 */
export async function checkToolConfig(manifest: PipelineManifest): Promise<ToolConfigHealthResult> {
  const issues: StackIssue[] = [];

  for (const tool of manifest.tools) {
    if (!VALID_TOOL_IDS.includes(tool)) {
      issues.push({
        checkId: CHECK_TOOL_CONFIG_ID,
        path: `tools[${tool}]`,
        severity: 'error',
        message: `unknown tool: ${tool}`,
      });
    }
  }

  for (const feature of manifest.features) {
    if (!VALID_FEATURE_SET.has(feature as FeatureId)) {
      issues.push({
        checkId: CHECK_TOOL_CONFIG_ID,
        path: `features[${feature}]`,
        severity: 'error',
        message: `unknown feature: ${feature}`,
      });
    }
  }

  if (manifest.stack !== undefined && !VALID_STACK_IDS.includes(manifest.stack)) {
    issues.push({
      checkId: CHECK_TOOL_CONFIG_ID,
      path: 'stack',
      severity: 'error',
      message: `unknown stack: ${manifest.stack}`,
    });
  }

  if (manifest.scope !== undefined && !VALID_SCOPES.includes(manifest.scope)) {
    issues.push({
      checkId: CHECK_TOOL_CONFIG_ID,
      path: 'scope',
      severity: 'error',
      message: `unknown scope: ${manifest.scope}`,
    });
  }

  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
  };
}
