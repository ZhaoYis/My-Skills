/**
 * Phase Bundle 类型定义
 */

export interface PhaseBundle {
  phase: number;
  title: string;
  reference: string;
  knowledge: KnowledgeSummary[];
  route: string;
  skipped: boolean;
  skipReason?: string;
}

export interface KnowledgeSummary {
  file: string;
  phase: number;
  asset_kind: string;
  description: string;
}

export interface LoadPhaseOptions {
  phase: number;
  projectRoot: string;
  packageRoot: string;
  route?: string;
  paths?: string[];
}
