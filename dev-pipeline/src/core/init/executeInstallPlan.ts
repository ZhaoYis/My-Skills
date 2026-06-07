import fs from 'fs-extra';
import path from 'node:path';
import pc from 'picocolors';
import { writeManifest } from '../manifest/io.js';
import { PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import { renderTemplate } from './renderTemplates.js';
import type { InstallPlan } from './types.js';

export async function executeInstallPlan(plan: InstallPlan): Promise<void> {
  const context = {
    projectName: plan.projectName,
    toolId: plan.tool,
    toolName: plan.adapter.definition.displayName,
    packageName: PACKAGE_NAME,
    skillsDir: plan.adapter.getDestination('skills'),
    commandsDir: plan.adapter.getDestination('commands'),
    features: plan.features,
    templateVersion: TEMPLATE_VERSION,
    managedAssets: plan.files.map((file) => ({
      id: file.assetId,
      destination: path.relative(plan.targetDir, file.destinationPath)
    }))
  };

  if (plan.dryRun) {
    console.log(pc.cyan('Dry run: the following files would be created:'));
    for (const file of plan.files) {
      console.log(`- ${path.relative(plan.targetDir, file.destinationPath)}`);
    }
    return;
  }

  for (const file of plan.files) {
    const exists = await fs.pathExists(file.destinationPath);

    if (exists && !plan.force) {
      throw new Error(`Refusing to overwrite existing file: ${file.destinationPath}`);
    }

    await fs.ensureDir(path.dirname(file.destinationPath));

    if (file.kind === 'template') {
      const content = await renderTemplate(file.sourcePath, context);
      await fs.outputFile(file.destinationPath, content);
      continue;
    }

    await fs.copy(file.sourcePath, file.destinationPath, { overwrite: plan.force });
  }

  await writeManifest(plan.targetDir, {
    schemaVersion: 1,
    projectName: plan.projectName,
    tool: plan.tool,
    features: plan.features,
    templateVersion: TEMPLATE_VERSION,
    packageName: PACKAGE_NAME,
    managedAssets: context.managedAssets
  });

  console.log(pc.green(`Initialized ${PACKAGE_NAME} for ${plan.adapter.definition.displayName}.`));
  for (const note of plan.adapter.getPostInstallNotes()) {
    console.log(`- ${note}`);
  }
}
