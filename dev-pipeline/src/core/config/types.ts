export type PipelineRoute = 'trivial' | 'standard' | 'full';

export interface RouteConfig {
  description?: string;
  phases: number[];
  examples?: string[];
  conditions?: string[];
}

export interface PipelineConfig {
  language?: string;
  default_route?: PipelineRoute;
  review?: {
    max_rounds?: number;
    auto_fix?: boolean;
  };
  tests?: {
    required?: boolean;
    command_auto_detect?: boolean;
  };
  git?: {
    commit_style?: string;
    branch_prefix?: string;
  };
  routes?: Partial<Record<PipelineRoute, RouteConfig>>;
}

export interface KnowledgeConfig {
  two_phase_loading?: boolean;
  asset_kind_rank?: string[];
}

export interface EffectiveConfig {
  pipeline?: PipelineConfig;
  knowledge?: KnowledgeConfig;
}

export interface ConfigSource {
  source: 'defaults' | 'project' | 'override';
  path?: string;
}

export interface ConfigWithSource {
  config: EffectiveConfig;
  sources: Map<string, ConfigSource>;
}
