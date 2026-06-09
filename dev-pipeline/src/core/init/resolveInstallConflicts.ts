import prompts from 'prompts';
import type { InstallConflictResolution } from '../assets/types.js';
import type { ConflictBulkAction, InstallPlan, ResolveInstallConflictsOptions } from './types.js';

function getUnresolvedFiles(plan: InstallPlan) {
  return plan.files.filter((file) => file.resolution === 'unresolved');
}

function buildChoices(appendable: boolean) {
  const choices = [
    { title: '强制覆盖', value: 'overwrite' },
    { title: '跳过', value: 'skip' },
    { title: '覆盖当前及剩余全部', value: 'overwrite-all' },
    { title: '跳过当前及剩余全部', value: 'skip-all' }
  ] as Array<{ title: string; value: InstallConflictResolution | ConflictBulkAction }>;

  if (appendable) {
    choices.splice(1, 0, { title: '追加', value: 'append' });
    choices.splice(4, 0, { title: '追加所有可追加文件，其余跳过', value: 'append-all-safe' });
  }

  return choices;
}

function applyBulkResolution(files: InstallPlan['files'], startIndex: number, action: ConflictBulkAction) {
  for (let index = startIndex; index < files.length; index += 1) {
    const file = files[index];
    if (!file || file.resolution !== 'unresolved') {
      continue;
    }

    if (action === 'overwrite-all') {
      file.resolution = 'overwrite';
      continue;
    }

    if (action === 'skip-all') {
      file.resolution = 'skip';
      continue;
    }

    file.resolution = file.appendable ? 'append' : 'skip';
  }
}

export async function resolveInstallConflicts(
  plan: InstallPlan,
  options: ResolveInstallConflictsOptions
): Promise<InstallPlan> {
  const unresolvedFiles = getUnresolvedFiles(plan);

  for (const [index, file] of unresolvedFiles.entries()) {
    if (file.resolution !== 'unresolved') {
      continue;
    }

    if (options.force) {
      file.resolution = 'overwrite';
      continue;
    }

    if (options.yes) {
      file.resolution = 'skip';
      continue;
    }

    const response = await prompts(
      {
        type: 'select',
        name: 'resolution',
        message: `[${index + 1}/${unresolvedFiles.length}] 检测到重复文件：${file.destinationPath}`,
        choices: buildChoices(file.appendable),
        initial: file.appendable ? 1 : 0
      },
      { onCancel: () => process.exit(1) }
    );

    if (response.resolution === 'overwrite-all' || response.resolution === 'append-all-safe' || response.resolution === 'skip-all') {
      applyBulkResolution(unresolvedFiles, index, response.resolution);
      continue;
    }

    file.resolution = response.resolution ?? 'skip';
  }

  return plan;
}
