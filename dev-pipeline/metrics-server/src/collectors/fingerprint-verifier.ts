import {
  constants,
  createHash,
  createPrivateKey,
  privateDecrypt,
  timingSafeEqual,
} from 'node:crypto';
import type { PipelineState } from './state-parser.js';

export type FingerprintResult =
  | { verified: true; keyVersion: string }
  | { verified: false; keyVersion: 'legacy'; reason: 'legacy-unverified' };

export type PrivateKeyRing = Map<string, string>;

export type FingerprintRejectionCode =
  | 'invalid-format'
  | 'unknown-key'
  | 'decryption-failed'
  | 'digest-mismatch'
  | 'legacy-not-allowed'
  | 'history-import-requires-legacy';

export class FingerprintVerificationError extends Error {
  constructor(
    readonly code: FingerprintRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = 'FingerprintVerificationError';
  }
}

export function canonicalizeFingerprintFields(state: PipelineState): string {
  return JSON.stringify({
    schemaVersion: state.schemaVersion,
    changeName: state.changeName,
    createdAt: state.createdAt,
    createdBy: state.createdBy,
    createdByEmail: state.createdByEmail || '',
    machineInfo: state.machineInfo,
    featureId: state.featureInfo?.featureId || '',
    fingerprintNonce: state.fingerprintNonce,
  });
}

export function parsePrivateKeyRing(serialized: string): PrivateKeyRing {
  const raw = JSON.parse(serialized) as Record<string, string>;
  const ring = new Map<string, string>();
  for (const [version, encoded] of Object.entries(raw)) {
    const pem = Buffer.from(encoded, 'base64').toString('utf8');
    const key = createPrivateKey(pem);
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new Error(
        `Fingerprint key ${version} must be an RSA private key of at least 2048 bits`,
      );
    }
    ring.set(version, pem);
  }
  if (!ring.has('fp1')) throw new Error('FINGERPRINT_PRIVATE_KEYS must include a valid fp1 key');
  return ring;
}

export function verifyFingerprint(state: PipelineState, keys: PrivateKeyRing): FingerprintResult {
  if (/^[a-f0-9]{32}$/i.test(state.fingerprintId)) {
    return { verified: false, keyVersion: 'legacy', reason: 'legacy-unverified' };
  }

  const match = /^(fp\d+)\.([A-Za-z0-9_-]+)$/.exec(state.fingerprintId);
  if (!match)
    throw new FingerprintVerificationError('invalid-format', 'Invalid fingerprint format');
  const version = match[1];
  const ciphertext = match[2];
  if (!version || !ciphertext) {
    throw new FingerprintVerificationError('invalid-format', 'Invalid fingerprint format');
  }
  const key = keys.get(version);
  if (!key) {
    throw new FingerprintVerificationError(
      'unknown-key',
      `Unknown fingerprint key version: ${version}`,
    );
  }

  let decrypted: Buffer;
  try {
    const bytes = Buffer.from(ciphertext, 'base64url');
    if (bytes.length !== 256) throw new Error('invalid ciphertext length');
    decrypted = privateDecrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      bytes,
    );
  } catch {
    throw new FingerprintVerificationError('decryption-failed', 'Fingerprint decryption failed');
  }

  const expected = createHash('sha256')
    .update(canonicalizeFingerprintFields(state), 'utf8')
    .digest();
  if (decrypted.length !== expected.length || !timingSafeEqual(decrypted, expected)) {
    throw new FingerprintVerificationError('digest-mismatch', 'Fingerprint digest mismatch');
  }
  return { verified: true, keyVersion: version };
}
