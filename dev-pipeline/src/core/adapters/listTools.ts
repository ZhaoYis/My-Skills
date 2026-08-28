import { PACKAGE_VERSION } from '../runtime/meta.js';
import type { ToolDefinition } from './types.js';

export interface ToolsListPayload {
  packageVersion: string;
  tools: ToolDefinition[];
}

export function buildToolsListPayload(tools: ToolDefinition[]): ToolsListPayload {
  return {
    packageVersion: PACKAGE_VERSION,
    tools: tools.map((tool) => ({ ...tool })),
  };
}
