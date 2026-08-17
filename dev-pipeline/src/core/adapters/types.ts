export type FeatureId = 'base' | 'skills' | 'commands' | 'docs' | 'schema';

export const ALL_FEATURE_IDS = [
  'base',
  'skills',
  'commands',
  'docs',
  'schema',
] as const satisfies readonly FeatureId[];
export type ToolId = 'claude' | 'cursor' | 'codex';
export type StackId = 'frontend' | 'backend' | 'fullstack';
export type DocLanguage = 'en' | 'zh';

/** Install scope: project-level (relative to project root) or user-level (relative to home directory). */
export type InstallScope = 'project' | 'user';

export interface ToolDestinations {
  root: string;
  skills: string;
  commands: string;
}

export interface ToolDefinition {
  id: ToolId;
  displayName: string;
  description: string;
  markers: string[];
  destinations: ToolDestinations;
  /** Optional user-level destinations. Omitted features are not supported at user scope. */
  userDestinations?: Partial<ToolDestinations>;
  supports: FeatureId[];
  /** Custom SKILL_ROOT guidance. Supports a `{skillsDir}` placeholder. */
  skillRootNote?: string;
}

export interface ToolAdapter {
  definition: ToolDefinition;
  detectFiles(): string[];
  supports(feature: FeatureId): boolean;
  getDestination(feature: Extract<FeatureId, 'skills' | 'commands'>, scope?: InstallScope): string;
  /** Whether this tool supports installing the given feature at user scope. */
  supportsUserDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): boolean;
  getRoot(): string;
  getSkillRootNote(): string | undefined;
}
