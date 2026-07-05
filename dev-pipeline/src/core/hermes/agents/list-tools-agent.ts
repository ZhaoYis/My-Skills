import { buildToolsListPayload } from '../../adapters/listTools.js';
import { loadToolRegistry } from '../../adapters/registry.js';
import { resolvePackageRoot } from '../../runtime/resolvePackageRoot.js';
import type { AgentContext, AgentResult } from './types.js';

export const listToolsAgentHandler = async (
  ctx: AgentContext,
): Promise<AgentResult> => {
  let tokensUsed = 0;
  let toolCalls = 0;

  try {
    const rootDir = await resolvePackageRoot(import.meta.url);
    const registry = await loadToolRegistry(rootDir);
    toolCalls += 2;

    const tools = Array.from(registry.values()).map(
      (adapter) => adapter.definition,
    );

    const json = Boolean(ctx.options.json);
    const payload = json ? buildToolsListPayload(tools) : null;

    return {
      success: true,
      output: {
        tools: json
          ? payload
          : tools.map((t) => ({
              id: t.id,
              displayName: t.displayName,
              description: t.description,
            })),
        count: tools.length,
        json,
      },
      tokensUsed,
      toolCalls,
      decisions: [],
    };
  } catch (error: unknown) {
    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : String(error),
      tokensUsed,
      toolCalls,
      decisions: [],
    };
  }
};