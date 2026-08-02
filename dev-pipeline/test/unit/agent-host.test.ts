import { PassThrough } from 'node:stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { PipelineRun } from '../../src/agent/domain/pipeline-state.js';
import { McpToolServer } from '../../src/agent/host/mcp-tool-server.js';
import { StdioToolServer } from '../../src/agent/host/stdio-tool-server.js';
import { ContextBuilder } from '../../src/agent/runtime/context-builder.js';
import { type ModelClient, ModelPlanner } from '../../src/agent/runtime/model-planner.js';
import { InMemoryStateStore } from '../../src/agent/runtime/state-store.js';
import { ToolRegistry } from '../../src/agent/tools/registry.js';

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    schemaVersion: 3,
    _version: 0,
    runId: 'demo-change',
    changeName: 'demo-change',
    sourceBranch: 'feature/demo-change',
    targetBranch: 'main',
    currentPhase: 1,
    currentStep: 3,
    status: 'active',
    executionMode: 'pipeline',
    decisions: {},
    phaseHistory: [],
    gatesBypassed: [],
    tests: { status: 'pending', attempts: 0 },
    verify: { status: 'pending', attempts: 0 },
    archivePath: null,
    delivery: {
      commitSha: null,
      mergeCommitSha: null,
      sourcePushed: false,
      targetPushed: false,
      tag: null,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  // Keep the test suite explicit about not using process stdio.
});

describe('ContextBuilder and ModelPlanner', () => {
  it('builds a constrained prompt from state, facts and registered tools', () => {
    const builder = new ContextBuilder(['openspec.status', 'openspec.validate']);
    const context = builder.build(makeRun(), { clean: true });
    expect(context.phase.id).toBe(1);
    expect(context.availableTools).toEqual(['openspec.status', 'openspec.validate']);
    expect(builder.toPrompt(context)).toContain('Never approve a gate');
  });

  it('accepts valid model JSON and recalculates the action risk', async () => {
    const client: ModelClient = {
      complete: async () =>
        '{"action":{"actionId":"push-1","kind":"git.push","phase":6,"args":{"branch":"main"}}}',
    };
    const planner = new ModelPlanner(
      client,
      new ContextBuilder(['git.push']),
      new Set(['git.push']),
    );
    const action = await planner.nextAction({
      state: makeRun({ currentPhase: 6 }),
      facts: {},
    });
    expect(action).toMatchObject({ actionId: 'push-1', kind: 'git.push', risk: 'high' });
  });

  it('rejects malformed, cross-phase and unregistered model actions', async () => {
    const makePlanner = (response: string, tools = ['openspec.status']) =>
      new ModelPlanner(
        { complete: async () => response },
        new ContextBuilder(tools),
        new Set(tools),
      );
    await expect(
      makePlanner('not-json').nextAction({ state: makeRun(), facts: {} }),
    ).rejects.toThrow();
    await expect(
      makePlanner('{"action":{"actionId":"x","kind":"openspec.status","phase":2}}').nextAction({
        state: makeRun(),
        facts: {},
      }),
    ).rejects.toThrow('model-action-phase-mismatch');
    await expect(
      makePlanner('{"action":{"actionId":"x","kind":"git.push","phase":1}}').nextAction({
        state: makeRun(),
        facts: {},
      }),
    ).rejects.toThrow('model-action-not-allowed-in-phase');
  });
});

describe('StdioToolServer', () => {
  it('exposes tools/list, pipeline/status and tools/call through JSON-RPC responses', async () => {
    const registry = new ToolRegistry();
    registry.register('fixture.read', async (input) => ({
      status: 'succeeded',
      summary: `read:${String(input.value)}`,
    }));
    const store = new InMemoryStateStore([makeRun()]);
    const server = new StdioToolServer(registry, store);

    await expect(
      server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    ).resolves.toMatchObject({ result: { tools: [{ name: 'fixture.read' }] } });
    await expect(
      server.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'pipeline/status',
        params: { runId: 'demo-change' },
      }),
    ).resolves.toMatchObject({ result: { state: { changeName: 'demo-change' } } });
    await expect(
      server.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { runId: 'demo-change', name: 'fixture.read', arguments: { value: 'x' } },
      }),
    ).resolves.toMatchObject({ result: { status: 'succeeded', summary: 'read:x' } });
  });

  it('serves newline-delimited requests without writing logs to stdout', async () => {
    const registry = new ToolRegistry();
    registry.register('fixture.read', async () => ({ status: 'succeeded', summary: 'ok' }));
    const server = new StdioToolServer(registry, new InMemoryStateStore([makeRun()]));
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(chunk.toString()));
    const serving = server.serve(input, output);
    input.write('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
    input.end();
    await serving;
    expect(JSON.parse(chunks.join(''))).toMatchObject({ jsonrpc: '2.0', id: 1 });
  });
});

describe('McpToolServer', () => {
  it('speaks the official MCP initialize, list and call flow', async () => {
    const registry = new ToolRegistry();
    registry.register('fixture.read', async (input) => ({
      status: 'succeeded',
      summary: `read:${String(input.value)}`,
    }));
    const serverAdapter = new McpToolServer(registry, new InMemoryStateStore([makeRun()]));
    const server = serverAdapter.createServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(['pipeline.status', 'fixture.read']);

    const called = await client.callTool({
      name: 'fixture.read',
      arguments: { runId: 'demo-change', value: 'x' },
    });
    expect(called.isError).not.toBe(true);
    expect(called.content).toEqual([
      { type: 'text', text: '{"status":"succeeded","summary":"read:x"}' },
    ]);

    await client.close();
    await server.close();
  });

  it('returns protocol tool errors without exposing arbitrary state access', async () => {
    const server = new McpToolServer(new ToolRegistry(), new InMemoryStateStore([makeRun()]));
    await expect(server.callTool('pipeline.status', {})).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'missing-run-id' }],
    });
    await expect(
      server.callTool('pipeline.status', { runId: '../outside' }),
    ).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'pipeline-run-not-found: ../outside' }],
    });
  });
});
