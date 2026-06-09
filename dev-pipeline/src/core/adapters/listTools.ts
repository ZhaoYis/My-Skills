import type { ToolDefinition } from './types.js';
import { PACKAGE_VERSION } from '../runtime/meta.js';

export interface ToolsListPayload {
  packageVersion: string;
  tools: ToolDefinition[];
}

export function buildToolsListPayload(tools: ToolDefinition[]): ToolsListPayload {
  return {
    packageVersion: PACKAGE_VERSION,
    tools: tools.map((tool) => ({ ...tool }))
  };
}
