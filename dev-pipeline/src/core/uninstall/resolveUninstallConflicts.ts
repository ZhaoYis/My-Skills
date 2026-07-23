import prompts from 'prompts';
import type {
  UninstallBulkAction,
  UninstallPlan,
  ResolveUninstallConflictsOptions,
} from './types.js';

function getUnresolvedFiles(plan: UninstallPlan) {
  return plan.files.filter((file) => file.resolution === 'unresolved');
}

function buildChoices(appendable: boolean) {
  const choices = [
    { title: '删除', value: 'remove' },
    { title: '跳过', value: 'skip' },
    { title: '删除当前及剩余全部', value: 'remove-all' },
    { title: '跳过当前及剩余全部', value: 'skip-all' },
  ] as Array<{ title: string; value: 'remove' | 'skip' | UninstallBulkAction }>;

  if (appendable) {
    choices[0] = {
      title: '删除整个文件（无法仅撤销追加内容）',
      value: 'remove',
    };
  }

  return choices;
}

function applyBulkResolution(
  files: UninstallPlan['files'],
  startIndex: number,
  action: UninstallBulkAction,
) {
  const resolution = action === 'remove-all' ? 'remove' : 'skip';

  for (let index = startIndex; index < files.length; index += 1) {
    const file = files[index];
    if (!file || file.resolution !== 'unresolved') {
      continue;
    }

    file.resolution = resolution;
  }
}

export async function resolveUninstallConflicts(
  plan: UninstallPlan,
  options: ResolveUninstallConflictsOptions,
): Promise<UninstallPlan> {
  if (options.yes) {
    for (const file of plan.files) {
      if (file.resolution === 'unresolved') {
        file.resolution = 'remove';
      }
    }

    return plan;
  }

  const unresolvedFiles = getUnresolvedFiles(plan);

  for (const [index, file] of unresolvedFiles.entries()) {
    if (file.resolution !== 'unresolved') {
      continue;
    }

    const appendableNote = file.appendable ? '（该文件可能曾追加写入，删除将移除整个文件）' : '';
    const response = await prompts(
      {
        type: 'select',
        name: 'resolution',
        message: `[${index + 1}/${unresolvedFiles.length}] 删除托管文件：${file.destinationPath}${appendableNote}`,
        choices: buildChoices(file.appendable),
        initial: 1,
      },
      { onCancel: () => process.exit(1) },
    );

    if (response.resolution === 'remove-all' || response.resolution === 'skip-all') {
      applyBulkResolution(unresolvedFiles, index, response.resolution);
      continue;
    }

    file.resolution = response.resolution ?? 'skip';
  }

  return plan;
}
