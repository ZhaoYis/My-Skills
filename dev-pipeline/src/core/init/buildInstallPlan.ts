import fs from 'fs-extra';
import path from 'node:path';
import { getToolAdapter } from '../adapters/registry.js';
import type { FeatureId, StackId, ToolId } from '../adapters/types.js';
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
  stack?: StackId;
  features: FeatureId[];
  dryRun: boolean;
  force: boolean;
  mode: 'init' | 'sync' | 'upgrade';
  managedAssets?: ManagedAssetRecord[];
  registry: Parameters<typeof getToolAdapter>[0];
}

interface ManagedAssetIndex {
  assetIds: Set<string>;
  topLevelIds: Set<string>;
  bundleIds: Set<string>;
}

function indexManagedAssets(managedAssets: ManagedAssetRecord[] | undefined): ManagedAssetIndex {
  const assetIds = new Set(managedAssets?.map((asset) => asset.id) ?? []);
  const topLevelIds = new Set<string>();
  const bundleIds = new Set<string>();

  for (const id of assetIds) {
    if (id.includes(':')) {
      bundleIds.add(id.split(':')[0] ?? id);
    } else {
      topLevelIds.add(id);
    }
  }

  return { assetIds, topLevelIds, bundleIds };
}

function isBundleFileGated(asset: AssetDefinition, entry: string, features: FeatureId[]): boolean {
  return (
    asset.bundleGatedFiles?.some(
      (gate) => gate.path === entry && !features.includes(gate.feature),
    ) ?? false
  );
}

function isAssetInUpgradeScope(asset: AssetDefinition, managed: ManagedAssetIndex): boolean {
  if (managed.topLevelIds.has(asset.id) || managed.bundleIds.has(asset.id)) {
    return true;
  }

  return true;
}

function shouldIncludeInstallFile(
  file: InstallFile,
  mode: BuildInstallPlanInput['mode'],
  managed: ManagedAssetIndex,
  upgradeAssetIds: Set<string>,
): boolean {
  if (mode === 'init') {
    return true;
  }

  if (managed.assetIds.has(file.assetId)) {
    return true;
  }

  const bundleParent = file.assetId.includes(':')
    ? (file.assetId.split(':')[0] ?? file.assetId)
    : file.assetId;

  if (managed.bundleIds.has(bundleParent)) {
    return true;
  }

  if (mode === 'upgrade') {
    return upgradeAssetIds.has(bundleParent);
  }

  return managed.topLevelIds.has(file.assetId);
}

async function expandBundle(
  asset: AssetDefinition,
  rootDir: string,
  targetDir: string,
  templateContext: Record<string, unknown>,
  features: FeatureId[],
): Promise<InstallFile[]> {
  const sourceRoot = path.join(rootDir, asset.source);
  const bundleDestinationRoot = path.join(
    targetDir,
    renderString(asset.destination, templateContext),
  );
  const files = await fs.readdir(sourceRoot, { recursive: true });

  return files
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => !asset.excludePatterns?.some((pattern) => entry.endsWith(pattern)))
    .filter((entry) => !isBundleFileGated(asset, entry, features))
    .filter((entry) => asset.includeExtensions?.includes(path.extname(entry)) ?? true)
    .map((entry) => {
      const sourcePath = path.join(sourceRoot, entry);
      const fileName = path.basename(entry);
      const relativeDestination = entry.endsWith('.hbs') ? entry.slice(0, -4) : entry;
      return {
        assetId: `${asset.id}:${entry}`,
        sourcePath,
        destinationPath: path.join(bundleDestinationRoot, relativeDestination),
        kind:
          asset.templateFiles?.includes(fileName) || entry.endsWith('.hbs') ? 'template' : 'static',
        exists: false,
        appendable: false,
        resolution: 'none',
      } satisfies InstallFile;
    });
}

export async function buildInstallPlan(input: BuildInstallPlanInput): Promise<InstallPlan> {
  const stack = input.stack ?? 'backend';
  const adapter = getToolAdapter(input.registry, input.tool);
  const templateContext = {
    projectName: input.projectName,
    toolId: input.tool,
    toolName: adapter.definition.displayName,
    stack,
    packageName: PACKAGE_NAME,
    skillsDir: adapter.getDestination('skills'),
    commandsDir: adapter.getDestination('commands'),
    features: input.features,
    templateVersion: TEMPLATE_VERSION,
  };

  const selectedAssets = assetManifest
    .filter((asset) => input.features.includes(asset.feature))
    .filter((asset) => !asset.stacks || asset.stacks.includes(stack))
    .filter((asset) => !asset.tools || asset.tools.includes(input.tool));

  const managed = indexManagedAssets(input.managedAssets);

  const upgradeAssetIds = new Set(
    input.mode === 'upgrade'
      ? selectedAssets
          .filter((asset) => isAssetInUpgradeScope(asset, managed))
          .map((asset) => asset.id)
      : [],
  );

  const expandedFiles = await Promise.all(
    selectedAssets.map(async (asset) => {
      if (asset.kind === 'bundle') {
        return expandBundle(asset, input.rootDir, input.targetDir, templateContext, input.features);
      }

      return [
        {
          assetId: asset.id,
          sourcePath: path.join(input.rootDir, renderString(asset.source, templateContext)),
          destinationPath: path.join(
            input.targetDir,
            renderString(asset.destination, templateContext),
          ),
          kind: asset.kind,
          exists: false,
          appendable: false,
          resolution: 'none',
        } satisfies InstallFile,
      ];
    }),
  );

  const files = await Promise.all(
    expandedFiles
      .flat()
      .filter((file) => shouldIncludeInstallFile(file, input.mode, managed, upgradeAssetIds))
      .map(async (file) => {
        const exists = await fs.pathExists(file.destinationPath);
        const appendable = isAppendableInstallFile(file);

        return {
          ...file,
          exists,
          appendable,
          resolution: exists ? (input.force ? 'overwrite' : 'unresolved') : 'none',
        } satisfies InstallFile;
      }),
  );

  return {
    projectName: input.projectName,
    tool: input.tool,
    stack,
    features: input.features,
    adapter,
    files,
    targetDir: input.targetDir,
    dryRun: input.dryRun,
    force: input.force,
    mode: input.mode,
  };
}
