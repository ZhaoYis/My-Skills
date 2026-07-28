import { describe, expect, it } from 'vitest';
import { classifyRepositoryConnectionFailure } from '../src/services/repo-service.js';

describe('repository connection error classification', () => {
  it.each([
    ['Permission denied (publickey)', 'authentication-failed'],
    ['fatal: repository not found', 'repository-not-found'],
    ['Could not resolve host git.example.invalid', 'connection-failed'],
  ])('maps %s to %s', (message, code) => {
    expect(classifyRepositoryConnectionFailure(new Error(message))).toMatchObject({ code });
  });
});
