import fs from 'fs-extra';
import path from 'node:path';
import { getToolAdapter } from '../adapters/registry.js';
import type { FeatureId, ToolId } from '../adapters/types.js';
import { assetManifest } from '../assets/manifest.js';
import type { AssetDefinition, InstallFile } from '../assets/types.js';
import { PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import type { ManagedAssetRecord } from '../manifest/types.js';
import { renderString } from './renderTemplates.js';
import { isAppendableInstallFile } from './isAppendableInstallFile.js';
import type { InstallPlan } from './types.js';

export interface BuildInstallPlanInput {
  rootDir: string;
  targetDir: string;
  projectName: string;
  tool: ToolId;
  features: FeatureId[];
  dryRun: boolean;
  force: boolean;
  mode: 'init' | 'sync' | 'upgrade';
  managedAssets?: ManagedAssetRecord[];
  allowUpgradeAdoption?: boolean;
  registry: Parameters<typeof getToolAdapter>[0];
}

async function expandBundle(
  asset: AssetDefinition,
  rootDir: string,
  targetDir: string,
  templateContext: Record<string, unknown>
): Promise<InstallFile[]> {
  const sourceRoot = path.join(rootDir, asset.source);
  const bundleDestinationRoot = path.join(targetDir, renderString(asset.destination, templateContext));
  const files = await fs.readdir(sourceRoot, { recursive: true });

  return files
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => !asset.excludePatterns?.some((pattern) => entry.endsWith(pattern)))
    .filter((entry) => asset.includeExtensions?.includes(path.extname(entry)) ?? true)
    .map((entry) => {
      const sourcePath = path.join(sourceRoot, entry);
      const fileName = path.basename(entry);
      const relativeDestination = entry.endsWith('.hbs') ? entry.slice(0, -4) : entry;
      return {
        assetId: `${asset.id}:${entry}`,
        sourcePath,
        destinationPath: path.join(bundleDestinationRoot, relativeDestination),
        kind: asset.templateFiles?.includes(fileName) || entry.endsWith('.hbs') ? 'template' : 'static',
        exists: false,
        appendable: false,
        resolution: 'none'
      } satisfies InstallFile;
    });
}

export async function buildInstallPlan(input: BuildInstallPlanInput): Promise<InstallPlan> {
  const adapter = getToolAdapter(input.registry, input.tool);
  const templateContext = {
    projectName: input.projectName,
    toolId: input.tool,
    toolName: adapter.definition.displayName,
    packageName: PACKAGE_NAME,
    skillsDir: adapter.getDestination('skills'),
    commandsDir: adapter.getDestination('commands'),
    features: input.features,
    templateVersion: TEMPLATE_VERSION
  };

  const selectedAssets = assetManifest
    .filter((asset) => input.features.includes(asset.feature))
    .filter((asset) => !asset.tools || asset.tools.includes(input.tool));

  const managedAssetIds = input.managedAssets
    ? new Set(input.managedAssets.map((asset) => asset.id))
    : undefined;

  const expandedFiles = await Promise.all(
    selectedAssets.map(async (asset) => {
      if (asset.kind === 'bundle') {
        return expandBundle(asset, input.rootDir, input.targetDir, templateContext);
      }

      return [{
        assetId: asset.id,
        sourcePath: path.join(input.rootDir, asset.source),
        destinationPath: path.join(input.targetDir, renderString(asset.destination, templateContext)),
        kind: asset.kind,
        exists: false,
        appendable: false,
        resolution: 'none'
      } satisfies InstallFile];
    })
  );

  const selectedAssetIds = new Set(
    selectedAssets
      .filter((asset) => input.mode !== 'upgrade' || (input.allowUpgradeAdoption && asset.adoptOnUpgrade) || managedAssetIds?.has(asset.id))
      .map((asset) => asset.id)
  );

  const files = await Promise.all(
    expandedFiles
      .flat()
      .filter((file) => {
        if (input.mode === 'init') {
          return true;
        }

        if (managedAssetIds?.has(file.assetId)) {
          return true;
        }

        if (input.mode === 'upgrade' && input.allowUpgradeAdoption) {
          const assetId = file.assetId.split(':')[0] ?? file.assetId;
          return selectedAssetIds.has(assetId);
        }

        return false;
      })
      .map(async (file) => {
        const exists = await fs.pathExists(file.destinationPath);
        const appendable = isAppendableInstallFile(file);
        const isManaged = managedAssetIds?.has(file.assetId) ?? false;
        const allowAdoption = input.mode === 'upgrade' && input.allowUpgradeAdoption && !isManaged;

        if (exists && allowAdoption) {
          return {
            ...file,
            exists,
            appendable,
            resolution: 'skip'
          } satisfies InstallFile;
        }

        return {
          ...file,
          exists,
          appendable,
          resolution: exists
            ? (input.force ? 'overwrite' : 'unresolved')
            : 'none'
        } satisfies InstallFile;
      })
  );

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
