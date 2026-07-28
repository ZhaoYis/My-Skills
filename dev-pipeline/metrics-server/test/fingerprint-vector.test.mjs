import { constants, createHash, generateKeyPairSync, publicEncrypt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeFingerprintFields,
  parsePrivateKeyRing,
  verifyFingerprint,
} from '../src/collectors/fingerprint-verifier.ts';
import { parsePipelineState } from '../src/collectors/state-parser.ts';

const vectorPath = fileURLToPath(
  new URL('../../test-space/snake-game/openspec/.pipeline-state/add-leaderboard.json', import.meta.url),
);
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const ring = parsePrivateKeyRing(JSON.stringify({ fp1: Buffer.from(privateKey).toString('base64') }));

function signFingerprint(state) {
  const digest = createHash('sha256').update(canonicalizeFingerprintFields(state)).digest();
  const ciphertext = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    digest,
  );
  return { ...state, fingerprintId: `fp1.${ciphertext.toString('base64url')}` };
}

describe('real pipeline-state fingerprint vector', () => {
  it('verifies protected fields before applying the v3-only collector gate', async () => {
    const state = signFingerprint(JSON.parse(await readFile(vectorPath, 'utf8')));
    expect(verifyFingerprint(state, ring)).toEqual({ verified: true, keyVersion: 'fp1' });
    expect(() => verifyFingerprint({ ...state, changeName: 'tampered-name' }, ring)).toThrow('mismatch');
    expect(() => parsePipelineState(JSON.stringify(state))).toThrow();
    expect(state.schemaVersion).toBe(2);
  });
});
