import pc from 'picocolors';
import prompts from 'prompts';
import type { ManifestVersionCheck } from '../manifest/versionCheck.js';

export interface UpgradeVersionPromptOptions {
  yes?: boolean;
  dryRun?: boolean;
}

function upgradeNotice(versionCheck: ManifestVersionCheck): string {
  switch (versionCheck.status) {
    case 'outdated':
      return `Upgrading managed templates from ${versionCheck.manifestVersion} to ${versionCheck.currentVersion}.`;
    case 'current':
      return `Managed templates are already recorded at ${versionCheck.currentVersion}; upgrade will re-sync managed files.`;
    case 'ahead':
      return `${versionCheck.message} Continuing may overwrite newer managed templates with older package content.`;
    default:
      return versionCheck.message;
  }
}

function colorizeNotice(versionCheck: ManifestVersionCheck, message: string): string {
  switch (versionCheck.status) {
    case 'current':
      return pc.green(message);
    case 'outdated':
      return pc.cyan(message);
    default:
      return pc.yellow(message);
  }
}

export function printUpgradeVersionNotice(
  versionCheck: ManifestVersionCheck,
  dryRun = false
): void {
  const prefix = dryRun ? 'Upgrade preview' : 'Upgrade preflight';
  console.log(colorizeNotice(versionCheck, `${prefix}: ${upgradeNotice(versionCheck)}`));

  if (versionCheck.recommendation && versionCheck.status === 'ahead') {
    console.log(pc.yellow(`- ${versionCheck.recommendation}`));
  }
}

export async function ensureUpgradeVersionCheck(
  versionCheck: ManifestVersionCheck,
  options: UpgradeVersionPromptOptions = {}
): Promise<void> {
  printUpgradeVersionNotice(versionCheck, Boolean(options.dryRun));

  if (options.dryRun || options.yes) {
    return;
  }

  if (versionCheck.status !== 'ahead' && versionCheck.status !== 'unknown') {
    return;
  }

  const response = await prompts(
    {
      type: 'confirm',
      name: 'continue',
      message: 'Continue upgrade anyway?',
      initial: false
    },
    { onCancel: () => process.exit(1) }
  );

  if (!response.continue) {
    throw new Error('Upgrade cancelled due to manifest version mismatch.');
  }
}
