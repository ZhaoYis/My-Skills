/**
 * Knowledge 两阶段加载模块
 * 第一阶段：CLI 基于元数据过滤
 * 第二阶段：AI 判断是否打开正文
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type {
  KnowledgeMetadata,
  KnowledgeSelectOptions,
  KnowledgeSelectResult,
  KnowledgeSelection,
  KnowledgeSkip,
} from './types.js';

/**
 * 从 markdown 文件中解析 frontmatter
 */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  const result: Record<string, unknown> = {};

  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    // 解析数组 [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else {
      // 解析标量值
      result[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return result;
}

/**
 * 加载所有 reference 文档的元数据
 */
export async function loadReferenceMetadata(referencesDir: string): Promise<KnowledgeMetadata[]> {
  const metadata: KnowledgeMetadata[] = [];

  try {
    const files = await readdir(referencesDir);

    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.md.hbs')) continue;

      const filePath = join(referencesDir, file);
      const content = await readFile(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.phase === undefined) continue;

      metadata.push({
        file: filePath,
        phase: Number(frontmatter.phase),
        asset_kind: String(frontmatter.asset_kind || 'procedure'),
        routes: Array.isArray(frontmatter.routes) ? frontmatter.routes : ['standard'],
        path_hints: Array.isArray(frontmatter.path_hints) ? frontmatter.path_hints : [],
        description: String(frontmatter.description || ''),
      });
    }
  } catch {
    // 目录不存在时返回空数组
  }

  return metadata;
}

/**
 * 简单的 glob 匹配
 */
function globMatch(pattern: string, path: string): boolean {
  // 将 glob 模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * 检查路径是否匹配任何 path_hints
 */
function matchesPathHints(pathHints: string[], paths: string[]): boolean {
  if (pathHints.length === 0) return true; // 没有 path_hints 时默认匹配
  if (paths.length === 0) return true; // 没有提供 paths 时默认匹配

  return paths.some((path) => pathHints.some((hint) => globMatch(hint, path)));
}

/**
 * 根据选项选择 Knowledge
 */
export function selectKnowledge(
  metadata: KnowledgeMetadata[],
  options: KnowledgeSelectOptions,
): KnowledgeSelectResult {
  const selected: KnowledgeSelection[] = [];
  const skipped: KnowledgeSkip[] = [];

  for (const ref of metadata) {
    // Phase 过滤
    if (ref.phase !== options.phase) {
      skipped.push({ file: ref.file, reason: `phase ${ref.phase} not matched (expected ${options.phase})` });
      continue;
    }

    // Route 过滤
    if (options.routes && options.routes.length > 0) {
      const hasMatchingRoute = ref.routes.some((r) => options.routes!.includes(r));
      if (!hasMatchingRoute) {
        skipped.push({
          file: ref.file,
          reason: `routes [${ref.routes.join(', ')}] not matched (expected [${options.routes.join(', ')}])`,
        });
        continue;
      }
    }

    // Path 过滤
    if (options.paths && options.paths.length > 0) {
      if (!matchesPathHints(ref.path_hints, options.paths)) {
        skipped.push({
          file: ref.file,
          reason: `path_hints not matched for paths [${options.paths.join(', ')}]`,
        });
        continue;
      }
    }

    // 通过所有过滤条件
    selected.push({
      file: ref.file,
      phase: ref.phase,
      asset_kind: ref.asset_kind,
      description: ref.description,
      match_reason: 'phase/route/paths matched',
    });
  }

  // 按 asset_kind 排序
  const assetKindRank = ['constraint', 'procedure', 'principle', 'convention'];
  selected.sort((a, b) => {
    const aIndex = assetKindRank.indexOf(a.asset_kind);
    const bIndex = assetKindRank.indexOf(b.asset_kind);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return { selected, skipped };
}

/**
 * 格式化 Knowledge 选择结果为 YAML
 */
export function formatKnowledgeSelectResult(result: KnowledgeSelectResult): string {
  const lines: string[] = ['selected:'];

  if (result.selected.length === 0) {
    lines.push('  []');
  } else {
    for (const item of result.selected) {
      lines.push(`  - file: ${item.file}`);
      lines.push(`    phase: ${item.phase}`);
      lines.push(`    asset_kind: ${item.asset_kind}`);
      lines.push(`    description: "${item.description}"`);
      lines.push(`    match_reason: "${item.match_reason}"`);
    }
  }

  lines.push('skipped:');
  if (result.skipped.length === 0) {
    lines.push('  []');
  } else {
    for (const item of result.skipped) {
      lines.push(`  - file: ${item.file}`);
      lines.push(`    reason: "${item.reason}"`);
    }
  }

  return lines.join('\n');
}
