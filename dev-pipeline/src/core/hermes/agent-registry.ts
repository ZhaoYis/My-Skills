import type { PipelinePhase } from './types.js';
import type { AgentDefinition } from './agents/types.js';

/**
 * Registry that stores all registered Agents and provides
 * lookup by phase, id, or category.
 */
export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  /**
   * Register a single agent definition.
   * Throws if an agent with the same id already exists.
   */
  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(
        `Agent with id "${agent.id}" is already registered.`,
      );
    }
    this.agents.set(agent.id, agent);
  }

  /**
   * Register multiple agent definitions at once.
   */
  registerAll(agents: AgentDefinition[]): void {
    for (const agent of agents) {
      this.register(agent);
    }
  }

  /**
   * Get all agents that can operate in the given phase.
   */
  getByPhase(phase: PipelinePhase): AgentDefinition[] {
    return this.getAll().filter((agent) =>
      agent.phases.includes(phase),
    );
  }

  /**
   * Get an agent by its unique id.
   */
  getById(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all registered agents.
   */
  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by category.
   */
  getByCategory(category: 'cli' | 'pipeline'): AgentDefinition[] {
    return this.getAll().filter((agent) => agent.category === category);
  }

  /**
   * Remove an agent by id.
   */
  unregister(id: string): boolean {
    return this.agents.delete(id);
  }

  /**
   * Get the number of registered agents.
   */
  get count(): number {
    return this.agents.size;
  }
}

/**
 * Create and return a new AgentRegistry with the default set of
 * built-in agents registered.
 *
 * The caller must pass an array of AgentDefinition because the
 * registry module must not import agent implementations (to avoid
 * circular dependencies — agents import from the registry, and
 * the registry imports from agents).
 */
export function createDefaultRegistry(
  agents: AgentDefinition[],
): AgentRegistry {
  const registry = new AgentRegistry();
  registry.registerAll(agents);
  return registry;
}