import fs from 'fs-extra';
import path from 'node:path';

const MARKERS = ['package.json', 'config/tools.json', 'templates/common/base/README.md.hbs'];

export async function resolvePackageRoot(fromFileUrl: string): Promise<string> {
  let current = path.resolve(path.dirname(new URL(fromFileUrl).pathname));

  while (true) {
    const hasAll = await Promise.all(MARKERS.map((marker) => fs.pathExists(path.join(current, marker))));
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
