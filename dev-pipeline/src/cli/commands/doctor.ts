import pc from 'picocolors';
import { readManifest } from '../../core/manifest/io.js';

export async function runDoctorCommand(dir: string = process.cwd()): Promise<void> {
  const result = await readManifest(dir);
  if (!result) {
    console.log(pc.yellow('No opsx-dev-pipeline manifest found in target directory.'));
    return;
  }

  console.log(pc.green(`Found manifest: ${result.path}`));
  console.log(`- tool: ${result.manifest.tool}`);
  console.log(`- features: ${result.manifest.features.join(', ')}`);
  console.log(`- templateVersion: ${result.manifest.templateVersion}`);
}
