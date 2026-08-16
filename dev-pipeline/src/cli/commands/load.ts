import {
  formatPhaseBundleJson,
  formatPhaseBundleMarkdown,
  loadPhaseBundle,
} from '../../core/bundle/index.js';
import { buildEffectiveConfig, writeEffectiveConfigAtomic } from '../../core/config/index.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export interface LoadOptions {
  phase: number;
  dir: string;
  route?: string;
  change?: string;
  paths?: string[];
  format: 'markdown' | 'json';
}

export async function runLoadCommand(options: LoadOptions): Promise<void> {
  const packageRoot = await resolvePackageRoot(import.meta.url);
  const { config } = await buildEffectiveConfig(options.dir, packageRoot);
  await writeEffectiveConfigAtomic(options.dir, config);
  const bundle = await loadPhaseBundle({
    phase: options.phase,
    projectRoot: options.dir,
    packageRoot,
    route: options.route,
    change: options.change,
    paths: options.paths,
    effectiveConfig: config,
  });
  console.log(
    options.format === 'json' ? formatPhaseBundleJson(bundle) : formatPhaseBundleMarkdown(bundle),
  );
}
