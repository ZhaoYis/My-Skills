/**
 * load 命令
 * 动态加载指定 Phase 的执行指引 Bundle
 */

import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import {
  loadPhaseBundle,
  formatPhaseBundleMarkdown,
  formatPhaseBundleJson,
} from '../../core/bundle/index.js';
import { fileURLToPath } from 'node:url';

export interface LoadOptions {
  phase: number;
  dir: string;
  route?: string;
  paths?: string[];
  format: 'markdown' | 'json';
}

export async function runLoadCommand(options: LoadOptions): Promise<void> {
  const packageRoot = await resolvePackageRoot(fileURLToPath(import.meta.url));

  const bundle = await loadPhaseBundle({
    phase: options.phase,
    projectRoot: options.dir,
    packageRoot,
    route: options.route,
    paths: options.paths,
  });

  if (options.format === 'json') {
    console.log(formatPhaseBundleJson(bundle));
  } else {
    console.log(formatPhaseBundleMarkdown(bundle));
  }
}
