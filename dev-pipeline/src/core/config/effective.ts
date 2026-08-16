/**
 * 有效配置合成模块
 * 实现多层配置级联：包内默认 → 项目事实 → 项目覆写 → 合成有效配置
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { EffectiveConfig, ConfigSource, ConfigWithSource } from './types.js';
import { resolvePackageRoot } from '../runtime/resolvePackageRoot.js';

/**
 * 深度合并多个配置对象
 * 后面的配置会覆盖前面的配置
 */
export function deepMerge<T extends Record<string, unknown>>(...objects: Partial<T>[]): T {
  const result = {} as Record<string, unknown>;

  for (const obj of objects) {
    if (!obj) continue;

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
  }

  return result as T;
}

/**
 * 加载包内默认配置
 */
export async function loadDefaults(packageRoot: string): Promise<EffectiveConfig> {
  const defaultsPath = join(packageRoot, 'config', 'defaults.yaml');

  if (!existsSync(defaultsPath)) {
    return {};
  }

  const content = await readFile(defaultsPath, 'utf-8');
  return parseYaml(content) as EffectiveConfig;
}

/**
 * 加载项目配置（openspec/config.yaml）
 */
export async function loadProjectConfig(projectRoot: string): Promise<EffectiveConfig> {
  const configPath = join(projectRoot, 'openspec', 'config.yaml');

  if (!existsSync(configPath)) {
    return {};
  }

  const content = await readFile(configPath, 'utf-8');
  return parseYaml(content) as EffectiveConfig;
}

/**
 * 加载项目覆写（openspec/overrides.yaml）
 */
export async function loadOverrides(projectRoot: string): Promise<EffectiveConfig> {
  const overridesPath = join(projectRoot, 'openspec', 'overrides.yaml');

  if (!existsSync(overridesPath)) {
    return {};
  }

  const content = await readFile(overridesPath, 'utf-8');
  return parseYaml(content) as EffectiveConfig;
}

/**
 * 合成有效配置，带来源标注
 */
export async function buildEffectiveConfig(
  projectRoot: string,
  packageRoot: string,
): Promise<ConfigWithSource> {
  const defaults = await loadDefaults(packageRoot);
  const projectConfig = await loadProjectConfig(projectRoot);
  const overrides = await loadOverrides(projectRoot);

  // 合成配置
  const config = deepMerge(
    defaults as Record<string, unknown>,
    projectConfig as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as EffectiveConfig;

  // 构建来源映射
  const sources = new Map<string, ConfigSource>();
  buildSourceMap(sources, defaults as Record<string, unknown>, 'defaults', 'config/defaults.yaml');
  buildSourceMap(sources, projectConfig as Record<string, unknown>, 'project', 'openspec/config.yaml');
  buildSourceMap(sources, overrides as Record<string, unknown>, 'override', 'openspec/overrides.yaml');

  return { config, sources };
}

/**
 * 递归构建配置来源映射
 */
function buildSourceMap(
  sources: Map<string, ConfigSource>,
  obj: Record<string, unknown>,
  source: ConfigSource['source'],
  path: string,
  prefix = '',
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      buildSourceMap(sources, value as Record<string, unknown>, source, path, fullPath);
    } else {
      sources.set(fullPath, { source, path });
    }
  }
}

/**
 * 获取配置项的来源说明
 */
export function explainConfigSource(sources: Map<string, ConfigSource>, key: string): string {
  const source = sources.get(key);
  if (!source) {
    return `${key}: (unknown)`;
  }
  return `${key}: ${source.source} (${source.path})`;
}

/**
 * 格式化配置来源说明
 */
export function formatSourcesExplanation(sources: Map<string, ConfigSource>): string {
  const lines: string[] = ['配置来源说明：', ''];

  const grouped = new Map<string, string[]>();
  for (const [key, source] of sources.entries()) {
    const group = source.source;
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }
    grouped.get(group)!.push(`  ${key} <- ${source.path}`);
  }

  for (const [group, keys] of grouped.entries()) {
    lines.push(`[${group}]`);
    lines.push(...keys);
    lines.push('');
  }

  return lines.join('\n');
}
