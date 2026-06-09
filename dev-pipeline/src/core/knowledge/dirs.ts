import fs from 'fs-extra';
import path from 'node:path';

export const KNOWLEDGE_DIR_CANDIDATES = [
  '.knowledge',
  'docs/knowledge',
  'knowledge',
  'docs/domain'
] as const;

export type KnowledgeDirCandidate = (typeof KNOWLEDGE_DIR_CANDIDATES)[number];

export interface ResolvedKnowledgeDirectory {
  path: string;
  relative: KnowledgeDirCandidate;
}

export async function hasExistingKnowledgeDirectory(targetDir: string): Promise<boolean> {
  return (await resolveKnowledgeDirectory(targetDir)) !== null;
}

export async function resolveKnowledgeDirectory(
  targetDir: string
): Promise<ResolvedKnowledgeDirectory | null> {
  for (const candidate of KNOWLEDGE_DIR_CANDIDATES) {
    const fullPath = path.join(targetDir, candidate);
    if (await fs.pathExists(fullPath)) {
      return { path: fullPath, relative: candidate };
    }
  }

  return null;
}
