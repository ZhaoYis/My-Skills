import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../../src/core/hermes/agent-registry.js';
import type { AgentDefinition } from '../../src/core/hermes/agents/types.js';
import type { PipelinePhase } from '../../src/core/hermes/types.js';

function makeAgent(
  id: string,
  phases: PipelinePhase[] = ['pre_pipeline'],
  category: 'cli' | 'pipeline' = 'cli',
): AgentDefinition {
  return {
    id,
    name: `Agent ${id}`,
    description: `Test agent: ${id}`,
    phases,
    category,
    handler: async () => ({
      success: true,
      output: { agent: id },
      tokensUsed: 0,
      toolCalls: 0,
      decisions: [],
    }),
  };
}

describe('AgentRegistry', () => {
  describe('register', () => {
    it('registers a single agent', () => {
      const registry = new AgentRegistry();
      const agent = makeAgent('test');
      registry.register(agent);

      expect(registry.getById('test')).toBe(agent);
      expect(registry.count).toBe(1);
    });

    it('throws when registering a duplicate agent id', () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent('test'));

      expect(() => registry.register(makeAgent('test'))).toThrow(
        'Agent with id "test" is already registered.',
      );
    });

    it('registers multiple agents via registerAll', () => {
      const registry = new AgentRegistry();
      registry.registerAll([
        makeAgent('a'),
        makeAgent('b'),
        makeAgent('c'),
      ]);

      expect(registry.count).toBe(3);
      expect(registry.getById('a')).toBeDefined();
      expect(registry.getById('b')).toBeDefined();
      expect(registry.getById('c')).toBeDefined();
    });
  });

  describe('getByPhase', () => {
    it('returns agents that operate in a specific phase', () => {
      const registry = new AgentRegistry();
      registry.registerAll([
        makeAgent('init', ['pre_pipeline']),
        makeAgent('doctor', ['pre_pipeline', 'phase1_propose', 'phase2_apply']),
        makeAgent('pipeline', [
          'pre_pipeline',
          'phase0_entrance',
          'phase1_propose',
          'phase2_apply',
        ], 'pipeline'),
      ]);

      const preAgents = registry.getByPhase('pre_pipeline');
      expect(preAgents).toHaveLength(3);

      const phase1Agents = registry.getByPhase('phase1_propose');
      expect(phase1Agents).toHaveLength(2);
      expect(phase1Agents.map((a) => a.id)).toContain('doctor');
      expect(phase1Agents.map((a) => a.id)).toContain('pipeline');
    });

    it('returns empty array when no agents match the phase', () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent('init', ['pre_pipeline']));

      expect(registry.getByPhase('completed')).toEqual([]);
      expect(registry.getByPhase('phase7_ci_pending')).toEqual([]);
    });
  });

  describe('getById', () => {
    it('returns undefined for unknown agent', () => {
      const registry = new AgentRegistry();
      expect(registry.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('getByCategory', () => {
    it('separates agents by category', () => {
      const registry = new AgentRegistry();
      registry.registerAll([
        makeAgent('init', ['pre_pipeline'], 'cli'),
        makeAgent('doctor', ['pre_pipeline'], 'cli'),
        makeAgent('pipeline', ['phase1_propose'], 'pipeline'),
      ]);

      const cliAgents = registry.getByCategory('cli');
      const pipelineAgents = registry.getByCategory('pipeline');

      expect(cliAgents).toHaveLength(2);
      expect(pipelineAgents).toHaveLength(1);
      expect(pipelineAgents[0]!.id).toBe('pipeline');
    });
  });

  describe('unregister', () => {
    it('removes an agent by id', () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent('test'));

      expect(registry.unregister('test')).toBe(true);
      expect(registry.count).toBe(0);
      expect(registry.getById('test')).toBeUndefined();
    });

    it('returns false when unregistering unknown agent', () => {
      const registry = new AgentRegistry();
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });
});