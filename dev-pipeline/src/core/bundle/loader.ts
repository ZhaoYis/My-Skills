import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { EffectiveConfig, PipelineRoute } from '../config/index.js';
import { loadReferenceMetadata, selectKnowledge } from '../knowledge/index.js';
import type { KnowledgeSummary, LoadPhaseOptions, PhaseBundle } from './types.js';

const FALLBACK_ROUTES: Record<PipelineRoute, number[]> = {
  trivial: [0, 2, 6],
  standard: [0, 1, 2, 5, 6],
  full: [0, 1, 2, 3, 4, 5, 6, 7],
};

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

/**
 * 将 Phase 数字数组转换为用户友好的中文路径字符串
 * 例如：[0, 1, 2, 3, 6] → "入口判断 → 提案编写 → 提案应用 → 代码审查 → 提交与推送"
 */
export function formatPhasePath(phases: number[]): string {
  return phases.map((phase) => PHASE_TITLES[phase] ?? `Phase ${phase}`).join(' → ');
}

const PHASE_BASENAMES: Record<number, string> = {
  0: 'phase-0-entrance',
  1: 'phase-1-propose',
  2: 'phase-2-apply',
  3: 'phase-3-review',
  4: 'phase-4-unit-tests',
  5: 'phase-5-archive',
  6: 'phase-6-commit-push',
  7: 'phase-7-merge-deliver',
};

function configuredPhasePath(config: EffectiveConfig | undefined, route: string): number[] {
  const configured = config?.pipeline?.routes?.[route as PipelineRoute]?.phases;
  return configured ?? FALLBACK_ROUTES[route as PipelineRoute] ?? FALLBACK_ROUTES.standard;
}

export function isPhaseAllowed(
  route: string,
  phase: number,
  config?: EffectiveConfig,
): boolean {
  return configuredPhasePath(config, route).includes(phase);
}

export function getRoutePhasePath(route: string, config?: EffectiveConfig): number[] {
  return configuredPhasePath(config, route);
}

async function readFirst(paths: string[]): Promise<string | null> {
  for (const candidate of paths) {
    try {
      return await readFile(candidate, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return null;
}

function stripFrontmatter(content: string): string {
  return content
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/^---[ \t]*\n[\s\S]*?\n---[ \t]*(?:\n|$)/, '');
}

async function loadPhaseReference(packageRoot: string, phase: number): Promise<string | null> {
  const base = PHASE_BASENAMES[phase];
  if (!base) return null;
  const directory = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
  );
  const content = await readFirst([join(directory, `${base}.md.hbs`), join(directory, `${base}.md`)]);
  return content === null ? null : stripFrontmatter(content);
}

async function routeFromChange(projectRoot: string, change: string): Promise<string | undefined> {
  const content = await readFile(
    join(projectRoot, 'openspec', '.pipeline-state', `${change}.json`),
    'utf8',
  );
  const state = JSON.parse(content) as {
    route?: unknown;
    decisions?: { route_choice?: unknown; routeChoice?: unknown };
  };
  const route = state.route ?? state.decisions?.route_choice ?? state.decisions?.routeChoice;
  return typeof route === 'string' ? route : undefined;
}

export async function loadPhaseBundle(options: LoadPhaseOptions): Promise<PhaseBundle> {
  const { phase, projectRoot, packageRoot, paths = [], effectiveConfig } = options;
  const route =
    options.route ??
    (options.change ? await routeFromChange(projectRoot, options.change) : undefined) ??
    effectiveConfig?.pipeline?.default_route ??
    'standard';
  const title = PHASE_TITLES[phase] ?? `Phase ${phase}`;

  if (!isPhaseAllowed(route, phase, effectiveConfig)) {
    return {
      phase,
      title,
      reference: '',
      knowledge: [],
      route,
      skipped: true,
      skipReason: `Route "${route}" 跳过此 Phase。当前 Route 路径：${formatPhasePath(getRoutePhasePath(route, effectiveConfig))}`,
    };
  }

  const reference = await loadPhaseReference(packageRoot, phase);
  const referencesDir = join(
    packageRoot,
    'templates',
    'common',
    'skills',
    'opsx-dev-pipeline',
    'references',
  );
  const result = selectKnowledge(await loadReferenceMetadata(referencesDir), {
    phase,
    routes: [route],
    paths: paths.length ? paths : undefined,
    assetKindRank: effectiveConfig?.knowledge?.asset_kind_rank,
  });
  const knowledge: KnowledgeSummary[] = result.selected.map((item) => ({
    file: basename(item.file),
    phase: item.phase,
    asset_kind: item.asset_kind,
    description: item.description,
  }));

  return {
    phase,
    title,
    reference: reference ?? `# ${title}\n\nReference 文件未找到。`,
    knowledge,
    route,
    skipped: false,
  };
}

export function formatPhaseBundleMarkdown(bundle: PhaseBundle): string {
  const lines = [`# Phase ${bundle.phase}: ${bundle.title}`, '', `**Route**: ${bundle.route}`, ''];
  if (bundle.skipped) {
    lines.push('> **此 Phase 已被当前 Route 跳过**', '>', `> ${bundle.skipReason}`, '');
    return lines.join('\n');
  }
  if (bundle.knowledge.length) {
    lines.push('## 相关知识', '');
    for (const item of bundle.knowledge) {
      lines.push(`- **${item.asset_kind}**: ${item.description}`);
    }
    lines.push('');
  }
  lines.push('## 执行指引', '', bundle.reference);
  return lines.join('\n');
}

export function formatPhaseBundleJson(bundle: PhaseBundle): string {
  return JSON.stringify(bundle, null, 2);
}
