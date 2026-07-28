import type { Env } from '../../config/env.js';
import { getEnv } from '../../config/env.js';
import { createFeishuAdapter } from './feishu.js';
import {
  type OrganizationAdapter,
  OrganizationAdapterError,
  type OrganizationAdapterName,
} from './types.js';

function conversionOnlyAdapter(
  name: Exclude<OrganizationAdapterName, 'feishu'>,
  configured: boolean,
): OrganizationAdapter {
  return {
    name,
    configured,
    supportsPull: false,
    async pull() {
      throw new OrganizationAdapterError(
        'credentials',
        `${name} direct pull is not enabled; use the canonical conversion module`,
      );
    },
  };
}

export function createOrganizationAdapterRegistry(env: Env = getEnv()) {
  return new Map<OrganizationAdapterName, OrganizationAdapter>([
    ['feishu', createFeishuAdapter(env)],
    [
      'ldap',
      conversionOnlyAdapter(
        'ldap',
        Boolean(env.LDAP_URL && env.LDAP_BIND_DN && env.LDAP_BIND_PASSWORD),
      ),
    ],
    ['wecom', conversionOnlyAdapter('wecom', Boolean(env.WECOM_CORP_ID && env.WECOM_CORP_SECRET))],
  ]);
}

export function publicAdapterStatuses(registry = createOrganizationAdapterRegistry()) {
  return [...registry.values()].map(({ name, configured, supportsPull }) => ({
    name,
    configured,
    supportsPull,
  }));
}
