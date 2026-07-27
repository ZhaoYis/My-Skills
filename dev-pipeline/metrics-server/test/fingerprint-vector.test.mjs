import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FINGERPRINT_PRIVATE_KEY_PEM } from '../../keys/fingerprint-key-pair.mjs';
import { parsePrivateKeyRing, verifyFingerprint } from '../src/collectors/fingerprint-verifier.ts';
import { parsePipelineState } from '../src/collectors/state-parser.ts';

const vectorPath = fileURLToPath(
  new URL('../../test-space/snake-game/openspec/.pipeline-state/add-leaderboard.json', import.meta.url),
);
const ring = parsePrivateKeyRing(
  JSON.stringify({ fp1: Buffer.from(FINGERPRINT_PRIVATE_KEY_PEM).toString('base64') }),
);

describe('real pipeline-state fingerprint vector', () => {
  it('verifies protected fields before applying the v3-only collector gate', async () => {
    const state = JSON.parse(await readFile(vectorPath, 'utf8'));
    expect(verifyFingerprint(state, ring)).toEqual({ verified: true, keyVersion: 'fp1' });
    expect(() => verifyFingerprint({ ...state, changeName: 'tampered-name' }, ring)).toThrow('mismatch');
    expect(() => parsePipelineState(JSON.stringify(state))).toThrow();
    expect(state.schemaVersion).toBe(2);
  });
});
