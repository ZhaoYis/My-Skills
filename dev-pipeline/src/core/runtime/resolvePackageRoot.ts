import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';

const MARKERS = ['package.json', 'src/config/tools.json', 'src/templates/common/base/gitignore'];

export async function resolvePackageRoot(fromFileUrl: string): Promise<string> {
  let current = path.dirname(fileURLToPath(fromFileUrl));

  while (true) {
    const hasAll = await Promise.all(
      MARKERS.map((marker) => fs.pathExists(path.join(current, marker))),
    );
    if (hasAll.every(Boolean)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Failed to resolve package root.');
    }

    current = parent;
  }
}
