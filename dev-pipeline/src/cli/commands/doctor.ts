import pc from 'picocolors';
import { readManifest } from '../../core/manifest/io.js';
import { MANIFEST_PACKAGE_JSON_KEY } from '../../core/runtime/meta.js';

export async function runDoctorCommand(dir: string = process.cwd()): Promise<void> {
  const result = await readManifest(dir);
  if (!result) {
    console.log(pc.yellow('No opsx-dev-pipeline manifest found in target directory.'));
    return;
  }

  const storageLabel = result.storage === 'package-json'
    ? `${result.path} (${MANIFEST_PACKAGE_JSON_KEY})`
    : result.path;
  console.log(pc.green(`Found manifest: ${storageLabel}`));
  console.log(`- tool: ${result.manifest.tool}`);
  console.log(`- features: ${result.manifest.features.join(', ')}`);
  console.log(`- templateVersion: ${result.manifest.templateVersion}`);
}
