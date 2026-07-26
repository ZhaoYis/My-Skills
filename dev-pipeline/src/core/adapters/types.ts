export type FeatureId = 'base' | 'skills' | 'commands' | 'docs' | 'schema';

export const ALL_FEATURE_IDS = [
  'base',
  'skills',
  'commands',
  'docs',
  'schema',
] as const satisfies readonly FeatureId[];
export type ToolId = 'claude' | 'cursor' | 'codex';
export type StackId = 'frontend' | 'backend';
export type DocLanguage = 'en' | 'zh';

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
  supports: FeatureId[];
  postInstallNotes?: string[];
}

export interface ToolAdapter {
  definition: ToolDefinition;
  detectFiles(): string[];
  supports(feature: FeatureId): boolean;
  getDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): string;
  getRoot(): string;
  getPostInstallNotes(): string[];
}
