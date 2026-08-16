import { stringify as stringifyYaml } from 'yaml';
import {
  buildEffectiveConfig,
  formatSourcesExplanation,
  writeEffectiveConfigAtomic,
} from '../../core/config/index.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export interface ConfigEffectiveOptions {
  dir: string;
  format: 'yaml' | 'json';
  explain?: boolean;
}

export async function runConfigEffectiveCommand(options: ConfigEffectiveOptions): Promise<void> {
  const packageRoot = await resolvePackageRoot(import.meta.url);
  const { config, sources } = await buildEffectiveConfig(options.dir, packageRoot);
  await writeEffectiveConfigAtomic(options.dir, config);
  console.log(options.format === 'json' ? JSON.stringify(config, null, 2) : stringifyYaml(config));
  if (options.explain) console.log(`\n${formatSourcesExplanation(sources)}`);
}
