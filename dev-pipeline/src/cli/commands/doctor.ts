import pc from 'picocolors';
import { checkKnowledgeHealth } from '../../core/doctor/checkKnowledgeHealth.js';
import { checkStackHealth } from '../../core/doctor/checkStackHealth.js';
import { applyKnowledgeHealthHistory } from '../../core/doctor/healthHistory.js';
import type {
  HealthGrade,
  HealthStatus,
  KnowledgeHealthReport,
  StackHealthResult,
} from '../../core/doctor/types.js';
import { readManifest } from '../../core/manifest/io.js';
import { checkManifestVersion, mergeHealthStatus } from '../../core/manifest/versionCheck.js';
import { MANIFEST_PACKAGE_JSON_KEY, PACKAGE_VERSION } from '../../core/runtime/meta.js';

export interface DoctorCommandOptions {
  json?: boolean;
  history?: boolean;
  staleDays?: number;
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

function gradeLabel(grade: HealthGrade): string {
  switch (grade) {
    case 'healthy':
      return '健康';
    case 'fair':
      return '一般';
    default:
      return '需关注';
  }
}

function gradeColorStatus(grade: HealthGrade): HealthStatus {
  switch (grade) {
    case 'healthy':
      return 'ok';
    case 'fair':
      return 'warn';
    default:
      return 'fail';
  }
}

function formatDelta(delta: number | null): string {
  if (delta === null) {
    return 'n/a';
  }

  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

function printKnowledgeReport(knowledge: KnowledgeHealthReport): void {
  console.log(`.knowledge: ${colorizeStatus(knowledge.status, statusLabel(knowledge.status))}`);

  if (knowledge.score) {
    const grade = knowledge.score.grade;
    console.log(
      `health score: ${colorizeStatus(gradeColorStatus(grade), `${knowledge.score.value}/100 (${gradeLabel(grade)})`)}`,
    );
    for (const dimension of knowledge.score.dimensions) {
      const suffix = dimension.detail ? ` - ${dimension.detail}` : '';
      console.log(
        `  - ${dimension.label} (w${dimension.weight}): ${colorizeStatus(dimension.status, String(dimension.score))}${suffix}`,
      );
    }
  }

  if (knowledge.trend) {
    const { previousValue, delta, previousDate } = knowledge.trend;
    if (previousValue === null) {
      console.log('trend: 无历史快照可对比（已记录本次为基线）');
    } else {
      console.log(`trend: ${formatDelta(delta)} vs ${previousValue}/100 @ ${previousDate}`);
    }
  }

  for (const check of knowledge.checks) {
    const label = `[${check.status}]`;
    console.log(`${colorizeStatus(check.status, label)} ${check.message}`);
    if (check.missingFiles?.length) {
      console.log(`  missing: ${check.missingFiles.join(', ')}`);
    }
    if (check.missingSections?.length) {
      console.log(`  missing sections: ${check.missingSections.join(', ')}`);
    }
    if (check.brokenLinks?.length) {
      console.log(`  broken links: ${check.brokenLinks.join(', ')}`);
    }
    if (check.duplicateFiles?.length) {
      console.log(`  duplicates: ${check.duplicateFiles.join(', ')}`);
    }
    if (check.staleFiles?.length) {
      console.log(`  stale: ${check.staleFiles.join(', ')}`);
    }
    if (typeof check.placeholderCount === 'number') {
      console.log(`  placeholder rows: ${check.placeholderCount}`);
    }
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
  let knowledge = await checkKnowledgeHealth(dir, manifestResult?.manifest.managedAssets ?? [], {
    staleDays: options.staleDays,
  });

  if (options.history) {
    knowledge = await applyKnowledgeHealthHistory(dir, knowledge, { persist: true });
  }

  const versionCheck = manifestResult
    ? checkManifestVersion(manifestResult.manifest.templateVersion, PACKAGE_VERSION)
    : undefined;

  let status: HealthStatus = !manifestResult
    ? knowledge.status === 'fail'
      ? 'fail'
      : 'warn'
    : knowledge.status;

  if (versionCheck) {
    status = mergeHealthStatus(status, versionCheck.healthStatus);
  }

  const manifest = manifestResult
    ? {
        status: versionCheck?.healthStatus === 'ok' ? ('ok' as const) : ('warn' as const),
        storage: manifestResult.storage,
        path:
          manifestResult.storage === 'package-json'
            ? `${manifestResult.path} (${MANIFEST_PACKAGE_JSON_KEY})`
            : manifestResult.path,
        tool: manifestResult.manifest.tool,
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
    console.log(JSON.stringify({ status, manifest, knowledge }, null, 2));
    return status;
  }

  console.log(`Doctor summary: ${colorizeStatus(status, statusLabel(status))}`);

  if (manifestResult) {
    console.log(pc.green(`Manifest: found at ${manifest.path}`));
    console.log(`- tool: ${manifest.tool}`);
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

  printKnowledgeReport(knowledge);
  return status;
}
