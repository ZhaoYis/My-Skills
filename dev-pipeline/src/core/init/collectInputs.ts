import path from 'node:path';
import prompts from 'prompts';
import type { ToolAdapter, ToolId } from '../adapters/types.js';
import type { InitAnswers, InitOptions } from '../prompts/types.js';

export async function collectInputs(
  targetDir: string,
  options: InitOptions,
  registry: Map<ToolId, ToolAdapter>
): Promise<InitAnswers> {
  const defaultProjectName = path.basename(targetDir);
  const defaultTool = options.tool ?? 'claude';

  if (options.yes) {
    return {
      projectName: defaultProjectName,
      tool: defaultTool,
      features: ['base', 'skills', 'commands', 'docs']
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
      type: 'multiselect',
      name: 'features',
      message: 'Select template bundles',
      choices: [
        { title: 'Base scaffold', value: 'base', selected: true },
        { title: 'Skills templates', value: 'skills', selected: true },
        { title: 'Commands templates', value: 'commands', selected: true },
        { title: 'Docs', value: 'docs', selected: true }
      ],
      hint: '- Space to select. Return to submit'
    }
  ]);

  return {
    projectName: response.projectName ?? defaultProjectName,
    tool: response.tool ?? defaultTool,
    features: response.features ?? ['base', 'skills', 'commands', 'docs']
  };
}
