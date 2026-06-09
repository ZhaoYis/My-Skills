import { buildToolsListPayload } from '../../core/adapters/listTools.js';
import { loadToolRegistry } from '../../core/adapters/registry.js';
import { resolvePackageRoot } from '../../core/runtime/resolvePackageRoot.js';

export interface ListToolsCommandOptions {
  json?: boolean;
}

export async function runListToolsCommand(options: ListToolsCommandOptions = {}): Promise<void> {
  const rootDir = await resolvePackageRoot(import.meta.url);
  const registry = await loadToolRegistry(rootDir);
  const tools = Array.from(registry.values()).map((adapter) => adapter.definition);

  if (options.json) {
    console.log(JSON.stringify(buildToolsListPayload(tools), null, 2));
    return;
  }

  for (const adapter of registry.values()) {
    console.log(`${adapter.definition.id}: ${adapter.definition.displayName}`);
    console.log(`  ${adapter.definition.description}`);
  }
}
