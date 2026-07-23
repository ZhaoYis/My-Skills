export type FeatureId = 'base' | 'skills' | 'commands' | 'docs' | 'structural-analysis-hint';

export const DEFAULT_FEATURES = [
  'base',
  'skills',
  'commands',
  'docs',
] as const satisfies readonly FeatureId[];

export const OPTIONAL_FEATURES = [
  'structural-analysis-hint',
] as const satisfies readonly FeatureId[];

export const ALL_FEATURE_IDS = [
  ...DEFAULT_FEATURES,
  ...OPTIONAL_FEATURES,
] as const satisfies readonly FeatureId[];
export type ToolId = 'claude' | 'cursor' | 'codex';

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
