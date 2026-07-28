import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('data access architecture boundary', () => {
  it('keeps Prisma delegate calls out of HTTP route modules', async () => {
    const routeDirectory = `${root}/src/api/routes`;
    const files = (await readdir(routeDirectory)).filter((name) => name.endsWith('.ts'));
    const violations = [];
    for (const file of files) {
      const source = await readFile(`${routeDirectory}/${file}`, 'utf8');
      if (/\bprisma\s*\.\s*[a-zA-Z_$]/.test(source)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it('does not restore unused one-line repository skeletons', async () => {
    const models = await readdir(`${root}/src/models`);
    expect(models.filter((name) => name.endsWith('.ts'))).toEqual([]);
  });
});
