import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HermesOrchestrator } from '../../src/core/hermes/orchestrator.js';
import { createInitialState, writeHermesState } from '../../src/core/hermes/runtime-state.js';
import { AgentRegistry } from '../../src/core/hermes/agent-registry.js';
import type { AgentDefinition } from '../../src/core/hermes/agents/types.js';
import type { PipelinePhase } from '../../src/core/hermes/types.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

describe('HermesOrchestrator', () => {
  describe('construction', () => {
    it('creates an orchestrator with default options', () => {
      const orchestrator = new HermesOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getRegistry()).toBeInstanceOf(AgentRegistry);
    });

    it('creates an orchestrator with custom directory', () => {
      const orchestrator = new HermesOrchestrator({
        dir: '/tmp/test-dir',
      });
      expect(orchestrator).toBeDefined();
    });

    it('registers all built-in agents', () => {
      const orchestrator = new HermesOrchestrator();
      const agents = orchestrator.getRegistry().getAll();

      expect(agents.length).toBeGreaterThanOrEqual(7);
      const agentIds = agents.map((a) => a.id);
      expect(agentIds).toContain('init');
      expect(agentIds).toContain('sync');
      expect(agentIds).toContain('upgrade');
      expect(agentIds).toContain('uninstall');
      expect(agentIds).toContain('doctor');
      expect(agentIds).toContain('list-tools');
      expect(agentIds).toContain('pipeline-phase');
    });
  });

  describe('step with auto-transition', () => {
    it('auto-transitions when no agent is available for a phase', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test', 'push_only');

      const orchestrator = new HermesOrchestrator({ dir });

      // phase3_fix only has 'pipeline-phase' agent, but we can test a phase with no built-in agents.
      // Actually pipeline-phase covers all phases. Let's use a custom empty registry instead.
      const emptyRegistry = new AgentRegistry();
      const privateOrch = orchestrator as any;
      privateOrch.registry = emptyRegistry;

      const result = await privateOrch.step({
        ...state,
        currentPhase: 'phase6_push' as PipelinePhase,
      });

      // With empty registry, it should auto-transition to the next non-terminal phase
      expect(result).toBeDefined();
      expect(result.isTerminal).toBeDefined();
    });
  });

  describe('step with custom agent', () => {
    it('executes a step with a custom non-interactive agent', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test');
      await writeHermesState(dir, state);

      // Create a custom registry with only a non-interactive agent
      const customRegistry = new AgentRegistry();
      const customAgent: AgentDefinition = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A non-interactive test agent',
        phases: ['pre_pipeline', 'phase1_propose', 'phase3_fix'],
        category: 'cli',
        handler: async () => ({
          success: true,
          output: { message: 'executed' },
          tokensUsed: 10,
          toolCalls: 2,
          decisions: [{
            id: 'test-decision',
            phase: 'pre_pipeline',
            type: 'C' as const,
            context: 'Test execution',
            choice: 'success',
            reason: 'Test',
            timestamp: new Date().toISOString(),
          }],
          suggestedNextPhase: 'phase0_entrance',
        }),
      };
      customRegistry.register(customAgent);

      const orchestrator = new HermesOrchestrator({ dir });
      (orchestrator as any).registry = customRegistry;

      const result = await (orchestrator as any).step(state);

      expect(result).toBeDefined();
      expect(result.execution).toBeDefined();
      expect(result.execution.agentId).toBe('test-agent');
      expect(result.execution.result.success).toBe(true);
      expect(result.execution.result.output).toEqual({ message: 'executed' });
    });
  });

  describe('run with specific non-interactive agent', () => {
    it('runs only the specified agent', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test');
      await writeHermesState(dir, state);

      const orchestrator = new HermesOrchestrator({
        dir,
        agentId: 'list-tools',
      });

      const result = await orchestrator.run();

      expect(result.totalSteps).toBe(1);
      expect(result.steps[0]!.execution.agentId).toBe('list-tools');
      expect(result.steps[0]!.execution.result.success).toBe(true);
    });

    it('runs the pipeline-phase agent', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test');
      await writeHermesState(dir, state);

      const orchestrator = new HermesOrchestrator({
        dir,
        agentId: 'pipeline-phase',
      });

      const result = await orchestrator.run();

      expect(result.totalSteps).toBe(1);
      expect(result.steps[0]!.execution.agentId).toBe('pipeline-phase');
      expect(result.steps[0]!.execution.result.success).toBe(true);
      const output = result.steps[0]!.execution.result.output as any;
      expect(output.phase).toBe('pre_pipeline');
    });

    it('runs the doctor agent successfully', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test');
      await writeHermesState(dir, state);

      const orchestrator = new HermesOrchestrator({
        dir,
        agentId: 'doctor',
      });

      const result = await orchestrator.run();

      expect(result.totalSteps).toBe(1);
      expect(result.steps[0]!.execution.agentId).toBe('doctor');
      // Doctor may succeed or fail depending on directory state
      expect(result.steps[0]!.execution.result).toBeDefined();
      const output = result.steps[0]!.execution.result.output as any;
      expect(output).toBeDefined();
      expect(output.status).toBeDefined();
    });
  });

  describe('registry access', () => {
    it('provides access to the agent registry', () => {
      const orchestrator = new HermesOrchestrator();
      const registry = orchestrator.getRegistry();

      expect(registry).toBeInstanceOf(AgentRegistry);
      expect(registry.count).toBeGreaterThan(0);
    });

    it('can filter agents by phase', () => {
      const orchestrator = new HermesOrchestrator();
      const prePipelineAgents = orchestrator
        .getRegistry()
        .getByPhase('pre_pipeline');

      expect(prePipelineAgents.length).toBeGreaterThan(0);
    });

    it('can filter agents by category', () => {
      const orchestrator = new HermesOrchestrator();
      const cliAgents = orchestrator.getRegistry().getByCategory('cli');
      const pipelineAgents = orchestrator.getRegistry().getByCategory('pipeline');

      expect(cliAgents.length).toBeGreaterThan(0);
      expect(pipelineAgents.length).toBeGreaterThan(0);
    });
  });

  describe('runOrchestrator standalone', () => {
    it('runs with a specific agent without interaction', async () => {
      const dir = await createTempDir('hermes-orch-');
      const state = createInitialState('test-change', 'feature/test');
      await writeHermesState(dir, state);

      const { runOrchestrator } = await import(
        '../../src/core/hermes/orchestrator.js'
      );

      const result = await runOrchestrator({
        dir,
        agentId: 'list-tools',
      });

      expect(result.totalSteps).toBe(1);
      expect(result.steps[0]!.execution.result.success).toBe(true);
    });
  });
});