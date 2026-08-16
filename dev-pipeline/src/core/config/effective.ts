import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ConfigSource, ConfigWithSource, EffectiveConfig } from './types.js';

export function deepMerge(...objects: Record<string, unknown>[]): Record<string, unknown> {
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
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

async function loadYamlFile(filePath: string): Promise<EffectiveConfig> {
  if (!existsSync(filePath)) return {};
  return (parseYaml(await readFile(filePath, 'utf8')) ?? {}) as EffectiveConfig;
}

export function loadDefaults(packageRoot: string): Promise<EffectiveConfig> {
  return loadYamlFile(join(packageRoot, 'config', 'defaults.yaml'));
}

export function loadProjectConfig(projectRoot: string): Promise<EffectiveConfig> {
  return loadYamlFile(join(projectRoot, 'openspec', 'config.yaml'));
}

export function loadOverrides(projectRoot: string): Promise<EffectiveConfig> {
  return loadYamlFile(join(projectRoot, 'openspec', 'overrides.yaml'));
}

export async function buildEffectiveConfig(
  projectRoot: string,
  packageRoot: string,
): Promise<ConfigWithSource> {
  const defaults = await loadDefaults(packageRoot);
  const projectConfig = await loadProjectConfig(projectRoot);
  const overrides = await loadOverrides(projectRoot);
  const config = deepMerge(
    defaults as Record<string, unknown>,
    projectConfig as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as EffectiveConfig;

  const sources = new Map<string, ConfigSource>();
  buildSourceMap(sources, defaults as Record<string, unknown>, 'defaults', 'config/defaults.yaml');
  buildSourceMap(sources, projectConfig as Record<string, unknown>, 'project', 'openspec/config.yaml');
  buildSourceMap(
    sources,
    overrides as Record<string, unknown>,
    'override',
    'openspec/overrides.yaml',
  );
  return { config, sources };
}

export async function writeEffectiveConfigAtomic(
  projectRoot: string,
  config: EffectiveConfig,
): Promise<string> {
  const target = join(projectRoot, 'openspec', '.effective-config.yaml');
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, stringifyYaml(config), 'utf8');
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return target;
}

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

export function explainConfigSource(sources: Map<string, ConfigSource>, key: string): string {
  const source = sources.get(key);
  return source ? `${key}: ${source.source} (${source.path})` : `${key}: (unknown)`;
}

export function formatSourcesExplanation(sources: Map<string, ConfigSource>): string {
  const lines: string[] = ['配置来源说明：', ''];
  const grouped = new Map<string, string[]>();
  for (const [key, source] of sources.entries()) {
    const keys = grouped.get(source.source) ?? [];
    keys.push(`  ${key} <- ${source.path}`);
    grouped.set(source.source, keys);
  }
  for (const [group, keys] of grouped.entries()) {
    lines.push(`[${group}]`, ...keys, '');
  }
  return lines.join('\n');
}
