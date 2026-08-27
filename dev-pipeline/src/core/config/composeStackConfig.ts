import path from 'node:path';
import fs from 'fs-extra';
import type { DocLanguage, StackId } from '../adapters/types.js';
import { renderString, renderTemplate } from '../init/renderTemplates.js';
import { getTechStackById } from '../tech-stack/registry.js';
import type { TechStackId } from '../tech-stack/types.js';
import { formatRuleGroups, mergeRuleGroups, parseRuleYaml } from './parseRuleYaml.js';
import {
  DEFAULT_STACK_LANGUAGES,
  PROGRAMMING_LANGUAGE_REGISTRY,
  RULE_CATEGORY_ORDER,
} from './programmingLanguages.js';
import type { ProgrammingLanguageId } from './types.js';

const ROLE_PREFIX: Record<DocLanguage, Record<'backend' | 'frontend', string>> = {
  zh: { backend: '【后端】', frontend: '【前端】' },
  en: { backend: '[Backend] ', frontend: '[Frontend] ' },
};

const PROJECT_TYPE: Record<StackId, string> = {
  backend: 'Backend Service',
  frontend: 'Frontend Application',
  fullstack: 'Fullstack Application',
};

export interface ComposeStackConfigInput {
  configRoot: string;
  stack: StackId;
  techStack?: TechStackId;
  language: DocLanguage;
  context: Record<string, unknown>;
}

export function resolveProgrammingLanguages(
  stack: StackId,
  techStack?: TechStackId,
): ProgrammingLanguageId[] {
  if (techStack) {
    const definition = getTechStackById(techStack);
    if (definition) {
      return definition.programmingLanguages;
    }
  }
  return DEFAULT_STACK_LANGUAGES[stack];
}

export function resolveConfigRootFromSkeleton(skeletonPath: string): string {
  return path.dirname(path.dirname(skeletonPath));
}

function joinBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trimEnd())
    .filter((block) => block.length > 0)
    .join('\n');
}

function prefixConventionLines(text: string, prefix: string): string {
  if (!prefix) {
    return text;
  }

  // Normalize CRLF to LF so the regex below works on Windows.
  const normalized = text.replaceAll('\r\n', '\n');
  return normalized
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*-\s*)(.*)$/);
      return match ? `${match[1]}${prefix}${match[2]}` : line;
    })
    .join('\n');
}

function applyHeadlineKey(block: string, key: string): string {
  // Normalize CRLF to LF so the regex below works on Windows.
  const normalized = block.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  const index = lines.findIndex((line) => line.trim().length > 0);
  if (index < 0) {
    return normalized;
  }

  const line = lines[index] ?? '';
  const match = line.match(/^(\s*)(.*)$/);
  if (!match) {
    return normalized;
  }

  lines[index] = `${match[1]}${key}: ${match[2]}`;
  return lines.join('\n');
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  if (!(await fs.pathExists(filePath))) {
    return undefined;
  }
  return fs.readFile(filePath, 'utf8');
}

async function renderLocalizedFragment(
  directory: string,
  basename: string,
  language: DocLanguage,
  context: Record<string, unknown>,
): Promise<string> {
  const localizedPath = path.join(directory, `${basename}.${language}.md.hbs`);
  const fallbackPath = path.join(directory, `${basename}.md.hbs`);
  const filePath = (await fs.pathExists(localizedPath)) ? localizedPath : fallbackPath;
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Missing config fragment: ${localizedPath}`);
  }
  return renderTemplate(filePath, context);
}

async function renderOptionalTemplate(
  filePath: string,
  context: Record<string, unknown>,
): Promise<string> {
  if (!(await fs.pathExists(filePath))) {
    return '';
  }
  return renderTemplate(filePath, context);
}

export async function composeStackConfig(input: ComposeStackConfigInput): Promise<string> {
  const fragmentsRoot = path.join(input.configRoot, 'fragments');
  const languages = resolveProgrammingLanguages(input.stack, input.techStack);
  const labeled = languages.length > 1;
  const languageDefs = languages.map((id) => PROGRAMMING_LANGUAGE_REGISTRY[id]);

  const docLanguageBlock = await renderLocalizedFragment(
    path.join(fragmentsRoot, 'common'),
    'doc-language',
    input.language,
    input.context,
  );

  const conventionBlocks = await Promise.all(
    languageDefs.map(async (language) => {
      const block = await renderLocalizedFragment(
        path.join(fragmentsRoot, 'languages', language.id),
        'conventions',
        input.language,
        input.context,
      );
      const prefix = labeled ? ROLE_PREFIX[input.language][language.role] : '';
      return prefixConventionLines(block, prefix);
    }),
  );

  const includeUi = languageDefs.some((language) => language.role === 'frontend');
  const uiBlock = includeUi
    ? await renderOptionalTemplate(
        path.join(fragmentsRoot, 'common', 'ui-hammer.md.hbs'),
        input.context,
      )
    : '';

  const projectInfoBlocks = await Promise.all(
    languageDefs.map(async (language) => {
      const block = await renderOptionalTemplate(
        path.join(fragmentsRoot, 'languages', language.id, 'project-info.md.hbs'),
        input.context,
      );
      const headlineKey = labeled
        ? language.role === 'frontend'
          ? 'Frontend'
          : 'Backend'
        : 'Tech Stack';
      return applyHeadlineKey(block, headlineKey);
    }),
  );
  const stackProjectInfo = await renderOptionalTemplate(
    path.join(fragmentsRoot, 'stacks', input.stack, 'project-info.md.hbs'),
    input.context,
  );

  const rulePacks = await Promise.all([
    ...languageDefs.map(async (language) => {
      const text = await readOptionalFile(
        path.join(fragmentsRoot, 'languages', language.id, 'rules.yaml'),
      );
      return text ? parseRuleYaml(text) : {};
    }),
    (async () => {
      const text = await readOptionalFile(
        path.join(fragmentsRoot, 'stacks', input.stack, 'rules.yaml'),
      );
      return text ? parseRuleYaml(text) : {};
    })(),
  ]);

  const stackBlock = await renderOptionalTemplate(
    path.join(fragmentsRoot, 'stacks', input.stack, 'stack.yaml.hbs'),
    {
      ...input.context,
      languagesCsv: languages.join(', '),
    },
  );

  const pipelineBlock = await renderOptionalTemplate(
    path.join(fragmentsRoot, 'common', 'pipeline.yaml.hbs'),
    input.context,
  );

  const skeletonPath = path.join(fragmentsRoot, 'skeleton.yaml.hbs');
  const skeleton = await fs.readFile(skeletonPath, 'utf8');
  const rendered = renderString(skeleton, {
    ...input.context,
    stack: input.stack,
    projectType: PROJECT_TYPE[input.stack],
    docLanguageBlock: docLanguageBlock.trimEnd(),
    conventionsBlock: joinBlocks(conventionBlocks),
    uiBlock: uiBlock.trimEnd(),
    projectInfoBlock: joinBlocks([...projectInfoBlocks, stackProjectInfo]),
    stackBlock: stackBlock.trimEnd(),
    rulesBlock: formatRuleGroups(mergeRuleGroups(rulePacks), RULE_CATEGORY_ORDER),
    pipelineBlock: pipelineBlock.trimEnd(),
  });

  return `${rendered.trimEnd()}\n`;
}
