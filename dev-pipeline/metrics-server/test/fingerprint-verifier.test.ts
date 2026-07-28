import { constants, createHash, generateKeyPairSync, publicEncrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeFingerprintFields,
  FingerprintVerificationError,
  verifyFingerprint,
} from '../src/collectors/fingerprint-verifier.js';
import type { PipelineState } from '../src/collectors/state-parser.js';

const firstKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const secondKeys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function stateWithFingerprint(fingerprintId: string): PipelineState {
  return {
    schemaVersion: 3,
    _version: 1,
    changeName: 'fingerprint-test',
    sourceBranch: 'feature/fingerprint-test',
    targetBranch: 'main',
    currentPhase: 1,
    currentStep: 1,
    status: 'active',
    executionMode: 'pipeline',
    createdBy: 'Fingerprint Tester',
    createdByEmail: 'fingerprint@example.invalid',
    machineInfo: {
      platform: 'darwin',
      hostname: 'test',
      osRelease: '1',
      nodeVersion: 'v24',
      arch: 'arm64',
    },
    featureInfo: null,
    fingerprintId,
    fingerprintNonce: '1234abcd',
    phaseHistory: [],
    gatesBypassed: [],
    decisions: {},
    review: { currentRound: 0, rounds: [], reportPath: null, status: 'pending' },
    tests: { command: null, attempts: 0, status: 'pending', detail: null },
    verify: { command: null, attempts: 0, status: 'pending', detail: null },
    archivePath: null,
    delivery: {},
    createdAt: '2026-07-28 01:00:00',
    updatedAt: '2026-07-28 01:01:00',
  };
}

function encryptedFingerprint(
  state: PipelineState,
  digest: Buffer,
  publicKey = firstKeys.publicKey,
) {
  const ciphertext = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    digest,
  );
  return { ...state, fingerprintId: `fp1.${ciphertext.toString('base64url')}` };
}

function expectCode(action: () => unknown, code: FingerprintVerificationError['code']) {
  try {
    action();
    throw new Error('Expected fingerprint verification to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(FingerprintVerificationError);
    expect((error as FingerprintVerificationError).code).toBe(code);
  }
}

describe('fingerprint rejection reasons', () => {
  it('recognizes legacy fingerprints without treating them as trusted', () => {
    const state = stateWithFingerprint('a'.repeat(32));
    expect(verifyFingerprint(state, new Map())).toEqual({
      verified: false,
      keyVersion: 'legacy',
      reason: 'legacy-unverified',
    });
  });

  it('classifies invalid format and unknown key', () => {
    expectCode(
      () => verifyFingerprint(stateWithFingerprint('not-a-fingerprint'), new Map()),
      'invalid-format',
    );
    expectCode(
      () => verifyFingerprint(stateWithFingerprint(`fp9.${'A'.repeat(342)}`), new Map()),
      'unknown-key',
    );
  });

  it('classifies damaged ciphertext and a wrong private key', () => {
    const damaged = stateWithFingerprint(`fp1.${Buffer.alloc(256).toString('base64url')}`);
    expectCode(
      () => verifyFingerprint(damaged, new Map([['fp1', firstKeys.privateKey]])),
      'decryption-failed',
    );

    const base = stateWithFingerprint('placeholder');
    const digest = createHash('sha256').update(canonicalizeFingerprintFields(base)).digest();
    const encrypted = encryptedFingerprint(base, digest);
    expectCode(
      () => verifyFingerprint(encrypted, new Map([['fp1', secondKeys.privateKey]])),
      'decryption-failed',
    );
  });

  it('classifies digest mismatch and accepts the matching digest', () => {
    const base = stateWithFingerprint('placeholder');
    const mismatch = encryptedFingerprint(base, Buffer.alloc(32, 7));
    expectCode(
      () => verifyFingerprint(mismatch, new Map([['fp1', firstKeys.privateKey]])),
      'digest-mismatch',
    );

    const digest = createHash('sha256').update(canonicalizeFingerprintFields(base)).digest();
    const valid = encryptedFingerprint(base, digest);
    expect(verifyFingerprint(valid, new Map([['fp1', firstKeys.privateKey]]))).toEqual({
      verified: true,
      keyVersion: 'fp1',
    });
  });
});
