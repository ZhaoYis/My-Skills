import fs from 'fs-extra';
import path from 'node:path';
import pc from 'picocolors';
import { readManifest, writeManifest } from '../manifest/io.js';
import type { ManagedAssetRecord } from '../manifest/types.js';
import { PACKAGE_NAME, TEMPLATE_VERSION } from '../runtime/meta.js';
import { renderTemplate } from './renderTemplates.js';
import type { InstallPlan } from './types.js';

function appendContent(existingContent: string, nextContent: string): string {
  if (!existingContent) {
    return nextContent;
  }

  const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
  return `${existingContent}${separator}${nextContent}`;
}

function appendConfigContext(existingContent: string, nextContent: string): string {
  const contextStart = nextContent.match(/^context:\s*\|\s*$/m)?.index;
  if (contextStart === undefined) return existingContent;

  const contextLines = nextContent.slice(contextStart).split('\n');
  const body: string[] = [];
  for (const line of contextLines.slice(1)) {
    if (line.trim() !== '' && !line.startsWith('  ')) break;
    if (line.startsWith('  ')) body.push(line);
  }
  if (body.length === 0) return existingContent;

  const existingLines = existingContent.split('\n');
  const existingContextIndex = existingLines.findIndex((line) => /^context:\s*\|\s*$/.test(line));
  if (existingContextIndex >= 0) {
    let insertAt = existingContextIndex + 1;
    while (insertAt < existingLines.length) {
      const line = existingLines[insertAt] ?? '';
      if (line.trim() !== '' && !line.startsWith('  ')) break;
      insertAt += 1;
    }
    existingLines.splice(insertAt, 0, ...body);
    return existingLines.join('\n');
  }

  const rulesIndex = existingLines.findIndex((line) => /^rules:\s*$/.test(line));
  const insertion = ['context: |', ...body, ''];
  existingLines.splice(rulesIndex >= 0 ? rulesIndex : existingLines.length, 0, ...insertion);
  return existingLines.join('\n');
}

function mergeManagedAssets(
  existingAssets: ManagedAssetRecord[],
  writtenAssets: ManagedAssetRecord[],
): ManagedAssetRecord[] {
  const merged = new Map(existingAssets.map((asset) => [asset.id, asset]));

  for (const asset of writtenAssets) {
    merged.set(asset.id, asset);
  }

  return Array.from(merged.values());
}

function successMessage(mode: InstallPlan['mode'], displayName: string): string {
  switch (mode) {
    case 'sync':
      return `Synchronized ${PACKAGE_NAME} managed files for ${displayName}.`;
    case 'upgrade':
      return `Upgraded ${PACKAGE_NAME} managed files for ${displayName}.`;
    default:
      return `Initialized ${PACKAGE_NAME} for ${displayName}.`;
  }
}

export async function executeInstallPlan(plan: InstallPlan): Promise<void> {
  const managedFiles = [] as typeof plan.files;
  const context = {
    projectName: plan.projectName,
    toolId: plan.tool,
    toolName: plan.adapter.definition.displayName,
    stack: plan.stack,
    packageName: PACKAGE_NAME,
    skillsDir: plan.adapter.getDestination('skills'),
    commandsDir: plan.adapter.getDestination('commands'),
    features: plan.features,
    templateVersion: TEMPLATE_VERSION,
    managedAssets: [] as Array<{ id: string; destination: string }>,
  };

  if (plan.dryRun) {
    console.log(pc.cyan('Dry run: the following files would be created:'));
    for (const file of plan.files) {
      if (file.resolution === 'skip') {
        continue;
      }

      console.log(`- ${path.relative(plan.targetDir, file.destinationPath)}`);
    }
    return;
  }

  for (const file of plan.files) {
    if (file.resolution === 'skip') {
      continue;
    }

    if (file.resolution === 'unresolved') {
      throw new Error(`Unresolved install conflict for: ${file.destinationPath}`);
    }

    await fs.ensureDir(path.dirname(file.destinationPath));

    if (file.kind === 'template') {
      const content = await renderTemplate(file.sourcePath, context);

      if (file.resolution === 'append') {
        const existingContent = await fs.readFile(file.destinationPath, 'utf8');
        const nextContent =
          path.basename(file.destinationPath) === 'config.yaml'
            ? appendConfigContext(existingContent, content)
            : appendContent(existingContent, content);
        await fs.outputFile(file.destinationPath, nextContent);
        managedFiles.push(file);
        continue;
      }

      await fs.outputFile(file.destinationPath, content);
      managedFiles.push(file);
      continue;
    }

    if (file.exists && file.resolution !== 'overwrite') {
      throw new Error(
        `Unsupported resolution ${file.resolution} for static file: ${file.destinationPath}`,
      );
    }

    await fs.copy(file.sourcePath, file.destinationPath, {
      overwrite: file.resolution === 'overwrite',
    });
    managedFiles.push(file);
  }

  const writtenAssets = managedFiles.map((file) => ({
    id: file.assetId,
    destination: path.relative(plan.targetDir, file.destinationPath),
  }));

  if (plan.mode === 'init') {
    context.managedAssets = writtenAssets;
  } else {
    const existingManifest = await readManifest(plan.targetDir);
    context.managedAssets = mergeManagedAssets(
      existingManifest?.manifest.managedAssets ?? [],
      writtenAssets,
    );
  }

  await writeManifest(plan.targetDir, {
    schemaVersion: 1,
    projectName: plan.projectName,
    tool: plan.tool,
    stack: plan.stack,
    features: plan.features,
    templateVersion: TEMPLATE_VERSION,
    packageName: PACKAGE_NAME,
    managedAssets: context.managedAssets,
  });

  console.log(pc.green(successMessage(plan.mode, plan.adapter.definition.displayName)));
  for (const note of plan.adapter.getPostInstallNotes()) {
    console.log(`- ${note}`);
  }
}
