import fs from 'fs-extra';
import path from 'node:path';
import type { ToolAdapter, ToolId } from '../adapters/types.js';

const SAFE_FILES = new Set(['.git', '.gitignore', 'README.md', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb']);

export interface TargetValidation {
  existingEntries: string[];
  suggestedTool?: ToolId;
}

export async function validateTarget(
  targetDir: string,
  registry: Map<ToolId, ToolAdapter>
): Promise<TargetValidation> {
  await fs.ensureDir(targetDir);
  const existingEntries = (await fs.readdir(targetDir)).filter((entry) => !SAFE_FILES.has(entry));

  let suggestedTool: ToolId | undefined;

  for (const [toolId, adapter] of registry.entries()) {
    for (const marker of adapter.detectFiles()) {
      if (await fs.pathExists(path.join(targetDir, marker))) {
        suggestedTool = toolId;
        break;
      }
    }

    if (suggestedTool) {
      break;
    }
  }

  return { existingEntries, suggestedTool };
}
