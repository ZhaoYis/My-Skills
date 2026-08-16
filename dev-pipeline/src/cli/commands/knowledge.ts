import { join } from 'node:path';
import { buildEffectiveConfig, writeEffectiveConfigAtomic } from '../../core/config/index.js';
import {
  formatKnowledgeSelectResult,
  loadReferenceMetadata,
  selectKnowledge,
} from '../../core/knowledge/index.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export interface KnowledgeSelectCommandOptions {
  phase: number;
  dir: string;
  routes?: string[];
  paths?: string[];
  format: 'yaml' | 'json';
}

export async function runKnowledgeSelectCommand(
  options: KnowledgeSelectCommandOptions,
): Promise<void> {
  const packageRoot = await resolvePackageRoot(import.meta.url);
  const { config } = await buildEffectiveConfig(options.dir, packageRoot);
  await writeEffectiveConfigAtomic(options.dir, config);
  const referencesDir = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
  );
  const result = selectKnowledge(await loadReferenceMetadata(referencesDir), {
    phase: options.phase,
    routes: options.routes,
    paths: options.paths,
    assetKindRank: config.knowledge?.asset_kind_rank,
  });
  console.log(
    options.format === 'json' ? JSON.stringify(result, null, 2) : formatKnowledgeSelectResult(result),
  );
}
