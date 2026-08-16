/**
 * knowledge select 命令
 * 根据 Phase、Route、Paths 选择 Knowledge
 */

import { join } from 'node:path';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';
import {
  loadReferenceMetadata,
  selectKnowledge,
  formatKnowledgeSelectResult,
} from '../../core/knowledge/index.js';
import { fileURLToPath } from 'node:url';

export interface KnowledgeSelectCommandOptions {
  phase: number;
  routes?: string[];
  paths?: string[];
  format: 'yaml' | 'json';
}

export async function runKnowledgeSelectCommand(
  options: KnowledgeSelectCommandOptions,
): Promise<void> {
  const packageRoot = await resolvePackageRoot(fileURLToPath(import.meta.url));
  const referencesDir = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
  );

  const metadata = await loadReferenceMetadata(referencesDir);
  const result = selectKnowledge(metadata, {
    phase: options.phase,
    routes: options.routes,
    paths: options.paths,
  });

  if (options.format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatKnowledgeSelectResult(result));
  }
}
