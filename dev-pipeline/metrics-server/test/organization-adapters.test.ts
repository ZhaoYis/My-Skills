import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  convertFeishuOrganization,
  createFeishuAdapter,
} from '../src/adapters/organization/feishu.js';
import { convertLdapOrganization } from '../src/adapters/organization/ldap.js';
import { publicAdapterStatuses } from '../src/adapters/organization/registry.js';
import { OrganizationAdapterError } from '../src/adapters/organization/types.js';
import { convertWecomOrganization } from '../src/adapters/organization/wecom.js';

async function fixture(name: string) {
  const path = fileURLToPath(new URL(`./fixtures/organization/${name}.json`, import.meta.url));
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

describe('organization adapter contracts', () => {
  it('converts Feishu, LDAP, and WeCom fixtures to the same canonical identity semantics', async () => {
    const [feishu, ldap, wecom] = await Promise.all([
      fixture('feishu'),
      fixture('ldap'),
      fixture('wecom'),
    ]);
    const converted = [
      convertFeishuOrganization(feishu as Parameters<typeof convertFeishuOrganization>[0]),
      convertLdapOrganization(ldap),
      convertWecomOrganization(wecom),
    ];
    for (const organization of converted) {
      expect(organization).toMatchObject({
        teams: [{ name: 'Engineering', parentExternalId: null }, { name: 'Platform' }],
        developers: [{ name: 'Alice', email: 'alice@example.test' }],
      });
      expect(organization.developers[0]?.teamExternalId).toBe(organization.teams[1]?.externalId);
    }
  });

  it('pulls every Feishu page with a server-side bearer token', async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      requests.push({ url, init });
      if (url.pathname.includes('tenant_access_token')) {
        return Response.json({ code: 0, tenant_access_token: 'tenant-token' });
      }
      const isSecondPage = url.searchParams.get('page_token') === 'next';
      if (url.pathname.includes('/departments/')) {
        return Response.json({
          code: 0,
          data: {
            items: isSecondPage
              ? [{ department_id: 'platform', name: 'Platform', parent_department_id: 'root' }]
              : [{ department_id: 'root', name: 'Engineering', parent_department_id: '0' }],
            has_more: !isSecondPage,
            page_token: isSecondPage ? undefined : 'next',
          },
        });
      }
      return Response.json({
        code: 0,
        data: {
          items: isSecondPage
            ? []
            : [
                {
                  user_id: 'alice',
                  name: 'Alice',
                  email: 'alice@example.test',
                  department_ids: ['platform'],
                },
              ],
          has_more: !isSecondPage,
          page_token: isSecondPage ? undefined : 'next',
        },
      });
    });
    const adapter = createFeishuAdapter(
      {
        FEISHU_BASE_URL: 'https://open.feishu.test',
        FEISHU_APP_ID: 'app-id',
        FEISHU_APP_SECRET: 'app-secret',
      },
      fetcher as typeof fetch,
    );
    const organization = await adapter.pull();
    expect(organization.teams).toHaveLength(2);
    expect(organization.developers).toHaveLength(1);
    expect(requests.filter(({ url }) => url.searchParams.has('page_token'))).toHaveLength(2);
    expect(
      requests
        .filter(({ url }) => !url.pathname.includes('tenant_access_token'))
        .every(
          ({ init }) =>
            (init?.headers as Record<string, string> | undefined)?.authorization ===
            'Bearer tenant-token',
        ),
    ).toBe(true);
  });

  it('classifies missing credentials and redacts secrets from network errors', async () => {
    await expect(
      createFeishuAdapter({ FEISHU_BASE_URL: 'https://open.feishu.test' }).pull(),
    ).rejects.toMatchObject({ category: 'credentials' });
    const adapter = createFeishuAdapter(
      {
        FEISHU_BASE_URL: 'https://open.feishu.test',
        FEISHU_APP_ID: 'private-app-id',
        FEISHU_APP_SECRET: 'private-app-secret',
      },
      vi.fn(async () => {
        throw new Error('socket failed for private-app-secret');
      }) as typeof fetch,
    );
    const error = await adapter.pull().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(OrganizationAdapterError);
    expect((error as Error).message).not.toContain('private-app-secret');
  });

  it('exposes adapter readiness without returning credential values', () => {
    const statuses = publicAdapterStatuses(
      new Map([
        [
          'feishu',
          createFeishuAdapter({
            FEISHU_BASE_URL: 'https://open.feishu.test',
            FEISHU_APP_ID: 'private-app-id',
            FEISHU_APP_SECRET: 'private-app-secret',
          }),
        ],
      ]),
    );
    expect(statuses).toEqual([{ name: 'feishu', configured: true, supportsPull: true }]);
    expect(JSON.stringify(statuses)).not.toContain('private-app');
  });
});
