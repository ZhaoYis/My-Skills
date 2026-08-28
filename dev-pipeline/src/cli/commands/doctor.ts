import pc from 'picocolors';
import { checkStackHealth } from '../../core/doctor/checkStackHealth.js';
import type { HealthStatus, StackHealthResult } from '../../core/doctor/types.js';
import { readManifest } from '../../core/manifest/io.js';
import { checkManifestVersion } from '../../core/manifest/versionCheck.js';
import { MANIFEST_PACKAGE_JSON_KEY, PACKAGE_VERSION } from '../../core/runtime/meta.js';

export interface DoctorCommandOptions {
  json?: boolean;
  /** Only validate stack profile (when --stack is passed) */
  stackOnly?: boolean;
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'fail':
      return 'FAIL';
    case 'warn':
      return 'WARN';
    default:
      return 'OK';
  }
}

function colorizeStatus(status: HealthStatus, value: string): string {
  switch (status) {
    case 'fail':
      return pc.red(value);
    case 'warn':
      return pc.yellow(value);
    default:
      return pc.green(value);
  }
}

function printStackReport(stack: StackHealthResult): void {
  if (!stack.stackFound) {
    console.log(pc.red('Stack profile: NOT FOUND'));
    console.log(pc.red('  openspec/config.yaml either does not exist or has no stack section.'));
    console.log(
      pc.dim(
        '  Add a stack section to openspec/config.yaml. See docs/stack-profile-schema.json for reference.',
      ),
    );
    return;
  }

  const statusIcon = stack.valid ? pc.green('✓') : pc.red('✗');
  console.log(`Stack profile: ${statusIcon} ${stack.valid ? 'VALID' : 'INVALID'}`);
  console.log(`  id: ${stack.stackId || '(missing)'}`);
  console.log(
    `  services: ${stack.serviceCount ?? 0}${stack.stacks ? ` (${stack.stacks.join(', ')})` : ''}`,
  );

  const errors = stack.issues.filter((i) => i.severity === 'error');
  const warnings = stack.issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(pc.red(`\n  Errors (${errors.length}):`));
    for (const e of errors) {
      console.log(pc.red(`    ✗ ${e.path}: ${e.message}`));
    }
  }

  if (warnings.length > 0) {
    console.log(pc.yellow(`\n  Warnings (${warnings.length}):`));
    for (const w of warnings) {
      console.log(pc.yellow(`    ⚠ ${w.path}: ${w.message}`));
    }
  }

  if (stack.valid) {
    console.log(pc.green('\n  All required fields are present and valid.'));
  }
}

export async function runDoctorCommand(
  dir: string = process.cwd(),
  json = false,
  options: DoctorCommandOptions = {},
): Promise<HealthStatus> {
  // ── Stack-only mode ──
  if (options.stackOnly) {
    const stackHealth = await checkStackHealth(dir);
    if (json) {
      console.log(
        JSON.stringify({ status: stackHealth.valid ? 'ok' : 'fail', stack: stackHealth }, null, 2),
      );
    } else {
      printStackReport(stackHealth);
    }
    return stackHealth.valid ? 'ok' : 'fail';
  }

  const manifestResult = await readManifest(dir);

  const versionCheck = manifestResult
    ? checkManifestVersion(manifestResult.manifest.templateVersion, PACKAGE_VERSION)
    : undefined;

  const status: HealthStatus = !manifestResult ? 'warn' : (versionCheck?.healthStatus ?? 'ok');

  const manifest = manifestResult
    ? {
        status: versionCheck?.healthStatus === 'ok' ? ('ok' as const) : ('warn' as const),
        storage: manifestResult.storage,
        path:
          manifestResult.storage === 'package-json'
            ? `${manifestResult.path} (${MANIFEST_PACKAGE_JSON_KEY})`
            : manifestResult.path,
        tool: manifestResult.manifest.tool,
        tools: manifestResult.manifest.tools,
        features: manifestResult.manifest.features,
        templateVersion: manifestResult.manifest.templateVersion,
        currentVersion: PACKAGE_VERSION,
        versionCheck,
      }
    : {
        status: 'warn' as const,
        path: null,
        message: 'No opsx-dev-pipeline manifest found in target directory.',
      };

  if (json) {
    console.log(JSON.stringify({ status, manifest }, null, 2));
    return status;
  }

  console.log(`Doctor summary: ${colorizeStatus(status, statusLabel(status))}`);

  if (manifestResult) {
    console.log(pc.green(`Manifest: found at ${manifest.path}`));
    const installedTools = manifest.tools ?? [];
    console.log(`- tools: ${installedTools.join(', ') || '(none recorded)'}`);
    if (manifest.tool && installedTools.length > 1) {
      console.log(`- active tool: ${manifest.tool}`);
    } else if (manifest.tool) {
      console.log(`- tool: ${manifest.tool}`);
    }
    console.log(`- features: ${manifest.features?.join(', ') ?? ''}`);
    console.log(`- templateVersion: ${manifest.templateVersion}`);
    console.log(`- currentVersion: ${PACKAGE_VERSION}`);

    if (versionCheck) {
      console.log(colorizeStatus(versionCheck.healthStatus, `- version: ${versionCheck.message}`));
      if (versionCheck.recommendation) {
        console.log(
          colorizeStatus(
            versionCheck.healthStatus,
            `  recommendation: ${versionCheck.recommendation}`,
          ),
        );
      }
    }
  } else {
    console.log(pc.yellow(manifest.message));
  }

  return status;
}
