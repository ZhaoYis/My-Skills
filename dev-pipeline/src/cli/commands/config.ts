/**
 * config effective 命令
 * 显示合成的有效配置及其来源
 */

import { stringify as stringifyYaml } from 'yaml';
import { buildEffectiveConfig, formatSourcesExplanation } from '../../core/config/index.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import { fileURLToPath } from 'node:url';

export interface ConfigEffectiveOptions {
  dir: string;
  format: 'yaml' | 'json';
  explain?: boolean;
}

export async function runConfigEffectiveCommand(options: ConfigEffectiveOptions): Promise<void> {
  const packageRoot = await resolvePackageRoot(fileURLToPath(import.meta.url));
  const { config, sources } = await buildEffectiveConfig(options.dir, packageRoot);

  if (options.format === 'json') {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(stringifyYaml(config));
  }

  if (options.explain) {
    console.log('\n' + formatSourcesExplanation(sources));
  }
}
