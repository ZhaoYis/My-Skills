/**
 * Phase Bundle 加载器
 * 根据 Phase 编号和 Route 动态加载对应的执行指引
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PhaseBundle, LoadPhaseOptions, KnowledgeSummary } from './types.js';
import { loadReferenceMetadata, selectKnowledge } from '../knowledge/index.js';

// Route 对应的 Phase 路径
const ROUTE_PHASE_PATHS: Record<string, number[]> = {
  trivial: [0, 2, 6],
  standard: [0, 1, 2, 3, 4, 5, 6, 7],
  full: [0, 1, 2, 3, 4, 5, 6, 7],
};

// Phase 标题映射
const PHASE_TITLES: Record<number, string> = {
  0: '入口判断 + Route 分级',
  1: '提案编写 (Propose)',
  2: '提案应用 (Apply)',
  3: '代码审查 (Review)',
  4: '单元测试门禁',
  5: '提案归档 (Archive)',
  6: '提交与推送',
  7: '合并与交付',
};

// Phase 文件名映射
const PHASE_FILES: Record<number, string> = {
  0: 'phase-0-entrance.md',
  1: 'phase-1-propose.md',
  2: 'phase-2-apply.md',
  3: 'phase-3-review.md',
  4: 'phase-4-unit-tests.md',
  5: 'phase-5-archive.md',
  6: 'phase-6-commit-push.md',
  7: 'phase-7-merge-deliver.md',
};

/**
 * 检查指定 Phase 是否在当前 Route 的路径中
 */
export function isPhaseAllowed(route: string, phase: number): boolean {
  const phasePath = ROUTE_PHASE_PATHS[route] || ROUTE_PHASE_PATHS.standard;
  return phasePath.includes(phase);
}

/**
 * 获取 Route 对应的 Phase 路径
 */
export function getRoutePhasePath(route: string): number[] {
  return ROUTE_PHASE_PATHS[route] || ROUTE_PHASE_PATHS.standard;
}

/**
 * 加载 Phase reference 文件内容
 */
async function loadPhaseReference(packageRoot: string, phase: number): Promise<string | null> {
  const fileName = PHASE_FILES[phase];
  if (!fileName) return null;

  const referencePath = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
    fileName,
  );

  try {
    const content = await readFile(referencePath, 'utf-8');
    // 移除 frontmatter（---...--- 之间的内容）
    return content.replace(/^---\n[\s\S]*?\n---\n/, '');
  } catch {
    return null;
  }
}

/**
 * 加载 Phase Bundle
 */
export async function loadPhaseBundle(options: LoadPhaseOptions): Promise<PhaseBundle> {
  const { phase, projectRoot, packageRoot, route = 'standard', paths = [] } = options;

  const title = PHASE_TITLES[phase] || `Phase ${phase}`;

  // 检查 Phase 是否被 Route 跳过
  if (!isPhaseAllowed(route, phase)) {
    const phasePath = getRoutePhasePath(route);
    return {
      phase,
      title,
      reference: '',
      knowledge: [],
      route,
      skipped: true,
      skipReason: `Route "${route}" 跳过此 Phase。当前 Route 路径：${phasePath.join(' → ')}`,
    };
  }

  // 加载 Phase reference
  const reference = await loadPhaseReference(packageRoot, phase);
  if (!reference) {
    return {
      phase,
      title,
      reference: `# ${title}\n\nReference 文件未找到。`,
      knowledge: [],
      route,
      skipped: false,
    };
  }

  // 加载 Knowledge 选择结果
  const referencesDir = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
  );

  const metadata = await loadReferenceMetadata(referencesDir);
  const knowledgeResult = selectKnowledge(metadata, {
    phase,
    routes: [route],
    paths: paths.length > 0 ? paths : undefined,
  });

  const knowledge: KnowledgeSummary[] = knowledgeResult.selected.map((k) => ({
    file: k.file,
    phase: k.phase,
    asset_kind: k.asset_kind,
    description: k.description,
  }));

  return {
    phase,
    title,
    reference,
    knowledge,
    route,
    skipped: false,
  };
}

/**
 * 格式化 Phase Bundle 为 Markdown
 */
export function formatPhaseBundleMarkdown(bundle: PhaseBundle): string {
  const lines: string[] = [];

  lines.push(`# Phase ${bundle.phase}: ${bundle.title}`);
  lines.push('');
  lines.push(`**Route**: ${bundle.route}`);
  lines.push('');

  if (bundle.skipped) {
    lines.push('> ⚠️ **此 Phase 已被当前 Route 跳过**');
    lines.push('>');
    lines.push(`> ${bundle.skipReason}`);
    lines.push('');
    return lines.join('\n');
  }

  // Knowledge 摘要
  if (bundle.knowledge.length > 0) {
    lines.push('## 相关知识');
    lines.push('');
    for (const k of bundle.knowledge) {
      lines.push(`- **${k.asset_kind}**: ${k.description}`);
    }
    lines.push('');
  }

  // Reference 正文
  lines.push('## 执行指引');
  lines.push('');
  lines.push(bundle.reference);

  return lines.join('\n');
}

/**
 * 格式化 Phase Bundle 为 JSON
 */
export function formatPhaseBundleJson(bundle: PhaseBundle): string {
  return JSON.stringify(bundle, null, 2);
}
