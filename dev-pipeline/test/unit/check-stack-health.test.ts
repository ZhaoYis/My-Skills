import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { checkStackHealth } from '../../src/core/doctor/checkStackHealth.js';

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((dir) => fs.remove(dir)));
});

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opsx-check-stack-health-'));
  createdDirs.push(dir);
  return dir;
}

async function writeConfig(dir: string, content: string): Promise<void> {
  const configDir = path.join(dir, 'openspec');
  await fs.ensureDir(configDir);
  await fs.writeFile(path.join(configDir, 'config.yaml'), content);
}

describe('checkStackHealth', () => {
  it('returns valid: false when config.yaml is missing', async () => {
    const dir = await createTempDir();

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(false);
    expect(result.stackFound).toBe(false);
    expect(result.configPath).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toBe('openspec/config.yaml not found');
  });

  it('returns error when config has no stack section', async () => {
    const dir = await createTempDir();
    await writeConfig(dir, 'schema: frontend\n');

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(false);
    expect(result.stackFound).toBe(false);
    expect(result.issues.some((i) => i.message === 'No stack section found')).toBe(true);
  });

  it('returns error when stack.id is missing', async () => {
    const dir = await createTempDir();
    await writeConfig(dir, 'stack:\n  services: [api]\n');

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(false);
    expect(result.stackFound).toBe(true);
    expect(result.issues.some((i) => i.message === 'stack.id is required')).toBe(true);
  });

  it('returns valid: true for a config with stack id and inline services', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: fullstack-web
  languages: [typescript]
  services: [api]
`,
    );

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(true);
    expect(result.stackFound).toBe(true);
    expect(result.stackId).toBe('fullstack-web');
    expect(result.serviceCount).toBe(1);
  });

  it('returns valid: true for a config with multiple inline services', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: fullstack-web
  languages: [typescript, python]
  services: [api, web, worker]
`,
    );

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(true);
    expect(result.stackFound).toBe(true);
    expect(result.stackId).toBe('fullstack-web');
    expect(result.serviceCount).toBe(3);
  });

  it('returns error when no services are declared', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: fullstack-web
  languages: [typescript]
`,
    );

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message === 'At least one service is required')).toBe(true);
  });

  it('returns warning when languages array is empty or missing', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: fullstack-web
  services: [api]
`,
    );

    const result = await checkStackHealth(dir);

    // valid because only a warning, not an error
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.message === 'No languages declared')).toBe(true);
  });

  it('returns valid: true for a minimal valid config', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: my-stack
  services: [svc1]
`,
    );

    const result = await checkStackHealth(dir);

    expect(result.valid).toBe(true);
    expect(result.stackFound).toBe(true);
    expect(result.stackId).toBe('my-stack');
    expect(result.serviceCount).toBe(1);
  });

  it('includes a configPath when the file exists', async () => {
    const dir = await createTempDir();
    await writeConfig(
      dir,
      `stack:
  id: test
  services: [one]
`,
    );

    const result = await checkStackHealth(dir);

    expect(result.configPath).toBe(path.join(dir, 'openspec', 'config.yaml'));
    expect(result.valid).toBe(true);
  });
});
