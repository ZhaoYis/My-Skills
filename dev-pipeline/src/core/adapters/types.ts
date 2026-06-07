export type FeatureId = 'base' | 'skills' | 'commands' | 'docs';
export type ToolId = 'claude' | 'cursor' | 'codex' | 'generic';

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
}

export interface ToolAdapter {
  definition: ToolDefinition;
  detectFiles(): string[];
  supports(feature: FeatureId): boolean;
  getDestination(feature: Extract<FeatureId, 'skills' | 'commands'>): string;
  getRoot(): string;
  getPostInstallNotes(): string[];
}
