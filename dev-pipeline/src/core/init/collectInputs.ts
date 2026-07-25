import path from 'node:path';
import prompts from 'prompts';
import {
  ALL_FEATURE_IDS,
  type FeatureId,
  type StackId,
  type ToolAdapter,
  type ToolId,
} from '../adapters/types.js';
import type { InitAnswers, InitOptions } from '../prompts/types.js';

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

export async function collectInputs(
  targetDir: string,
  options: InitOptions,
  registry: Map<ToolId, ToolAdapter>,
): Promise<InitAnswers> {
  const defaultProjectName = path.basename(targetDir);
  const defaultTool = options.tool ?? 'claude';
  const requestedStack = options.stack;
  if (
    requestedStack !== undefined &&
    requestedStack !== 'frontend' &&
    requestedStack !== 'backend'
  ) {
    throw new Error(`Invalid stack: ${String(requestedStack)}. Valid stacks: frontend, backend.`);
  }
  const features = resolveFeatures(options.feature);

  if (options.yes) {
    if (!requestedStack) {
      throw new Error(
        'Missing required --stack in non-interactive mode. Use --stack frontend or --stack backend.',
      );
    }

    return {
      projectName: defaultProjectName,
      tool: defaultTool,
      stack: requestedStack,
      features,
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
          { title: 'Frontend', value: 'frontend' satisfies StackId },
          { title: 'Backend', value: 'backend' satisfies StackId },
        ],
        initial: requestedStack === 'frontend' ? 0 : 1,
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  return {
    projectName: response.projectName ?? defaultProjectName,
    tool: response.tool ?? defaultTool,
    stack: (response.stack ?? requestedStack ?? 'backend') as StackId,
    features,
  };
}
