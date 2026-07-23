import path from 'node:path';
import prompts from 'prompts';
import {
  ALL_FEATURE_IDS,
  DEFAULT_FEATURES,
  OPTIONAL_FEATURES,
  type FeatureId,
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
      `Unknown feature(s): ${unknown.join(', ')}. Valid optional features: ${OPTIONAL_FEATURES.join(', ')}.`,
    );
  }

  const optional = normalized.filter((value): value is FeatureId =>
    (OPTIONAL_FEATURES as readonly string[]).includes(value),
  );

  return Array.from(new Set<FeatureId>([...DEFAULT_FEATURES, ...optional]));
}

export async function collectInputs(
  targetDir: string,
  options: InitOptions,
  registry: Map<ToolId, ToolAdapter>,
): Promise<InitAnswers> {
  const defaultProjectName = path.basename(targetDir);
  const defaultTool = options.tool ?? 'claude';
  const features = resolveFeatures(options.feature);

  if (options.yes) {
    return {
      projectName: defaultProjectName,
      tool: defaultTool,
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
        type: 'confirm',
        name: 'enableStructuralAnalysisHint',
        message:
          'Enable structural-analysis-hint (prefer code graph / LSP over plain text search)?',
        initial: features.includes('structural-analysis-hint'),
      },
    ],
    { onCancel: () => process.exit(1) },
  );

  const resolvedFeatures = Array.from(
    new Set<FeatureId>([
      ...features,
      ...(response.enableStructuralAnalysisHint ? ['structural-analysis-hint' as const] : []),
    ]),
  );

  return {
    projectName: response.projectName ?? defaultProjectName,
    tool: response.tool ?? defaultTool,
    features: resolvedFeatures,
  };
}
