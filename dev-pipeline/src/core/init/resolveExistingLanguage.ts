import path from 'node:path';
import fs from 'fs-extra';
import prompts from 'prompts';
import type { DocLanguage } from '../adapters/types.js';
import type { PipelineManifest } from '../manifest/types.js';
import type { InitOptions } from '../prompts/types.js';
import { resolveDocLanguage } from './collectInputs.js';

export interface ExistingLanguageSelection {
  language: DocLanguage;
  configNeedsUpdate: boolean;
}

export async function readConfigLanguage(targetDir: string): Promise<DocLanguage | undefined> {
  const configPath = path.join(targetDir, 'openspec', 'config.yaml');
  if (!(await fs.pathExists(configPath))) {
    return undefined;
  }

  const content = await fs.readFile(configPath, 'utf8');
  const match = content.match(/^language:\s*["']?(en|zh)["']?\s*(?:#.*)?$/m);
  return match?.[1] as DocLanguage | undefined;
}

export async function collectExistingLanguage(
  targetDir: string,
  options: InitOptions,
  manifest: PipelineManifest,
): Promise<ExistingLanguageSelection> {
  const requestedLanguage = resolveDocLanguage(options.language);
  const configLanguage = await readConfigLanguage(targetDir);
  const currentLanguage = manifest.language ?? configLanguage;
  const hasMissingStorage = manifest.language === undefined || configLanguage === undefined;

  let language = requestedLanguage ?? currentLanguage ?? 'zh';
  if (!requestedLanguage && !options.yes && hasMissingStorage) {
    const response = await prompts(
      {
        type: 'select',
        name: 'language',
        message: 'Select document language / 选择文档语言',
        choices: [
          { title: '中文 (Chinese)', value: 'zh' satisfies DocLanguage },
          { title: 'English', value: 'en' satisfies DocLanguage },
        ],
        initial: language === 'zh' ? 0 : 1,
      },
      { onCancel: () => process.exit(1) },
    );
    language = (response.language ?? language) as DocLanguage;
  }

  return {
    language,
    configNeedsUpdate: configLanguage !== language,
  };
}
