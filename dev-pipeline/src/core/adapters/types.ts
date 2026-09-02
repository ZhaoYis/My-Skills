export type FeatureId = 'base' | 'skills' | 'commands' | 'docs' | 'schema' | 'hooks';

export const ALL_FEATURE_IDS = [
  'base',
  'skills',
  'commands',
  'docs',
  'schema',
  'hooks',
] as const satisfies readonly FeatureId[];
export type ToolId = 'claude' | 'cursor' | 'codex' | 'opencode';
export type StackId = 'frontend' | 'backend' | 'fullstack';
export type DocLanguage = 'en' | 'zh';

/** Install scope: project-level (relative to project root) or user-level (relative to home directory). */
export type InstallScope = 'project' | 'user';

export interface ToolDestinations {
  root: string;
  skills: string;
  commands: string;
}

export type HookMode = 'auto' | 'manual';

export interface ToolDefinition {
  id: ToolId;
  displayName: string;
  description: string;
  markers: string[];
  destinations: ToolDestinations;
  /** Optional user-level destinations. Omitted features are not supported at user scope. */
  userDestinations?: Partial<ToolDestinations>;
  supports: FeatureId[];
  /** Optional tool-specific metadata. */
  metadata?: {
    /** Hook configuration for this tool. */
    hooks?: {
      /** `auto`: render hook templates on init. `manual`: print docs only. */
      mode?: HookMode;
    };
  };
}

export interface ToolAdapter {
  definition: ToolDefinition;
  detectFiles(): string[];
  supports(feature: FeatureId): boolean;
  getDestination(feature: Extract<FeatureId, 'skills' | 'commands'>, scope?: InstallScope): string;
  /** Whether this tool supports installing the given feature at user scope. */
  supportsUserDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): boolean;
  getRoot(): string;
  /** Hook generation mode for this tool. `undefined` when the tool has no hook metadata. */
  getHookMode(): HookMode | undefined;
}
