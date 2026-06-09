import path from 'node:path';
import prompts from 'prompts';
import type { FeatureId, ToolAdapter, ToolId } from '../adapters/types.js';
import type { InitAnswers, InitOptions } from '../prompts/types.js';

const DEFAULT_FEATURES = ['base', 'skills', 'commands', 'docs'] as const;
const OPTIONAL_FEATURES = ['prototype'] as const satisfies readonly FeatureId[];

function resolveFeatures(option: InitOptions['feature']): FeatureId[] {
  const requested = option === undefined ? [] : Array.isArray(option) ? option : [option];
  const optional = requested
    .map((value) => String(value).trim())
    .filter((value): value is FeatureId => (OPTIONAL_FEATURES as readonly string[]).includes(value));

  return Array.from(new Set<FeatureId>([...DEFAULT_FEATURES, ...optional]));
}

export async function collectInputs(
  targetDir: string,
  options: InitOptions,
  registry: Map<ToolId, ToolAdapter>
): Promise<InitAnswers> {
  const defaultProjectName = path.basename(targetDir);
  const defaultTool = options.tool ?? 'claude';
  const features = resolveFeatures(options.feature);

  if (options.yes) {
    return {
      projectName: defaultProjectName,
      tool: defaultTool,
      features
    };
  }

  const toolChoices = Array.from(registry.values()).map((adapter) => ({
    title: adapter.definition.displayName,
    description: adapter.definition.description,
    value: adapter.definition.id
  }));

  const response = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name',
      initial: defaultProjectName
    },
    {
      type: 'select',
      name: 'tool',
      message: 'Select your AI tool',
      choices: toolChoices,
      initial: toolChoices.findIndex((choice) => choice.value === defaultTool)
    },
    {
      type: 'confirm',
      name: 'enablePrototype',
      message: 'Enable opsx-prototype (optional prototype/screenshot skill)?',
      initial: features.includes('prototype')
    }
  ]);

  const resolvedFeatures = Array.from(new Set<FeatureId>([
    ...features,
    ...(response.enablePrototype ? ['prototype' as const] : [])
  ]));

  return {
    projectName: response.projectName ?? defaultProjectName,
    tool: response.tool ?? defaultTool,
    features: resolvedFeatures
  };
}
