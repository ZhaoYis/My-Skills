import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import {
  endpointKey,
  endpointRegistry,
  metricsFilterQuerySchema,
  paginationQuerySchema,
  positiveBigIntId,
  positiveId,
} from '../src/api/contracts/registry.js';
import { fail, ok } from '../src/api/response.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const routePrefixes: Record<string, string> = {
  'auth.ts': '/auth',
  'collection.ts': '/collection',
  'developers.ts': '/developers',
  'metrics.ts': '/metrics',
  'repos.ts': '/repos',
  'sync.ts': '/sync',
  'teams.ts': '/teams',
};

async function expressEndpointKeys() {
  const keys = ['GET /health', 'GET /health/live', 'GET /health/ready', 'GET /auth/me'];
  for (const [file, prefix] of Object.entries(routePrefixes)) {
    const source = await readFile(`${root}/src/api/routes/${file}`, 'utf8');
    const matches = source.matchAll(
      /[A-Za-z]+Routes\.(get|post|put|patch|delete)\(\s*['`]([^'`]+)['`]/g,
    );
    for (const match of matches) {
      const localPath = match[2] === '/' ? '' : match[2];
      keys.push(`${match[1]?.toUpperCase()} ${prefix}${localPath}`);
    }
  }
  return keys.sort();
}

function response() {
  const state: { status?: number; body?: unknown } = {};
  const res = {
    status(status: number) {
      state.status = status;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, state };
}

describe('API endpoint registry', () => {
  it('matches every Express endpoint exactly once', async () => {
    const registered = endpointRegistry.map(endpointKey).sort();
    expect(new Set(registered).size).toBe(registered.length);
    expect(registered).toEqual(await expressEndpointKeys());
  });

  it('registers input, success, and applicable error schemas for every endpoint', () => {
    for (const endpoint of endpointRegistry) {
      expect(endpoint.params).toBeDefined();
      expect(endpoint.query).toBeDefined();
      expect(endpoint.body).toBeDefined();
      expect(
        endpoint.success.safeParse({ success: true, code: 200, message: 'ok', data: null }).success,
      ).toBe(true);
      for (const status of endpoint.errors) {
        expect(
          endpoint.error.safeParse({ success: false, code: status, message: 'error', data: null })
            .success,
        ).toBe(true);
      }
      if (endpoint.auth !== 'public') {
        expect(endpoint.errors).toEqual(expect.arrayContaining([401, 403]));
      }
    }
  });

  it('rejects invalid IDs, pagination, and metric filters instead of normalizing them', () => {
    for (const value of ['NaN', '0', '-1', '1.2'])
      expect(positiveId.safeParse(value).success).toBe(false);
    for (const value of ['0', '-1', '1.2', 'NaN'])
      expect(positiveBigIntId.safeParse(value).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageNum: '-1' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(metricsFilterQuerySchema.safeParse({ days: '31' }).success).toBe(false);
    expect(metricsFilterQuerySchema.safeParse({ days: '30', repoId: '0' }).success).toBe(false);
  });

  it('serializes BigInt and Date values through one validated response boundary', () => {
    const success = response();
    ok(success.res, { id: 12n, at: new Date('2026-07-28T00:00:00.000Z') });
    expect(success.state.body).toMatchObject({
      success: true,
      data: { id: '12', at: '2026-07-28T00:00:00.000Z' },
    });

    const error = response();
    fail(error.res, 409, 'conflict', {
      code: 'CONFLICT',
      details: { id: 12n, at: new Date('2026-07-28T00:00:00.000Z') },
    });
    expect(error.state.body).toMatchObject({
      success: false,
      code: 'CONFLICT',
      details: { id: '12', at: '2026-07-28T00:00:00.000Z' },
    });
  });

  it('keeps generated OpenAPI operations synchronized with the registry', async () => {
    const openApi = JSON.parse(await readFile(`${root}/docs/openapi.json`, 'utf8')) as {
      paths: Record<string, Record<string, unknown>>;
    };
    const operationCount = Object.values(openApi.paths).reduce(
      (count, path) =>
        count +
        Object.keys(path).filter((method) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(method),
        ).length,
      0,
    );
    expect(operationCount).toBe(endpointRegistry.length);
    const generated = await readFile(
      `${root}/../metrics-website/lib/generated/api-contract.ts`,
      'utf8',
    );
    expect(generated).toContain(`export type ApiEndpointKey =`);
    expect(generated).toContain(JSON.stringify(endpointKey(endpointRegistry[0])));
  });
});
