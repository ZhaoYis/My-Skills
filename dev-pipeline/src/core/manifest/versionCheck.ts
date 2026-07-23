import type { HealthStatus } from '../doctor/types.js';
import { PACKAGE_VERSION } from '../runtime/meta.js';

export type ManifestVersionStatus = 'current' | 'outdated' | 'ahead' | 'unknown';

export interface ManifestVersionCheck {
  status: ManifestVersionStatus;
  healthStatus: HealthStatus;
  manifestVersion: string;
  currentVersion: string;
  message: string;
  recommendation?: string;
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): -1 | 0 | 1 | null {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);

  if (!parsedLeft || !parsedRight) {
    return null;
  }

  for (let index = 0; index < 3; index += 1) {
    if (parsedLeft[index] < parsedRight[index]) {
      return -1;
    }

    if (parsedLeft[index] > parsedRight[index]) {
      return 1;
    }
  }

  return 0;
}

export function checkManifestVersion(
  manifestVersion: string,
  currentVersion: string = PACKAGE_VERSION,
): ManifestVersionCheck {
  const comparison = compareSemver(manifestVersion, currentVersion);

  if (comparison === 0 || manifestVersion === currentVersion) {
    return {
      status: 'current',
      healthStatus: 'ok',
      manifestVersion,
      currentVersion,
      message: `Manifest template version matches the installed CLI (${currentVersion}).`,
    };
  }

  if (comparison === -1) {
    return {
      status: 'outdated',
      healthStatus: 'warn',
      manifestVersion,
      currentVersion,
      message: `Manifest template version ${manifestVersion} is older than the installed CLI ${currentVersion}.`,
      recommendation: 'Run `npx opsx-dev-pipeline upgrade` to refresh managed templates.',
    };
  }

  if (comparison === 1) {
    return {
      status: 'ahead',
      healthStatus: 'warn',
      manifestVersion,
      currentVersion,
      message: `Manifest template version ${manifestVersion} is newer than the installed CLI ${currentVersion}.`,
      recommendation:
        'Upgrade the opsx-dev-pipeline package to match the manifest template version.',
    };
  }

  return {
    status: 'unknown',
    healthStatus: 'warn',
    manifestVersion,
    currentVersion,
    message: `Unable to compare manifest template version "${manifestVersion}" with CLI version ${currentVersion}.`,
    recommendation:
      'Re-run `npx opsx-dev-pipeline upgrade` after confirming the installed package version.',
  };
}

export function mergeHealthStatus(current: HealthStatus, next: HealthStatus): HealthStatus {
  if (current === 'fail' || next === 'fail') {
    return 'fail';
  }

  if (current === 'warn' || next === 'warn') {
    return 'warn';
  }

  return 'ok';
}
