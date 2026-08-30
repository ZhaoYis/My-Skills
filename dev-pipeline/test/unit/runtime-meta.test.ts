import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLI_NAME,
  CREATE_CLI_NAME,
  LEGACY_MANIFEST_FILE,
  MANIFEST_FILE,
  MANIFEST_PACKAGE_JSON_KEY,
  PACKAGE_AUTHOR,
  PACKAGE_JSON_FILE,
  PACKAGE_LICENSE,
  PACKAGE_NAME,
  PACKAGE_REPO_URL,
  PACKAGE_VERSION,
  TEMPLATE_VERSION,
} from '../../src/core/runtime/meta.js';
import { PACKAGE_ROOT } from '../helpers/package-root.js';
import fs from 'fs-extra';

describe('runtime meta constants', () => {
  it('declares the package identity constants', () => {
    expect(PACKAGE_NAME).toBe('opsx-dev-pipeline');
    expect(CLI_NAME).toBe('opsx-dev-pipeline');
    expect(CREATE_CLI_NAME).toBe('create-opsx-dev-pipeline');
    expect(PACKAGE_JSON_FILE).toBe('package.json');
  });

  it('declares the manifest filenames and manifest package.json key', () => {
    expect(MANIFEST_FILE).toBe('opsx-dev-pipeline.json');
    expect(LEGACY_MANIFEST_FILE).toBe('dev-pipeline.json');
    expect(MANIFEST_PACKAGE_JSON_KEY).toBe('opsxDevPipeline');
  });

  it('reads the version, license, author, and repository from package.json', async () => {
    const packageJson = (await fs.readJson(path.join(PACKAGE_ROOT, 'package.json'))) as Record<
      string,
      unknown
    >;

    expect(typeof PACKAGE_VERSION).toBe('string');
    expect(PACKAGE_VERSION).toBe(packageJson.version);
    expect(PACKAGE_LICENSE).toBe(packageJson.license);
    expect(PACKAGE_AUTHOR).toBe(packageJson.author);
    expect(PACKAGE_REPO_URL).toBe((packageJson.repository as { url?: string } | undefined)?.url);
    expect(TEMPLATE_VERSION).toBe(PACKAGE_VERSION);
  });
});
