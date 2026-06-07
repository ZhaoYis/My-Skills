import path from 'node:path';
import type { InstallFile } from '../assets/types.js';

const APPENDABLE_BASENAMES = new Set(['.gitignore', 'CLAUDE.md']);
const APPENDABLE_EXTENSIONS = new Set(['.md', '.mdc', '.txt']);

export function isAppendableInstallFile(file: Pick<InstallFile, 'kind' | 'destinationPath'>): boolean {
  if (file.kind !== 'template') {
    return false;
  }

  const basename = path.basename(file.destinationPath);
  if (APPENDABLE_BASENAMES.has(basename)) {
    return true;
  }

  return APPENDABLE_EXTENSIONS.has(path.extname(file.destinationPath));
}
