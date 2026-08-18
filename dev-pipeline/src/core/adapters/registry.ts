import os from 'node:os';
import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import type { FeatureId, InstallScope, ToolAdapter, ToolDefinition, ToolId } from './types.js';

// Tool adapter schema. To add a new AI tool:
// 1. Add its id to the id enum below
// 2. Add its definition to config/tools.json (id, displayName, description, markers, destinations, supports)
// 3. Create overlay templates under templates/tools/<tool-id>/overlay/
// See config/tools.json for the current set of supported tools.
const toolSchema = z.object({
  id: z.enum(['claude', 'cursor', 'codex', 'opencode']),
  displayName: z.string(),
  description: z.string(),
  markers: z.array(z.string()),
  destinations: z.object({
    root: z.string(),
    skills: z.string(),
    commands: z.string(),
  }),
  userDestinations: z
    .object({
      skills: z.string().optional(),
      commands: z.string().optional(),
    })
    .optional(),
  supports: z.array(z.enum(['base', 'skills', 'commands', 'docs', 'schema'])),
  skillRootNote: z.string().optional(),
});

const toolsSchema = z.object({
  tools: z.array(toolSchema),
});

class StaticToolAdapter implements ToolAdapter {
  constructor(public definition: ToolDefinition) {}

  detectFiles(): string[] {
    return this.definition.markers;
  }

  supports(feature: FeatureId): boolean {
    return this.definition.supports.includes(feature);
  }

  getDestination(
    feature: Extract<FeatureId, 'skills' | 'commands'>,
    scope: InstallScope = 'project',
  ): string {
    if (scope === 'user') {
      return path.join(os.homedir(), this.definition.userDestinations?.[feature] ?? '');
    }
    return this.definition.destinations[feature];
  }

  supportsUserDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): boolean {
    return this.definition.userDestinations?.[feature] !== undefined;
  }

  getRoot(): string {
    return this.definition.destinations.root;
  }

  getSkillRootNote(): string | undefined {
    return this.definition.skillRootNote;
  }
}

export async function loadToolRegistry(rootDir: string): Promise<Map<ToolId, ToolAdapter>> {
  const filePath = path.join(rootDir, 'src', 'config', 'tools.json');
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
