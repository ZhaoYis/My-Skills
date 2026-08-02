import path from 'node:path';
import prompts from 'prompts';
import {
  ALL_FEATURE_IDS,
  type DocLanguage,
  type FeatureId,
  type InstallScope,
  type StackId,
  type ToolAdapter,
  type ToolId,
} from '../adapters/types.js';
import type { InitAnswers, InitOptions } from '../prompts/types.js';
import {
  getTechStackById,
  getTechStacksByParentStack,
  resolveTechStackId,
} from '../tech-stack/registry.js';
import type { TechStackId } from '../tech-stack/types.js';

function assertTechStackMatchesParent(techStack: TechStackId, parentStack: StackId): void {
  const definition = getTechStackById(techStack);
  if (definition?.parentStack !== parentStack) {
    throw new Error(
      `Tech stack ${techStack} is not valid for stack ${parentStack}. Valid: ${getTechStacksByParentStack(
        parentStack,
      )
        .map(({ id }) => id)
        .join(', ')}.`,
    );
  }
}

function resolveFeatures(option: InitOptions['feature']): FeatureId[] {
  const requested = option === undefined ? [] : Array.isArray(option) ? option : [option];
  const normalized = requested.map((value) => String(value).trim()).filter(Boolean);
  const unknown = normalized.filter(
    (value) => !(ALL_FEATURE_IDS as readonly string[]).includes(value),
  );

  if (unknown.length > 0) {
    throw new Error(
      `Unknown feature(s): ${unknown.join(', ')}. Valid features: ${ALL_FEATURE_IDS.join(', ')}.`,
    );
  }

  // All features are default features; no optional features remain
  return [...ALL_FEATURE_IDS];
}

export function resolveDocLanguage(value: unknown): DocLanguage | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'en' && value !== 'zh') {
    throw new Error(`Invalid language: ${String(value)}. Valid languages: en, zh.`);
  }

  return value;
}

function resolveScope(value: unknown): InstallScope | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== 'user' && value !== 'project') {
    throw new Error(`Invalid scope: ${String(value)}. Valid scopes: user, project.`);
  }

  return value;
}

export async function collectInputs(
  targetDir: string,
  options: InitOptions,
  registry: Map<ToolId, ToolAdapter>,
): Promise<InitAnswers> {
  const defaultProjectName = path.basename(targetDir);
  const defaultTool = options.tool ?? 'claude';
  const requestedStack = options.stack;
  const requestedTechStack =
    options.techStack === undefined ? undefined : resolveTechStackId(options.techStack);
  const requestedLanguage = resolveDocLanguage(options.language);
  const defaultLanguage = requestedLanguage ?? 'zh';
  const requestedScope = resolveScope(options.scope);
  if (
    requestedStack !== undefined &&
    requestedStack !== 'frontend' &&
    requestedStack !== 'backend' &&
    requestedStack !== 'fullstack'
  ) {
    throw new Error(
      `Invalid stack: ${String(requestedStack)}. Valid stacks: frontend, backend, fullstack.`,
    );
  }
  if (requestedStack && requestedTechStack) {
    assertTechStackMatchesParent(requestedTechStack, requestedStack);
  }
  const features = resolveFeatures(options.feature);

  if (options.yes) {
    if (!requestedStack) {
      throw new Error(
        'Missing required --stack in non-interactive mode. Use --stack frontend, --stack backend, or --stack fullstack.',
      );
    }

    return {
      projectName: defaultProjectName,
      tool: defaultTool,
      stack: requestedStack,
      techStack: requestedTechStack,
      language: defaultLanguage,
      features,
      scope: requestedScope ?? 'project',
    };
  }

  const toolChoices = Array.from(registry.values()).map((adapter) => ({
    title: adapter.definition.displayName,
    description: adapter.definition.description,
    value: adapter.definition.id,
  }));

  const response = await prompts(
    [
      {
        type: 'text',
        name: 'projectName',
        message: 'Project name',
        initial: defaultProjectName,
      },
      {
        type: 'select',
        name: 'tool',
        message: 'Select your AI tool',
        choices: toolChoices,
        initial: toolChoices.findIndex((choice) => choice.value === defaultTool),
      },
      {
        type: 'select',
        name: 'stack',
        message: 'Select your project stack',
        choices: [
          { title: 'Backend', value: 'backend' satisfies StackId },
          { title: 'Frontend', value: 'frontend' satisfies StackId },
          { title: 'Fullstack', value: 'fullstack' satisfies StackId },
        ],
        initial: requestedStack === 'frontend' ? 1 : requestedStack === 'fullstack' ? 2 : 0,
      },
      {
        type: (_previous, values) =>
          getTechStacksByParentStack(values.stack as StackId).length > 0 ? 'select' : null,
        name: 'techStack',
        message: 'Select your tech stack',
        choices: (_previous, values) =>
          getTechStacksByParentStack(values.stack as StackId).map((techStack) => ({
            title: techStack.displayName,
            description: techStack.description,
            value: techStack.id,
          })),
        initial: (_previous, values) => {
          const choices = getTechStacksByParentStack(values.stack as StackId);
          const requestedIndex = choices.findIndex(({ id }) => id === requestedTechStack);
          return requestedIndex >= 0 ? requestedIndex : 0;
        },
      },
      {
        type: 'select',
        name: 'language',
        message: 'Select document language / 选择文档语言',
        choices: [
          { title: '中文 (Chinese)', value: 'zh' satisfies DocLanguage },
          { title: 'English', value: 'en' satisfies DocLanguage },
        ],
        initial: defaultLanguage === 'zh' ? 0 : 1,
      },
      {
        type: 'select',
        name: 'scope',
        message: 'Select install scope',
        choices: [
          { title: 'Project (./.claude/skills/)', value: 'project' satisfies InstallScope },
          { title: 'User (~/.claude/skills/)', value: 'user' satisfies InstallScope },
        ],
        initial: 0,
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  const stack = (response.stack ?? requestedStack ?? 'backend') as StackId;
  const techStack = (response.techStack ?? requestedTechStack) as TechStackId | undefined;
  if (techStack) {
    assertTechStackMatchesParent(techStack, stack);
  }

  return {
    projectName: response.projectName ?? defaultProjectName,
    tool: response.tool ?? defaultTool,
    stack,
    techStack,
    language: (response.language ?? defaultLanguage) as DocLanguage,
    features,
    scope: (response.scope ?? requestedScope ?? 'project') as InstallScope,
  };
}
