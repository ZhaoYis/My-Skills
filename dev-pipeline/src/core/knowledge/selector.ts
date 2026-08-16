import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  KnowledgeMetadata,
  KnowledgeSelectOptions,
  KnowledgeSelectResult,
} from './types.js';

const DEFAULT_ASSET_KIND_RANK = ['constraint', 'procedure', 'principle', 'convention'];

function parseFrontmatter(content: string): Record<string, unknown> {
  const normalized = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return {};
  const parsed = parseYaml(match[1]);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value) ? value.map(String) : fallback;
}

export async function loadReferenceMetadata(referencesDir: string): Promise<KnowledgeMetadata[]> {
  const metadata: KnowledgeMetadata[] = [];
  try {
    const files = (await readdir(referencesDir)).sort();
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.md.hbs')) continue;
      const frontmatter = parseFrontmatter(await readFile(join(referencesDir, file), 'utf8'));
      if (frontmatter.phase === undefined) continue;
      metadata.push({
        file,
        phase: Number(frontmatter.phase),
        asset_kind: String(frontmatter.asset_kind ?? 'procedure'),
        routes: toStringArray(frontmatter.routes, ['standard']),
        path_hints: toStringArray(frontmatter.path_hints),
        description: String(frontmatter.description ?? ''),
      });
    }
  } catch {
    // Missing reference directories contain no selectable knowledge.
  }
  return metadata;
}

function globMatch(pattern: string, candidate: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(candidate.replace(/\\/g, '/'));
}

function matchesPathHints(pathHints: string[], paths: string[]): boolean {
  if (pathHints.length === 0 || paths.length === 0) return true;
  return paths.some((candidate) => pathHints.some((hint) => globMatch(hint, candidate)));
}

export function selectKnowledge(
  metadata: KnowledgeMetadata[],
  options: KnowledgeSelectOptions,
): KnowledgeSelectResult {
  const selected: KnowledgeSelectResult['selected'] = [];
  const skipped: KnowledgeSelectResult['skipped'] = [];

  for (const ref of metadata) {
    let reason: string | undefined;
    if (ref.phase !== options.phase) {
      reason = `phase ${ref.phase} not matched (expected ${options.phase})`;
    } else if (
      options.routes?.length &&
      !ref.routes.some((route) => options.routes?.includes(route))
    ) {
      reason = `routes [${ref.routes.join(', ')}] not matched (expected [${options.routes.join(', ')}])`;
    } else if (options.paths?.length && !matchesPathHints(ref.path_hints, options.paths)) {
      reason = `path_hints not matched for paths [${options.paths.join(', ')}]`;
    }

    if (reason) {
      skipped.push({ file: basename(ref.file), reason });
    } else {
      selected.push({
        file: basename(ref.file),
        phase: ref.phase,
        asset_kind: ref.asset_kind,
        description: ref.description,
        match_reason: 'phase/route/paths matched',
      });
    }
  }

  const rank = options.assetKindRank ?? DEFAULT_ASSET_KIND_RANK;
  selected.sort((a, b) => {
    const left = rank.indexOf(a.asset_kind);
    const right = rank.indexOf(b.asset_kind);
    return (left < 0 ? Number.MAX_SAFE_INTEGER : left) -
      (right < 0 ? Number.MAX_SAFE_INTEGER : right) || a.file.localeCompare(b.file);
  });
  return { selected, skipped };
}

export function formatKnowledgeSelectResult(result: KnowledgeSelectResult): string {
  return stringifyYaml(result);
}
