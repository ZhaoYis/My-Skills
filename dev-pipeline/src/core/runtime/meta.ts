import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../package.json',
);
const packageJson = require(packageJsonPath) as Record<string, unknown>;

export const PACKAGE_NAME = 'opsx-dev-pipeline';
export const CLI_NAME = 'opsx-dev-pipeline';
export const CREATE_CLI_NAME = 'create-opsx-dev-pipeline';
export const PACKAGE_VERSION = packageJson.version as string;
export const PACKAGE_AUTHOR = packageJson.author as string | undefined;
export const PACKAGE_LICENSE = packageJson.license as string | undefined;
export const PACKAGE_REPO_URL = (packageJson.repository as Record<string, unknown> | undefined)
  ?.url as string | undefined;
export const PACKAGE_JSON_FILE = 'package.json';
export const MANIFEST_PACKAGE_JSON_KEY = 'opsxDevPipeline';
export const MANIFEST_FILE = 'opsx-dev-pipeline.json';
export const LEGACY_MANIFEST_FILE = 'dev-pipeline.json';
export const TEMPLATE_VERSION = PACKAGE_VERSION;
