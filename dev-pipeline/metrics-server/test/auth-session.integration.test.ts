import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const database = enabled
  ? new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL })
  : null;
const db = database as PrismaClient;
const jwtSecret = 'm013-session-integration-secret-at-least-32-characters';
const email = 'm013-session@example.invalid';
const secrets = {
  oldExchange: 'm013-old-exchange-secret',
  newExchange: 'm013-new-exchange-secret',
  management: 'm013-management-secret',
};
let server: Server | undefined;
let baseUrl = '';
let disconnectAppDatabase: (() => Promise<void>) | undefined;

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function serviceKey(keyId: keyof typeof secrets) {
  return `${keyId}.${secrets[keyId]}`;
}

function request(path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

describe.runIf(enabled)('OIDC session exchange and current authorization', () => {
  beforeAll(async () => {
    await db.developer.deleteMany({ where: { email } });
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_PROVIDER: 'postgresql',
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: jwtSecret,
      JWT_ISSUER: 'm013-metrics-server',
      JWT_AUDIENCE: 'm013-metrics-api',
      API_KEY: '',
      SERVICE_API_KEYS: JSON.stringify({
        oldExchange: {
          sha256: sha256(secrets.oldExchange),
          purposes: ['session-exchange'],
        },
        newExchange: {
          sha256: sha256(secrets.newExchange),
          purposes: ['session-exchange'],
        },
        management: {
          sha256: sha256(secrets.management),
          purposes: ['management'],
        },
      }),
    });
    const [{ apiRouter }, { prisma }] = await Promise.all([
      import('../src/api/router.js'),
      import('../src/config/database.js'),
    ]);
    disconnectAppDatabase = () => prisma.$disconnect();
    const app = express();
    app.use(express.json());
    app.use('/api/v1', apiRouter);
    const listeningServer = app.listen(0, '127.0.0.1');
    server = listeningServer;
    await new Promise<void>((resolve, reject) => {
      listeningServer.once('listening', resolve);
      listeningServer.once('error', reject);
    });
    const address = listeningServer.address();
    if (!address || typeof address === 'string') throw new Error('HTTP test server did not start');
    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  it('enforces service-key purpose and supports exchange-key rotation', async () => {
    const body = JSON.stringify({ email, name: 'M013 Developer', sub: 'm013-oidc-subject' });
    const deniedExchange = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('management') },
      body,
    });
    expect(deniedExchange.status).toBe(401);

    const oldExchange = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('oldExchange') },
      body,
    });
    expect(oldExchange.status).toBe(200);
    const oldPayload = (await oldExchange.json()) as { data: { token: string } };
    expect(
      jwt.verify(oldPayload.data.token, jwtSecret, {
        issuer: 'm013-metrics-server',
        audience: 'm013-metrics-api',
      }),
    ).toMatchObject({ tokenVersion: 0, sub: expect.any(String) });

    const exchangeCannotManage = await request('/teams', {
      headers: { 'x-api-key': serviceKey('newExchange') },
    });
    expect(exchangeCannotManage.status).toBe(403);
    const managementCanManage = await request('/teams', {
      headers: { 'x-api-key': serviceKey('management') },
    });
    expect(managementCanManage.status).toBe(200);

    const newExchange = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('newExchange') },
      body,
    });
    expect(newExchange.status).toBe(200);
  });

  it('applies role changes, token revocation, and account deactivation immediately', async () => {
    const initial = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('newExchange') },
      body: JSON.stringify({ email, name: 'M013 Developer', sub: 'm013-oidc-subject' }),
    });
    const initialPayload = (await initial.json()) as { data: { token: string } };
    const developer = await db.developer.update({
      where: { email },
      data: { role: 'admin', tokenVersion: { increment: 1 } },
    });

    const revoked = await request('/auth/me', {
      headers: { authorization: `Bearer ${initialPayload.data.token}` },
    });
    expect(revoked.status).toBe(401);

    const refreshed = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('newExchange') },
      body: JSON.stringify({ email, name: 'M013 Admin', sub: 'm013-oidc-subject' }),
    });
    const refreshedPayload = (await refreshed.json()) as { data: { token: string } };
    const current = await request('/auth/me', {
      headers: { authorization: `Bearer ${refreshedPayload.data.token}` },
    });
    expect(current.status).toBe(200);
    expect(await current.json()).toMatchObject({
      data: { developerId: developer.id, isAdmin: true, tokenVersion: 1 },
    });

    await db.developer.update({ where: { email }, data: { isActive: false } });
    const inactiveSession = await request('/auth/session', {
      method: 'POST',
      headers: { 'x-api-key': serviceKey('newExchange') },
      body: JSON.stringify({ email, name: 'M013 Admin', sub: 'm013-oidc-subject' }),
    });
    expect(inactiveSession.status).toBe(403);
    const inactiveToken = await request('/auth/me', {
      headers: { authorization: `Bearer ${refreshedPayload.data.token}` },
    });
    expect(inactiveToken.status).toBe(401);
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectAppDatabase?.();
  await db?.developer.deleteMany({ where: { email } });
  await database?.$disconnect();
});
