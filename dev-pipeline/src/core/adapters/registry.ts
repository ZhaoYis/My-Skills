import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import type { FeatureId, ToolAdapter, ToolDefinition, ToolId } from './types.js';

const toolSchema = z.object({
  id: z.enum(['claude', 'cursor', 'codex', 'generic']),
  displayName: z.string(),
  description: z.string(),
  markers: z.array(z.string()),
  destinations: z.object({
    root: z.string(),
    skills: z.string(),
    commands: z.string()
  }),
  supports: z.array(z.enum(['base', 'skills', 'commands', 'docs'])),
  postInstallNotes: z.array(z.string()).optional()
});

const toolsSchema = z.object({
  tools: z.array(toolSchema)
});

class StaticToolAdapter implements ToolAdapter {
  constructor(public definition: ToolDefinition) {}

  detectFiles(): string[] {
    return this.definition.markers;
  }

  supports(feature: FeatureId): boolean {
    return this.definition.supports.includes(feature);
  }

  getDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): string {
    return this.definition.destinations[feature];
  }

  getRoot(): string {
    return this.definition.destinations.root;
  }

  getPostInstallNotes(): string[] {
    return this.definition.postInstallNotes ?? [`Review installed assets for ${this.definition.displayName}.`];
  }
}

export async function loadToolRegistry(rootDir: string): Promise<Map<ToolId, ToolAdapter>> {
  const filePath = path.join(rootDir, 'config', 'tools.json');
  const raw = await fs.readJson(filePath);
  const parsed = toolsSchema.parse(raw);

  return new Map(parsed.tools.map((tool) => [tool.id, new StaticToolAdapter(tool)]));
}

export function getToolAdapter(registry: Map<ToolId, ToolAdapter>, toolId: ToolId): ToolAdapter {
  const adapter = registry.get(toolId);

  if (!adapter) {
    throw new Error(`Unsupported tool: ${toolId}`);
  }

  return adapter;
}
