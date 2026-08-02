import { createInterface, type Interface } from 'node:readline';
import type { StateStore } from '../runtime/state-store.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface ToolServerRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'tools/list' | 'tools/call' | 'pipeline/status';
  params?: Record<string, unknown>;
}

export interface ToolServerResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: string; message: string };
}

export class StdioToolServer {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly stateStore: StateStore,
  ) {}

  async handle(request: ToolServerRequest): Promise<ToolServerResponse> {
    try {
      if (request.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools: this.registry.list().map((name) => ({ name })) },
        };
      }
      const runId = String(request.params?.runId ?? '');
      if (!runId) return this.error(request.id, 'missing-run-id');
      const state = await this.stateStore.load(runId);
      if (!state) return this.error(request.id, `pipeline-run-not-found: ${runId}`);

      if (request.method === 'pipeline/status') {
        return { jsonrpc: '2.0', id: request.id, result: { status: 'ok', state } };
      }
      if (request.method === 'tools/call') {
        const name = String(request.params?.name ?? '');
        const args = (request.params?.arguments ?? {}) as Record<string, unknown>;
        const result = await this.registry.execute(name, args, { run: state });
        return { jsonrpc: '2.0', id: request.id, result };
      }
      return this.error(request.id, 'method-not-supported');
    } catch (error) {
      return this.error(request.id, error instanceof Error ? error.message : String(error));
    }
  }

  async serve(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout,
  ): Promise<void> {
    const lines: Interface = createInterface({ input });
    for await (const line of lines) {
      if (!line.trim()) continue;
      let response: ToolServerResponse;
      try {
        response = await this.handle(JSON.parse(line) as ToolServerRequest);
      } catch (error) {
        response = {
          jsonrpc: '2.0',
          id: 'unknown',
          error: {
            code: 'invalid-request',
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
      output.write(`${JSON.stringify(response)}\n`);
    }
  }

  private error(id: string | number, message: string): ToolServerResponse {
    return { jsonrpc: '2.0', id, error: { code: 'request-failed', message } };
  }
}
