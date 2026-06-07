import pc from 'picocolors';
import { checkKnowledgeHealth } from '../../core/doctor/checkKnowledgeHealth.js';
import type { HealthStatus } from '../../core/doctor/types.js';
import { readManifest } from '../../core/manifest/io.js';
import { MANIFEST_PACKAGE_JSON_KEY } from '../../core/runtime/meta.js';

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

export async function runDoctorCommand(dir: string = process.cwd(), json = false): Promise<void> {
  const manifestResult = await readManifest(dir);
  const knowledge = await checkKnowledgeHealth(dir, manifestResult?.manifest.managedAssets ?? []);
  const status: HealthStatus = manifestResult && knowledge.status === 'ok' ? 'ok' : knowledge.status;

  const manifest = manifestResult
    ? {
        status: 'ok' as const,
        storage: manifestResult.storage,
        path: manifestResult.storage === 'package-json'
          ? `${manifestResult.path} (${MANIFEST_PACKAGE_JSON_KEY})`
          : manifestResult.path,
        tool: manifestResult.manifest.tool,
        features: manifestResult.manifest.features,
        templateVersion: manifestResult.manifest.templateVersion
      }
    : {
        status: 'warn' as const,
        path: null,
        message: 'No opsx-dev-pipeline manifest found in target directory.'
      };

  if (json) {
    console.log(JSON.stringify({ status, manifest, knowledge }, null, 2));
    return;
  }

  console.log(`Doctor summary: ${colorizeStatus(status, statusLabel(status))}`);

  if (manifestResult) {
    console.log(pc.green(`Manifest: found at ${manifest.path}`));
    console.log(`- tool: ${manifest.tool}`);
    console.log(`- features: ${manifest.features?.join(', ') ?? ''}`);
    console.log(`- templateVersion: ${manifest.templateVersion}`);
  } else {
    console.log(pc.yellow(manifest.message));
  }

  console.log(`.knowledge: ${colorizeStatus(knowledge.status, statusLabel(knowledge.status))}`);
  for (const check of knowledge.checks) {
    const label = `[${check.status}]`;
    console.log(`${colorizeStatus(check.status, label)} ${check.message}`);
    if (check.missingFiles?.length) {
      console.log(`  missing: ${check.missingFiles.join(', ')}`);
    }
    if (check.missingSections?.length) {
      console.log(`  missing sections: ${check.missingSections.join(', ')}`);
    }
    if (typeof check.placeholderCount === 'number') {
      console.log(`  placeholder rows: ${check.placeholderCount}`);
    }
  }
}
