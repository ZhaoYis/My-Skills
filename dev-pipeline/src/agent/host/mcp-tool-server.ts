import type { Readable, Writable } from 'node:stream';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { PipelineRun } from '../domain/pipeline-state.js';
import type { StateStore } from '../runtime/state-store.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface McpToolServerOptions {
  name?: string;
  version?: string;
}

/** Official MCP boundary for the local Agent runtime.
 *
 * The protocol layer deliberately owns no pipeline rules. It only resolves a
 * run, delegates to ToolRegistry, and converts the result to MCP content.
 */
export class McpToolServer {
  private readonly name: string;
  private readonly version: string;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly stateStore: StateStore,
    options: McpToolServerOptions = {},
  ) {
    this.name = options.name ?? 'opsx-dev-pipeline-agent';
    this.version = options.version ?? '1.0.0';
  }

  createServer(): Server {
    const server = new Server(
      { name: this.name, version: this.version },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolDefinitions(),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.callTool(request.params.name, request.params.arguments ?? {}),
    );
    return server;
  }

  async serve(input: Readable = process.stdin, output: Writable = process.stdout): Promise<void> {
    const transport = new StdioServerTransport(input, output);
    await this.createServer().connect(transport);
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
    const runId = typeof input.runId === 'string' ? input.runId : '';
    if (!runId) return this.errorResult('missing-run-id');

    let state: PipelineRun | null;
    try {
      state = await this.stateStore.load(runId);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : String(error));
    }
    if (!state) return this.errorResult(`pipeline-run-not-found: ${runId}`);

    if (name === 'pipeline.status') {
      return this.successResult({ status: 'ok', state });
    }

    const toolInput = { ...input };
    delete toolInput.runId;
    try {
      const result = await this.registry.execute(name, toolInput, { run: state });
      return result.status === 'succeeded'
        ? this.successResult(result)
        : this.errorResult(result.summary, result);
    } catch (error) {
      return this.errorResult(error instanceof Error ? error.message : String(error));
    }
  }

  private toolDefinitions(): Tool[] {
    const names = ['pipeline.status', ...this.registry.list()];
    return names.map((name) => ({
      name,
      description:
        name === 'pipeline.status'
          ? 'Read the current gated pipeline state. Requires runId.'
          : `Execute ${name} for a pipeline run. Requires runId.`,
      inputSchema: {
        type: 'object' as const,
        properties: { runId: { type: 'string' } },
        required: ['runId'],
        additionalProperties: true,
      },
    }));
  }

  private successResult(value: unknown): CallToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(value) }],
      structuredContent:
        value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined,
    };
  }

  private errorResult(message: string, value?: unknown): CallToolResult {
    return {
      isError: true,
      content: [{ type: 'text', text: message }],
      structuredContent:
        value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined,
    };
  }
}
