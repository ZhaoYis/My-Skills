import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDirectories } from '../helpers/cleanup.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';

const libUrl = pathToFileURL(
  path.join(PACKAGE_ROOT, 'src/templates/common/skills/opsx-dev-pipeline/scripts/pipeline-lib.mjs'),
).href;
const createdDirs: string[] = [];
let repo = '';

interface ModuleResult {
  code: number;
  stdout: string;
  stderr: string;
}

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-route-config-'));
  createdDirs.push(repo);
});

afterEach(async () => {
  await cleanupDirectories(createdDirs);
});

function runModule(source: string): Promise<ModuleResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--input-type=module', '--eval', source], { cwd: repo }, (error, stdout, stderr) => {
      const code = error && 'code' in error && typeof error.code === 'number' ? error.code : 0;
      resolve({ code, stdout, stderr });
    });
  });
}

describe('Route Config Validation', () => {
  describe('validateRouteConfig', () => {
    it('accepts valid route configuration', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        const routes = {
          trivial: { description: '无行为变化的极小变更', phases: [0, 2, 6] },
          standard: { description: '标准变更', phases: [0, 1, 2, 5, 6] },
          full: { description: '高保障变更', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
        };
        validateRouteConfig(routes);
        process.stdout.write('ok');
      `);

      expect(result.code).toBe(0);
      expect(result.stdout).toBe('ok');
    });

    it('rejects route with phases outside 0-7 range', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        validateRouteConfig({ invalid: { description: 'Invalid route', phases: [0, 8, 6] } });
      `);

      expect(result.code).toBe(4);
      expect(JSON.parse(result.stdout).reason).toBe('invalid-route-config');
    });

    it('rejects route missing Phase 0', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        validateRouteConfig({ invalid: { description: 'Invalid route', phases: [1, 2, 6] } });
      `);

      expect(result.code).toBe(4);
      expect(JSON.parse(result.stdout).reason).toBe('invalid-route-config');
    });

    it('rejects route missing Phase 6', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        validateRouteConfig({ invalid: { description: 'Invalid route', phases: [0, 1, 2] } });
      `);

      expect(result.code).toBe(4);
      expect(JSON.parse(result.stdout).reason).toBe('invalid-route-config');
    });

    it('rejects route with non-array phases', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        validateRouteConfig({ invalid: { description: 'Invalid route', phases: 'not-an-array' } });
      `);

      expect(result.code).toBe(4);
      expect(JSON.parse(result.stdout).reason).toBe('invalid-route-config');
    });

    it('rejects route with non-integer phases', async () => {
      const result = await runModule(`
        import { validateRouteConfig } from ${JSON.stringify(libUrl)};
        validateRouteConfig({ invalid: { description: 'Invalid route', phases: [0, 1.5, 6] } });
      `);

      expect(result.code).toBe(4);
      expect(JSON.parse(result.stdout).reason).toBe('invalid-route-config');
    });
  });

  describe('getRoutePhases', () => {
    it('returns phases for valid route', async () => {
      const result = await runModule(`
        import { getRoutePhases } from ${JSON.stringify(libUrl)};
        const routes = {
          trivial: { description: '无行为变化的极小变更', phases: [0, 2, 6] },
          standard: { description: '标准变更', phases: [0, 1, 2, 5, 6] },
          full: { description: '高保障变更', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
        };
        process.stdout.write(JSON.stringify({
          trivial: getRoutePhases('trivial', routes),
          standard: getRoutePhases('standard', routes),
          full: getRoutePhases('full', routes),
        }));
      `);

      expect(result.code).toBe(0);
      const phases = JSON.parse(result.stdout);
      expect(phases.trivial).toEqual([0, 2, 6]);
      expect(phases.standard).toEqual([0, 1, 2, 5, 6]);
      expect(phases.full).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('returns full route phases for unknown route', async () => {
      const result = await runModule(`
        import { getRoutePhases } from ${JSON.stringify(libUrl)};
        const routes = {
          full: { description: '高保障变更', phases: [0, 1, 2, 3, 4, 5, 6, 7] },
        };
        process.stdout.write(JSON.stringify(getRoutePhases('unknown', routes)));
      `);

      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });
});
