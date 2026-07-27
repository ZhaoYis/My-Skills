import path from 'node:path';
import fs from 'fs-extra';
import { getToolAdapter } from '../adapters/registry.js';
import type { DocLanguage, FeatureId, StackId, ToolId } from '../adapters/types.js';
import { assetManifest } from '../assets/manifest.js';
import type { AssetDefinition, InstallFile } from '../assets/types.js';
import type { ManagedAssetRecord } from '../manifest/types.js';
import {
  PACKAGE_LICENSE,
  PACKAGE_NAME,
  PACKAGE_REPO_URL,
  PACKAGE_VERSION,
  TEMPLATE_VERSION,
} from '../runtime/meta.js';
import { findAssetDefinition, resolveFileWritePolicy } from './fileWritePolicy.js';
import { renderString } from './renderTemplates.js';
import type { InstallPlan } from './types.js';

const ASK_TOOL_MAP: Record<ToolId, string> = {
  claude: 'AskUserQuestion',
  cursor: 'AskQuestion',
  codex: 'AskUserQuestion',
};

export interface BuildInstallPlanInput {
  rootDir: string;
  targetDir: string;
  projectName: string;
  tool: ToolId;
  stack?: StackId;
  language?: DocLanguage;
  features: FeatureId[];
  dryRun: boolean;
  force: boolean;
  mode: 'init' | 'sync' | 'upgrade';
  languageConfigUpdate?: boolean;
  managedAssets?: ManagedAssetRecord[];
  registry: Parameters<typeof getToolAdapter>[0];
}

interface ManagedAssetIndex {
  assetIds: Set<string>;
  topLevelIds: Set<string>;
  bundleIds: Set<string>;
}

interface BundleEntry {
  entry: string;
  relativeDestination: string;
}

export function buildTemplateContext(params: {
  projectName: string;
  toolId: ToolId;
  toolName: string;
  stack: StackId;
  language: DocLanguage;
  features: FeatureId[];
  skillsDir: string;
  commandsDir: string;
  skillRootNote?: string;
}): Record<string, unknown> {
  return {
    projectName: params.projectName,
    toolId: params.toolId,
    toolName: params.toolName,
    stack: params.stack,
    language: params.language,
    packageName: PACKAGE_NAME,
    skillsDir: params.skillsDir,
    commandsDir: params.commandsDir,
    features: params.features,
    templateVersion: TEMPLATE_VERSION,
    packageVersion: PACKAGE_VERSION,
    packageLicense: PACKAGE_LICENSE,
    packageRepoUrl: PACKAGE_REPO_URL,
    skillRootNote: params.skillRootNote?.replaceAll('{skillsDir}', params.skillsDir),
    askTool: ASK_TOOL_MAP[params.toolId],
  };
}

function localizedTemplatePath(sourcePath: string, language: DocLanguage): string {
  return sourcePath.endsWith('.hbs') ? `${sourcePath.slice(0, -4)}.${language}.hbs` : sourcePath;
}

async function resolveTemplateSource(sourcePath: string, language: DocLanguage): Promise<string> {
  if (!sourcePath.endsWith('.hbs')) {
    return sourcePath;
  }

  const localizedPath = localizedTemplatePath(sourcePath, language);
  return (await fs.pathExists(localizedPath)) ? localizedPath : sourcePath;
}

function selectBundleEntries(entries: string[], language: DocLanguage): BundleEntry[] {
  const localizedPattern = /^(.*)\.(en|zh)\.hbs$/;
  const localizedEntries = new Map<string, Map<string, string>>();

  for (const entry of entries) {
    const match = entry.match(localizedPattern);
    if (!match?.[1] || !match[2]) continue;

    const fallbackEntry = `${match[1]}.hbs`;
    const variants = localizedEntries.get(fallbackEntry) ?? new Map<string, string>();
    variants.set(match[2], entry);
    localizedEntries.set(fallbackEntry, variants);
  }

  const selected: BundleEntry[] = [];
  for (const entry of entries) {
    const localizedMatch = entry.match(localizedPattern);
    if (localizedMatch?.[1] && localizedMatch[2]) {
      if (localizedMatch[2] === language) {
        selected.push({ entry, relativeDestination: localizedMatch[1] });
      }
      continue;
    }

    if (localizedEntries.get(entry)?.has(language)) {
      continue;
    }

    selected.push({
      entry,
      relativeDestination: entry.endsWith('.hbs') ? entry.slice(0, -4) : entry,
    });
  }

  return selected;
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
  language: DocLanguage,
): Promise<InstallFile[]> {
  const sourceRoot = path.join(rootDir, asset.source);
  const bundleDestinationRoot = path.join(
    targetDir,
    renderString(asset.destination, templateContext),
  );
  const files = await fs.readdir(sourceRoot, { recursive: true });

  const eligibleEntries = files
    .filter((entry): entry is string => typeof entry === 'string')
    .filter((entry) => !asset.excludePatterns?.some((pattern) => entry.endsWith(pattern)))
    .filter((entry) => !isBundleFileGated(asset, entry, features))
    .filter((entry) => asset.includeExtensions?.includes(path.extname(entry)) ?? true);

  return selectBundleEntries(eligibleEntries, language).map(({ entry, relativeDestination }) => {
    const sourcePath = path.join(sourceRoot, entry);
    const fileName = path.basename(entry);
    return {
      assetId: `${asset.id}:${entry}`,
      sourcePath,
      destinationPath: path.join(bundleDestinationRoot, relativeDestination),
      kind:
        asset.templateFiles?.includes(fileName) || entry.endsWith('.hbs') ? 'template' : 'static',
      exists: false,
      appendStrategy: 'none',
      resolution: 'none',
    } satisfies InstallFile;
  });
}

export async function buildInstallPlan(input: BuildInstallPlanInput): Promise<InstallPlan> {
  const stack = input.stack ?? 'backend';
  const language = input.language ?? 'zh';
  const adapter = getToolAdapter(input.registry, input.tool);
  const templateContext = buildTemplateContext({
    projectName: input.projectName,
    toolId: input.tool,
    toolName: adapter.definition.displayName,
    stack,
    language,
    skillsDir: adapter.getDestination('skills'),
    commandsDir: adapter.getDestination('commands'),
    features: input.features,
    skillRootNote: adapter.getSkillRootNote(),
  });

  const selectedAssets = assetManifest
    .filter(
      (asset) =>
        input.features.includes(asset.feature) ||
        (input.languageConfigUpdate && asset.id === 'stack-config'),
    )
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
        return expandBundle(
          asset,
          input.rootDir,
          input.targetDir,
          templateContext,
          input.features,
          language,
        );
      }

      const renderedSource = path.join(input.rootDir, renderString(asset.source, templateContext));

      return [
        {
          assetId: asset.id,
          sourcePath:
            asset.kind === 'template'
              ? await resolveTemplateSource(renderedSource, language)
              : renderedSource,
          destinationPath: path.join(
            input.targetDir,
            renderString(asset.destination, templateContext),
          ),
          kind: asset.kind,
          exists: false,
          appendStrategy: 'none',
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
        const policy = resolveFileWritePolicy(findAssetDefinition(file.assetId), file, input.mode);

        return {
          ...file,
          exists,
          appendStrategy: policy.appendStrategy,
          resolution: exists
            ? input.force
              ? 'overwrite'
              : policy.onConflict === 'prompt'
                ? 'unresolved'
                : policy.onConflict
            : 'none',
        } satisfies InstallFile;
      }),
  );

  return {
    projectName: input.projectName,
    tool: input.tool,
    stack,
    language,
    features: input.features,
    adapter,
    files,
    targetDir: input.targetDir,
    dryRun: input.dryRun,
    force: input.force,
    mode: input.mode,
  };
}
