import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { adminOnly, createAuthMiddleware, userOnly } from '../src/api/middleware/auth.js';
import type { AuthPrincipal } from '../src/api/types.js';
import { parseEnv } from '../src/config/env.js';
import { hashServiceApiKey } from '../src/services/service-key-service.js';

const jwtSecret = 'test-secret-that-is-at-least-32-characters';
const base = {
  NODE_ENV: 'test',
  DB_PROVIDER: 'postgresql',
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
  JWT_SECRET: jwtSecret,
  API_KEY: 'service-test-key',
};

const currentDeveloper = {
  id: 42,
  email: 'user@example.invalid',
  teamId: 7,
  role: 'member',
  isActive: true,
  tokenVersion: 3,
};

function signToken(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}) {
  return jwt.sign(
    {
      developerId: 42,
      email: 'stale@example.invalid',
      teamId: 999,
      isAdmin: true,
      tokenVersion: 3,
      ...overrides,
    },
    jwtSecret,
    {
      expiresIn: '5m',
      issuer: 'opsx-metrics-server',
      audience: 'opsx-metrics-api',
      ...options,
    },
  );
}

function request(headers: Record<string, string>): Request {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

function response() {
  const state: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.status = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, state };
}

describe('authentication principal boundaries', () => {
  it('allows a legacy development API key through management but denies personal identity', async () => {
    const req = request({ 'x-api-key': 'service-test-key' });
    const { res, state } = response();
    const authenticated = vi.fn();
    await createAuthMiddleware(parseEnv(base))(req, res, authenticated);

    expect(authenticated).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ kind: 'service', service: 'api-key', keyId: 'legacy' });
    const adminNext = vi.fn();
    adminOnly(req, res, adminNext);
    expect(adminNext).toHaveBeenCalledOnce();
    userOnly(req, res, vi.fn());
    expect(state.status).toBe(403);
    expect(state.body).toMatchObject({
      success: false,
      message: expect.stringContaining('个人身份缺失'),
    });
  });

  it('maps a valid OIDC exchange JWT to the current database authorization', async () => {
    const token = signToken();
    const req = request({ authorization: `Bearer ${token}` });
    const { res } = response();
    const next = vi.fn();
    await createAuthMiddleware(parseEnv(base), async () => currentDeveloper)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({
      kind: 'user',
      developerId: 42,
      email: 'user@example.invalid',
      teamId: 7,
      isAdmin: false,
      tokenVersion: 3,
    } satisfies AuthPrincipal);
    const personalNext = vi.fn();
    userOnly(req, res, personalNext);
    expect(personalNext).toHaveBeenCalledOnce();
  });

  it('requires an explicitly matching development impersonation header', async () => {
    const env = parseEnv({ ...base, NODE_ENV: 'development', DEV_IMPERSONATE_DEVELOPER_ID: '23' });
    const accepted = request({ 'x-dev-impersonate': '23' });
    const rejected = request({ 'x-dev-impersonate': '24' });
    const acceptedNext = vi.fn();
    await createAuthMiddleware(env, async (id) => ({ ...currentDeveloper, id }))(
      accepted,
      response().res,
      acceptedNext,
    );
    expect(acceptedNext).toHaveBeenCalledOnce();
    expect(accepted.user).toMatchObject({ kind: 'user', developerId: 23, impersonated: true });

    const rejectedResponse = response();
    await createAuthMiddleware(env, async (id) => ({ ...currentDeveloper, id }))(
      rejected,
      rejectedResponse.res,
      vi.fn() as NextFunction,
    );
    expect(rejectedResponse.state.status).toBe(401);
  });

  it('rejects development impersonation configuration in production', () => {
    expect(() =>
      parseEnv({ ...base, NODE_ENV: 'production', DEV_IMPERSONATE_DEVELOPER_ID: '23' }),
    ).toThrow('cannot be enabled in production');
  });

  it.each([
    ['issuer', signToken({}, { issuer: 'wrong-issuer' })],
    ['audience', signToken({}, { audience: 'wrong-audience' })],
    ['expiry', signToken({}, { expiresIn: -1 })],
    ['signature', `${signToken().slice(0, -1)}x`],
  ])('rejects an invalid JWT %s without verification details', async (_case, token) => {
    const req = request({ authorization: `Bearer ${token}` });
    const { res, state } = response();
    await createAuthMiddleware(parseEnv(base), async () => currentDeveloper)(req, res, vi.fn());
    expect(state).toMatchObject({
      status: 401,
      body: { success: false, message: '认证凭证无效或已过期' },
    });
  });

  it('revokes inactive or token-version-stale sessions immediately', async () => {
    for (const developer of [
      { ...currentDeveloper, isActive: false },
      { ...currentDeveloper, tokenVersion: 4 },
    ]) {
      const req = request({ authorization: `Bearer ${signToken()}` });
      const { res, state } = response();
      await createAuthMiddleware(parseEnv(base), async () => developer)(req, res, vi.fn());
      expect(state.status).toBe(401);
    }
  });

  it('forwards authorization-store failures instead of reporting an invalid JWT', async () => {
    const req = request({ authorization: `Bearer ${signToken()}` });
    const { res, state } = response();
    const databaseError = new Error('authorization store unavailable');
    const next = vi.fn();
    await createAuthMiddleware(parseEnv(base), async () => {
      throw databaseError;
    })(req, res, next);

    expect(next).toHaveBeenCalledWith(databaseError);
    expect(state.status).toBeUndefined();
  });

  it('supports hashed key rotation and enforces management purpose', async () => {
    const env = parseEnv({
      ...base,
      API_KEY: '',
      SERVICE_API_KEYS: JSON.stringify({
        exchange: { sha256: hashServiceApiKey('exchange-secret'), purposes: ['session-exchange'] },
        admin: { sha256: hashServiceApiKey('admin-secret'), purposes: ['management'] },
      }),
    });
    const exchangeRequest = request({ 'x-api-key': 'exchange.exchange-secret' });
    await createAuthMiddleware(env)(exchangeRequest, response().res, vi.fn());
    const denied = response();
    adminOnly(exchangeRequest, denied.res, vi.fn());
    expect(denied.state.status).toBe(403);

    const adminRequest = request({ 'x-api-key': 'admin.admin-secret' });
    const next = vi.fn();
    await createAuthMiddleware(env)(adminRequest, response().res, vi.fn());
    adminOnly(adminRequest, response().res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
