/**
 * 有效配置合成模块
 * 实现多层配置级联：包内默认 → 项目事实 → 项目覆写 → 合成有效配置
 */

export interface PipelineConfig {
  language?: string;
  default_route?: 'trivial' | 'standard' | 'full';
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
  phases?: {
    routes?: Record<string, RouteConfig>;
  };
}

export interface RouteConfig {
  description?: string;
  phases?: number[];
  bypass_phases?: number[];
  examples?: string[];
  conditions?: string[];
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
