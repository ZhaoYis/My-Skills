import { loadToolRegistry } from '../../core/adapters/registry.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export async function runListToolsCommand(): Promise<void> {
  const rootDir = await resolvePackageRoot(import.meta.url);
  const registry = await loadToolRegistry(rootDir);

  for (const adapter of registry.values()) {
    console.log(`${adapter.definition.id}: ${adapter.definition.displayName}`);
    console.log(`  ${adapter.definition.description}`);
  }
}
