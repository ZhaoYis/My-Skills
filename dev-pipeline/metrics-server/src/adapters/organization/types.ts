import type { OrgData } from '../../services/sync-service.js';

export const organizationAdapterNames = ['feishu', 'ldap', 'wecom'] as const;
export type OrganizationAdapterName = (typeof organizationAdapterNames)[number];
export type AdapterErrorCategory =
  | 'credentials'
  | 'authentication'
  | 'authorization'
  | 'rate-limit'
  | 'network'
  | 'upstream'
  | 'invalid-response';

export class OrganizationAdapterError extends Error {
  constructor(
    public readonly category: AdapterErrorCategory,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'OrganizationAdapterError';
  }
}

export interface OrganizationAdapter {
  name: OrganizationAdapterName;
  configured: boolean;
  supportsPull: boolean;
  pull(): Promise<OrgData>;
}

export function sanitizeAdapterMessage(message: string, secrets: Array<string | undefined>) {
  return secrets.reduce<string>(
    (safe, secret) => (secret ? safe.replaceAll(secret, '[REDACTED]') : safe),
    message,
  );
}

export function classifyAdapterError(error: unknown): {
  category: AdapterErrorCategory;
  message: string;
} {
  if (error instanceof OrganizationAdapterError) {
    return { category: error.category, message: error.message };
  }
  return {
    category: 'upstream',
    message: error instanceof Error ? error.message : 'External organization adapter failed',
  };
}

export function canonicalSlug(prefix: OrganizationAdapterName, value: string, index: number) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefix}-${normalized || index}`.slice(0, 128);
}
