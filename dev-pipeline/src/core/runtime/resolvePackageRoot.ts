import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKERS = ['package.json', 'config/tools.json', 'templates/common/base/README.md.hbs'];

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
