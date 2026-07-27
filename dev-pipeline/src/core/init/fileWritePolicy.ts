import path from 'node:path';
import { assetManifest } from '../assets/manifest.js';
import type {
  AssetDefinition,
  InstallFile,
  InstallMode,
  ResolvedFileWritePolicy,
} from '../assets/types.js';

type PolicyFile = Pick<InstallFile, 'kind' | 'destinationPath'>;

function matchesAppendSelector(asset: AssetDefinition, file: PolicyFile): boolean {
  const policy = asset.writePolicy;
  const hasSelectors = Boolean(policy?.appendBasenames || policy?.appendExtensions);
  if (!hasSelectors) {
    return true;
  }

  const basename = path.basename(file.destinationPath);
  return Boolean(
    policy?.appendBasenames?.includes(basename) ||
      policy?.appendExtensions?.includes(path.extname(file.destinationPath)),
  );
}

export function findAssetDefinition(assetId: string): AssetDefinition | undefined {
  const parentAssetId = assetId.split(':', 1)[0] ?? assetId;
  return assetManifest.find((asset) => asset.id === parentAssetId);
}

export function resolveFileWritePolicy(
  asset: AssetDefinition | undefined,
  file: PolicyFile,
  mode: InstallMode,
): ResolvedFileWritePolicy {
  const canAppend =
    file.kind === 'template' &&
    asset?.writePolicy?.appendStrategy !== undefined &&
    matchesAppendSelector(asset, file);

  return {
    appendStrategy: canAppend ? (asset.writePolicy?.appendStrategy ?? 'none') : 'none',
    onConflict: asset?.writePolicy?.onConflict?.[mode] ?? 'prompt',
  };
}
