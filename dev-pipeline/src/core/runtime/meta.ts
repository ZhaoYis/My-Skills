import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../package.json');
const packageJson = require(packageJsonPath) as { version: string };

export const PACKAGE_NAME = 'opsx-dev-pipeline';
export const CLI_NAME = 'opsx-dev-pipeline';
export const CREATE_CLI_NAME = 'create-opsx-dev-pipeline';
export const PACKAGE_VERSION = packageJson.version;
export const PACKAGE_JSON_FILE = 'package.json';
export const MANIFEST_PACKAGE_JSON_KEY = 'opsxDevPipeline';
export const MANIFEST_FILE = 'opsx-dev-pipeline.json';
export const LEGACY_MANIFEST_FILE = 'dev-pipeline.json';
export const TEMPLATE_VERSION = PACKAGE_VERSION;
export const HERMES_RUNTIME_FILE = 'openspec/hermes-runtime.json';
export const HERMES_DECISIONS_FILE = 'openspec/hermes-decisions.jsonl';
export const HERMES_SKILL_MEMORY_FILE = '.knowledge/hermes-skill-memory.json';
