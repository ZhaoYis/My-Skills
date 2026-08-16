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
  assetKindRank?: string[];
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
