/**
 * Knowledge 两阶段加载模块
 * 第一阶段：CLI 基于元数据过滤
 * 第二阶段：AI 判断是否打开正文
 */

export interface KnowledgeMetadata {
  file: string;
  phase: number;
  asset_kind: string;
  routes: string[];
  path_hints: string[];
  description: string;
}

export interface KnowledgeSelectOptions {
  phase: number;
  routes?: string[];
  paths?: string[];
}

export interface KnowledgeSelection {
  file: string;
  phase: number;
  asset_kind: string;
  description: string;
  match_reason: string;
}

export interface KnowledgeSkip {
  file: string;
  reason: string;
}

export interface KnowledgeSelectResult {
  selected: KnowledgeSelection[];
  skipped: KnowledgeSkip[];
}
