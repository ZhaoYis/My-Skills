import { describe, expect, it } from 'vitest';
import { parseWebsiteAuthConfig } from '@/lib/auth-config';

describe('website authentication configuration', () => {
  it('allows missing optional OIDC configuration outside production', () => {
    expect(parseWebsiteAuthConfig({ NODE_ENV: 'test' })).toMatchObject({
      metricsApiUrl: 'http://localhost:3001/api/v1',
      oidcIssuer: undefined,
    });
  });

  it('rejects malformed issuer and metrics API URLs', () => {
    expect(() =>
      parseWebsiteAuthConfig({ NODE_ENV: 'test', OIDC_ISSUER: 'not-a-url' }),
    ).toThrow('OIDC_ISSUER');
    expect(() =>
      parseWebsiteAuthConfig({ NODE_ENV: 'test', METRICS_API_URL: 'not-a-url' }),
    ).toThrow('METRICS_API_URL');
  });

  it('requires non-placeholder OIDC and exchange credentials in production', () => {
    expect(() => parseWebsiteAuthConfig({ NODE_ENV: 'production' })).toThrow(
      'OIDC_ISSUER is required',
    );
    expect(() =>
      parseWebsiteAuthConfig({
        NODE_ENV: 'production',
        METRICS_API_URL: 'https://metrics.internal/api/v1',
        METRICS_API_KEY: 'web.actual-production-secret',
        AUTH_SECRET: 'website-production-auth-secret-value',
        OIDC_ISSUER: 'https://sso.example.com',
        OIDC_CLIENT_ID: 'metrics-production',
        OIDC_CLIENT_SECRET: 'replace-me',
      }),
    ).toThrow('placeholder');
    expect(
      parseWebsiteAuthConfig({
        NODE_ENV: 'production',
        METRICS_API_URL: 'https://metrics.internal/api/v1',
        METRICS_API_KEY: 'web.actual-production-secret',
        AUTH_SECRET: 'website-production-auth-secret-value',
        OIDC_ISSUER: 'https://sso.corp.internal',
        OIDC_CLIENT_ID: 'metrics-production',
        OIDC_CLIENT_SECRET: 'strong-production-client-value',
      }),
    ).toMatchObject({ oidcClientId: 'metrics-production' });
  });

  it('rejects a missing or placeholder Auth.js secret in production', () => {
    const production = {
      NODE_ENV: 'production' as const,
      METRICS_API_URL: 'https://metrics.internal/api/v1',
      METRICS_API_KEY: 'web.actual-production-secret',
      OIDC_ISSUER: 'https://sso.corp.internal',
      OIDC_CLIENT_ID: 'metrics-production',
      OIDC_CLIENT_SECRET: 'strong-production-client-value',
    };
    expect(() => parseWebsiteAuthConfig(production)).toThrow('AUTH_SECRET is required');
    expect(() =>
      parseWebsiteAuthConfig({ ...production, AUTH_SECRET: 'replace-with-a-real-secret-value' }),
    ).toThrow('AUTH_SECRET cannot use a placeholder');
  });

  it('rejects weak production secrets and non-HTTPS identity endpoints', () => {
    const production = {
      NODE_ENV: 'production' as const,
      METRICS_API_URL: 'https://metrics.internal/api/v1',
      METRICS_API_KEY: 'web.actual-production-secret',
      AUTH_SECRET: 'website-production-auth-secret-value',
      OIDC_ISSUER: 'https://sso.corp.internal',
      OIDC_CLIENT_ID: 'metrics-production',
      OIDC_CLIENT_SECRET: 'strong-production-client-value',
    };
    expect(() => parseWebsiteAuthConfig({ ...production, AUTH_SECRET: 'short-secret' })).toThrow(
      'at least 32',
    );
    expect(() =>
      parseWebsiteAuthConfig({ ...production, METRICS_API_KEY: 'missing-key-id-separator' }),
    ).toThrow('keyId.secret');
    expect(() =>
      parseWebsiteAuthConfig({ ...production, OIDC_ISSUER: 'http://sso.corp.internal' }),
    ).toThrow('HTTPS');
  });
});
