export interface WebsiteAuthConfig {
  metricsApiUrl: string;
  metricsServiceKey?: string;
  authSecret?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
}

function value(input: NodeJS.ProcessEnv, name: string) {
  const configured = input[name]?.trim();
  return configured || undefined;
}

function placeholder(configured: string) {
  return /(replace|placeholder|change[-_ ]?me|example|playwright|test[-_ ]?secret)/i.test(configured);
}

export function parseWebsiteAuthConfig(input: NodeJS.ProcessEnv): WebsiteAuthConfig {
  const production = input.NODE_ENV === 'production';
  const metricsApiUrl = value(input, 'METRICS_API_URL') ?? 'http://localhost:3001/api/v1';
  const oidcIssuer = value(input, 'OIDC_ISSUER');
  const oidcClientId = value(input, 'OIDC_CLIENT_ID');
  const oidcClientSecret = value(input, 'OIDC_CLIENT_SECRET');
  const metricsServiceKey = value(input, 'METRICS_API_KEY');
  const authSecret = value(input, 'AUTH_SECRET');
  for (const [name, configured] of [
    ['METRICS_API_URL', metricsApiUrl],
    ['OIDC_ISSUER', oidcIssuer],
  ] as const) {
    if (!configured) continue;
    try {
      new URL(configured);
    } catch {
      throw new Error(`${name} must be a valid URL`);
    }
  }
  if (production) {
    for (const [name, configured] of [
      ['OIDC_ISSUER', oidcIssuer],
      ['OIDC_CLIENT_ID', oidcClientId],
      ['OIDC_CLIENT_SECRET', oidcClientSecret],
      ['METRICS_API_KEY', metricsServiceKey],
      ['AUTH_SECRET', authSecret],
    ] as const) {
      if (!configured) throw new Error(`${name} is required in production`);
      if (placeholder(configured)) throw new Error(`${name} cannot use a placeholder in production`);
    }
    if ((authSecret?.length ?? 0) < 32) {
      throw new Error('AUTH_SECRET must be at least 32 characters in production');
    }
    if ((oidcClientSecret?.length ?? 0) < 16) {
      throw new Error('OIDC_CLIENT_SECRET must be at least 16 characters in production');
    }
    const separator = metricsServiceKey?.indexOf('.') ?? -1;
    if (separator < 1 || (metricsServiceKey?.length ?? 0) - separator - 1 < 16) {
      throw new Error('METRICS_API_KEY must use keyId.secret format with a strong secret');
    }
    for (const [name, configured] of [
      ['METRICS_API_URL', metricsApiUrl],
      ['OIDC_ISSUER', oidcIssuer],
    ] as const) {
      if (configured && new URL(configured).protocol !== 'https:') {
        throw new Error(`${name} must use HTTPS in production`);
      }
    }
  }
  return {
    metricsApiUrl,
    metricsServiceKey,
    authSecret,
    oidcIssuer,
    oidcClientId,
    oidcClientSecret,
  };
}

export function getWebsiteAuthConfig() {
  return parseWebsiteAuthConfig(process.env);
}
