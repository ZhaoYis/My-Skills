import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminOnly, createAuthMiddleware, userOnly } from '../src/api/middleware/auth.js';
import { parseEnv } from '../src/config/env.js';

const jwtSecret = 'test-secret-that-is-at-least-32-characters';
const env = parseEnv({
  NODE_ENV: 'test',
  DB_PROVIDER: 'postgresql',
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
  JWT_SECRET: jwtSecret,
  API_KEY: 'service-test-key',
});
const developer = {
  id: 77,
  email: 'oidc@example.invalid',
  teamId: 2,
  role: 'member',
  isActive: true,
  tokenVersion: 0,
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(createAuthMiddleware(env, async () => developer));
  app.get('/metrics/me', userOnly, (req, res) => {
    res.json({ developerId: req.user?.kind === 'user' ? req.user.developerId : null });
  });
  app.get('/auth/me', userOnly, (req, res) => {
    res.json(req.user);
  });
  app.get('/admin', adminOnly, (_req, res) => {
    res.json({ ok: true });
  });
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (error?: Error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Test server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('authentication HTTP boundary', () => {
  it('allows service management access but rejects personal metrics', async () => {
    const headers = { 'x-api-key': 'service-test-key' };
    const [management, personal] = await Promise.all([
      fetch(`${baseUrl}/admin`, { headers }),
      fetch(`${baseUrl}/metrics/me`, { headers }),
    ]);
    expect(management.status).toBe(200);
    expect(personal.status).toBe(403);
    expect(await personal.json()).toMatchObject({
      message: expect.stringContaining('个人身份缺失'),
    });
  });

  it('uses the authenticated OIDC developer for personal metrics', async () => {
    const token = jwt.sign(
      {
        developerId: 77,
        email: 'oidc@example.invalid',
        teamId: 2,
        isAdmin: false,
        tokenVersion: 0,
      },
      jwtSecret,
      {
        expiresIn: '5m',
        issuer: 'opsx-metrics-server',
        audience: 'opsx-metrics-api',
      },
    );
    const response = await fetch(`${baseUrl}/metrics/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ developerId: 77 });
  });

  it('returns current database authorization for the authenticated identity', async () => {
    const token = jwt.sign({ developerId: 77, tokenVersion: 0, isAdmin: true }, jwtSecret, {
      expiresIn: '5m',
      issuer: 'opsx-metrics-server',
      audience: 'opsx-metrics-api',
    });
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: 'user',
      developerId: 77,
      teamId: 2,
      isAdmin: false,
      tokenVersion: 0,
    });
  });

  it('rejects a current non-admin user from management APIs', async () => {
    const token = jwt.sign({ developerId: 77, tokenVersion: 0 }, jwtSecret, {
      expiresIn: '5m',
      issuer: 'opsx-metrics-server',
      audience: 'opsx-metrics-api',
    });
    const response = await fetch(`${baseUrl}/admin`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(403);
  });
});
