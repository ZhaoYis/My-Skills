import path from 'node:path';
import { getToolAdapter } from '../adapters/registry.js';
import type { FeatureId, ToolId } from '../adapters/types.js';
import { assetManifest } from '../assets/manifest.js';
import type { InstallFile } from '../assets/types.js';
import { MANIFEST_FILE, PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import { renderString } from './renderTemplates.js';
import type { InstallPlan } from './types.js';

export interface BuildInstallPlanInput {
  rootDir: string;
  targetDir: string;
  projectName: string;
  tool: ToolId;
  features: FeatureId[];
  dryRun: boolean;
  force: boolean;
  registry: Parameters<typeof getToolAdapter>[0];
}

export function buildInstallPlan(input: BuildInstallPlanInput): InstallPlan {
  const adapter = getToolAdapter(input.registry, input.tool);
  const templateContext = {
    projectName: input.projectName,
    toolId: input.tool,
    toolName: adapter.definition.displayName,
    packageName: PACKAGE_NAME,
    manifestFile: MANIFEST_FILE,
    skillsDir: adapter.getDestination('skills'),
    commandsDir: adapter.getDestination('commands'),
    features: input.features,
    templateVersion: TEMPLATE_VERSION
  };

  const files: InstallFile[] = assetManifest
    .filter((asset) => input.features.includes(asset.feature))
    .filter((asset) => !asset.tools || asset.tools.includes(input.tool))
    .map((asset) => ({
      assetId: asset.id,
      sourcePath: path.join(input.rootDir, asset.source),
      destinationPath: path.join(input.targetDir, renderString(asset.destination, templateContext)),
      kind: asset.kind
    }));

  return {
    projectName: input.projectName,
    tool: input.tool,
    features: input.features,
    adapter,
    files,
    targetDir: input.targetDir,
    dryRun: input.dryRun,
    force: input.force
  };
}
