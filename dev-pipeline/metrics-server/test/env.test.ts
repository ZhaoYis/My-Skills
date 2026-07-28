import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { hashServiceApiKey } from '../src/services/service-key-service.js';

const tmpDir = mkdtempSync(join(tmpdir(), 'env-test-'));
const keyPath = join(tmpDir, 'private.pem');

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
};
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
writeFileSync(keyPath, privateKey);
const productionEnv = {
  ...baseEnv,
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://postgres:password@db.internal:5432/metrics',
  JWT_SECRET: 'strong-production-jwt-secret-value-1234',
  JWT_ISSUER: 'corp-metrics-server',
  JWT_AUDIENCE: 'corp-metrics-api',
  SERVICE_API_KEYS: JSON.stringify({
    web: {
      sha256: hashServiceApiKey('strong-production-service-key-value'),
      purposes: ['session-exchange', 'management'],
    },
  }),
  FINGERPRINT_PRIVATE_KEYS_PATH: keyPath,
  CORS_ORIGIN: 'https://metrics.corp.internal',
};

describe('database environment validation', () => {
  it.each([
    ['postgresql', 'postgresql://postgres:password@localhost:5432/metrics'],
    ['postgresql', 'postgres://postgres:password@localhost:5432/metrics'],
    ['mysql', 'mysql://root:password@localhost:3306/metrics'],
  ])('accepts %s with a matching URL', (provider, databaseUrl) => {
    expect(
      parseEnv({ ...baseEnv, DB_PROVIDER: provider, DATABASE_URL: databaseUrl }).DB_PROVIDER,
    ).toBe(provider);
  });

  it.each([
    ['postgresql', 'mysql://root:password@localhost:3306/metrics'],
    ['mysql', 'postgresql://postgres:password@localhost:5432/metrics'],
  ])('rejects %s with a mismatched URL', (provider, databaseUrl) => {
    expect(() =>
      parseEnv({ ...baseEnv, DB_PROVIDER: provider, DATABASE_URL: databaseUrl }),
    ).toThrow(`does not match DB_PROVIDER=${provider}`);
  });

  it('rejects a malformed database URL', () => {
    expect(() =>
      parseEnv({ ...baseEnv, DB_PROVIDER: 'postgresql', DATABASE_URL: 'not-a-url' }),
    ).toThrow();
  });

  it('bounds collector transaction retry settings', () => {
    expect(
      parseEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
        COLLECTOR_TRANSACTION_RETRIES: '4',
        COLLECTOR_RETRY_BASE_DELAY: '25',
      }),
    ).toMatchObject({ COLLECTOR_TRANSACTION_RETRIES: 4, COLLECTOR_RETRY_BASE_DELAY: 25 });
    expect(() =>
      parseEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
        COLLECTOR_TRANSACTION_RETRIES: '0',
      }),
    ).toThrow();
  });

  it('treats empty optional adapter credentials as not configured', () => {
    expect(
      parseEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
        FEISHU_APP_ID: '',
        FEISHU_APP_SECRET: '',
        LDAP_URL: '',
      }),
    ).toMatchObject({
      FEISHU_APP_ID: undefined,
      FEISHU_APP_SECRET: undefined,
      LDAP_URL: undefined,
    });
  });

  it('parses issuer, audience, and multiple hashed service-key purposes', () => {
    expect(
      parseEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/metrics',
        JWT_ISSUER: 'metrics-issuer',
        JWT_AUDIENCE: 'metrics-audience',
        SERVICE_API_KEYS: JSON.stringify({
          web: {
            sha256: hashServiceApiKey('web-secret'),
            purposes: ['session-exchange', 'management'],
          },
        }),
      }),
    ).toMatchObject({
      JWT_ISSUER: 'metrics-issuer',
      JWT_AUDIENCE: 'metrics-audience',
      SERVICE_API_KEYS: { web: { purposes: ['session-exchange', 'management'] } },
    });
  });

  it('accepts a complete non-placeholder production configuration', () => {
    expect(parseEnv(productionEnv)).toMatchObject({ NODE_ENV: 'production' });
  });

  it('rejects raw, missing hashed, and placeholder authentication secrets in production', () => {
    expect(() =>
      parseEnv({
        ...productionEnv,
        API_KEY: 'raw-production-key',
      }),
    ).toThrow('Raw API_KEY');
    expect(() => parseEnv({ ...productionEnv, SERVICE_API_KEYS: '{}' })).toThrow(
      'hashed service API key',
    );
    expect(() =>
      parseEnv({
        ...productionEnv,
        JWT_SECRET: 'replace-with-at-least-32-characters',
      }),
    ).toThrow('JWT_SECRET cannot use a placeholder');
    expect(() =>
      parseEnv({
        ...productionEnv,
        SERVICE_API_KEYS: JSON.stringify({
          placeholder: {
            sha256: hashServiceApiKey('strong-production-service-key-value'),
            purposes: ['management'],
          },
        }),
      }),
    ).toThrow('placeholder key IDs');
    expect(() =>
      parseEnv({
        ...productionEnv,
        SERVICE_API_KEYS: JSON.stringify({
          web: { sha256: hashServiceApiKey('replace-me'), purposes: ['management'] },
        }),
      }),
    ).toThrow('placeholder key IDs');
  });

  it.each(['JWT_ISSUER', 'JWT_AUDIENCE'] as const)(
    'rejects placeholder %s values in production',
    (name) => {
      expect(() => parseEnv({ ...productionEnv, [name]: 'example-placeholder-value' })).toThrow(
        name,
      );
    },
  );

  it('rejects missing, invalid, or undersized fingerprint keys in production', () => {
    expect(() =>
      parseEnv({ ...productionEnv, FINGERPRINT_PRIVATE_KEYS_PATH: '/nonexistent/key.pem' }),
    ).toThrow('FINGERPRINT_PRIVATE_KEYS_PATH');
    const weak = generateKeyPairSync('rsa', {
      modulusLength: 1024,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
    const weakPath = join(tmpDir, 'weak.pem');
    writeFileSync(weakPath, weak);
    expect(() =>
      parseEnv({
        ...productionEnv,
        FINGERPRINT_PRIVATE_KEYS_PATH: weakPath,
      }),
    ).toThrow('RSA-2048');
  });

  it('rejects local or placeholder CORS origins in production', () => {
    expect(() => parseEnv({ ...productionEnv, CORS_ORIGIN: 'http://localhost:3000' })).toThrow(
      'CORS_ORIGIN',
    );
    expect(() => parseEnv({ ...productionEnv, CORS_ORIGIN: 'https://example.com' })).toThrow(
      'CORS_ORIGIN',
    );
  });

  it('requires complete adapter credential sets and rejects configured placeholders', () => {
    expect(() => parseEnv({ ...productionEnv, FEISHU_APP_ID: 'corp-app' })).toThrow(
      'FEISHU_APP_ID, FEISHU_APP_SECRET',
    );
    expect(() =>
      parseEnv({
        ...productionEnv,
        LDAP_URL: 'ldaps://ldap.corp.internal',
        LDAP_BIND_DN: 'cn=metrics',
      }),
    ).toThrow('LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD');
    expect(() => parseEnv({ ...productionEnv, WECOM_CORP_ID: 'corp-id' })).toThrow(
      'WECOM_CORP_ID, WECOM_CORP_SECRET',
    );
    expect(() =>
      parseEnv({
        ...productionEnv,
        FEISHU_APP_ID: 'corp-app',
        FEISHU_APP_SECRET: 'replace-me',
      }),
    ).toThrow('FEISHU_APP_SECRET');
  });
});
