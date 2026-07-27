import { constants, createHash, generateKeyPairSync, publicEncrypt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeFingerprintFields,
  parsePrivateKeyRing,
  verifyFingerprint,
} from '../src/collectors/fingerprint-verifier.js';
import { parsePipelineState, type PipelineState } from '../src/collectors/state-parser.js';

function state(): PipelineState {
  return {
    schemaVersion: 3,
    _version: 1,
    changeName: 'metrics-system',
    sourceBranch: 'feature/metrics-system',
    targetBranch: 'main',
    currentPhase: 2,
    currentStep: 8,
    status: 'active',
    executionMode: 'pipeline',
    createdBy: 'Metrics Tester',
    createdByEmail: 'metrics@example.com',
    machineInfo: { platform: 'darwin', hostname: 'build-01', osRelease: '25.0', nodeVersion: 'v24.0.0', arch: 'arm64' },
    featureInfo: { featureId: 'REQ-42', featureUrl: null },
    fingerprintId: '0'.repeat(32),
    fingerprintNonce: '12ab34cd',
    phaseHistory: [{ phase: 2, step: 8, executedBy: 'pipeline', status: 'completed', startedAt: '2026-07-28 09:00:00', completedAt: '2026-07-28 09:10:00', decisions: { implementationConfirmed: true }, gatesBypassed: [] }],
    gatesBypassed: [],
    decisions: { implementationConfirmed: true },
    review: { currentRound: 0, rounds: [], reportPath: null, status: 'pending' },
    tests: { command: 'npm test', attempts: 0, status: 'pending', detail: null },
    verify: { command: null, attempts: 0, status: 'pending', detail: null },
    archivePath: null,
    delivery: { sourcePushed: false, targetPushed: false },
    createdAt: '2026-07-28 09:00:00',
    updatedAt: '2026-07-28 09:10:00',
  };
}

describe('pipeline state parsing and fingerprints', () => {
  it('parses a strict schema v3 state', () => {
    expect(parsePipelineState(JSON.stringify(state())).changeName).toBe('metrics-system');
  });

  it('rejects unsupported schema versions and invalid enums', () => {
    expect(() => parsePipelineState(JSON.stringify({ ...state(), schemaVersion: 2 }))).toThrow();
    expect(() => parsePipelineState(JSON.stringify({ ...state(), status: 'unknown' }))).toThrow();
  });

  it('verifies RSA-OAEP fingerprints and rejects protected-field tampering', () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privatePem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const ring = parsePrivateKeyRing(JSON.stringify({ fp1: Buffer.from(privatePem).toString('base64') }));
    const original = state();
    const digest = createHash('sha256').update(canonicalizeFingerprintFields(original)).digest();
    original.fingerprintId = `fp1.${publicEncrypt({ key: keys.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, digest).toString('base64url')}`;

    expect(verifyFingerprint(original, ring)).toEqual({ verified: true, keyVersion: 'fp1' });
    expect(() => verifyFingerprint({ ...original, createdByEmail: 'tampered@example.com' }, ring)).toThrow('mismatch');
    expect(() => verifyFingerprint({ ...original, featureInfo: { featureId: 'REQ-43', featureUrl: null } }, ring)).toThrow('mismatch');
  });

  it('keeps MD5 fingerprints explicitly unverified', () => {
    expect(verifyFingerprint(state(), new Map())).toEqual({ verified: false, keyVersion: 'legacy', reason: 'legacy-unverified' });
  });
});
