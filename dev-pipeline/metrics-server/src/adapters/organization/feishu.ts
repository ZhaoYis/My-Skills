import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { type OrgData, OrgDataSchema } from '../../services/sync-service.js';
import {
  canonicalSlug,
  type OrganizationAdapter,
  OrganizationAdapterError,
  sanitizeAdapterMessage,
} from './types.js';

const apiEnvelope = z.object({ code: z.number(), msg: z.string().optional() }).passthrough();
const tokenEnvelope = apiEnvelope.extend({ tenant_access_token: z.string().optional() });
const department = z.object({
  department_id: z.string(),
  name: z.string(),
  parent_department_id: z.string().nullable().optional(),
});
const user = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  department_ids: z.array(z.string()).optional().default([]),
});
const departmentPage = apiEnvelope.extend({
  data: z.object({
    items: z.array(department).optional().default([]),
    has_more: z.boolean().optional().default(false),
    page_token: z.string().optional(),
  }),
});
const userPage = apiEnvelope.extend({
  data: z.object({
    items: z.array(user).optional().default([]),
    has_more: z.boolean().optional().default(false),
    page_token: z.string().optional(),
  }),
});

type FeishuDepartment = z.infer<typeof department>;
type FeishuUser = z.infer<typeof user>;

export function convertFeishuOrganization(input: {
  departments: FeishuDepartment[];
  users: FeishuUser[];
}): OrgData {
  const departmentIds = new Set(input.departments.map((item) => item.department_id));
  return OrgDataSchema.parse({
    teams: input.departments.map((item, index) => ({
      externalId: item.department_id,
      name: item.name,
      slug: canonicalSlug('feishu', item.department_id, index),
      parentExternalId:
        item.parent_department_id && departmentIds.has(item.parent_department_id)
          ? item.parent_department_id
          : null,
    })),
    developers: input.users.map((item) => {
      if (!item.email) {
        throw new OrganizationAdapterError(
          'invalid-response',
          `Feishu user ${item.user_id} does not expose an email address`,
        );
      }
      return {
        externalId: item.user_id,
        email: item.email,
        name: item.name,
        teamExternalId: item.department_ids.find((id) => departmentIds.has(id)) ?? null,
      };
    }),
  });
}

function responseCategory(status: number) {
  if (status === 401) return 'authentication' as const;
  if (status === 403) return 'authorization' as const;
  if (status === 429) return 'rate-limit' as const;
  return 'upstream' as const;
}

export function createFeishuAdapter(
  env: Pick<Env, 'FEISHU_BASE_URL' | 'FEISHU_APP_ID' | 'FEISHU_APP_SECRET'>,
  fetcher: typeof fetch = fetch,
): OrganizationAdapter {
  const configured = Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET);
  const secrets = [env.FEISHU_APP_ID, env.FEISHU_APP_SECRET];

  async function request(url: URL, init?: RequestInit) {
    try {
      const response = await fetcher(url, init);
      if (!response.ok) {
        throw new OrganizationAdapterError(
          responseCategory(response.status),
          `Feishu request failed with HTTP ${response.status}`,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof OrganizationAdapterError) throw error;
      throw new OrganizationAdapterError(
        'network',
        sanitizeAdapterMessage(
          error instanceof Error ? error.message : 'Feishu network request failed',
          secrets,
        ),
        { cause: error },
      );
    }
  }

  return {
    name: 'feishu',
    configured,
    supportsPull: true,
    async pull() {
      if (!env.FEISHU_APP_ID || !env.FEISHU_APP_SECRET) {
        throw new OrganizationAdapterError('credentials', 'Feishu adapter credentials are missing');
      }
      const tokenUrl = new URL(
        '/open-apis/auth/v3/tenant_access_token/internal',
        env.FEISHU_BASE_URL,
      );
      const rawToken = await request(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
      });
      const tokenResult = tokenEnvelope.safeParse(rawToken);
      if (
        !tokenResult.success ||
        tokenResult.data.code !== 0 ||
        !tokenResult.data.tenant_access_token
      ) {
        throw new OrganizationAdapterError(
          'authentication',
          'Feishu rejected the configured credentials',
        );
      }
      const authorization = `Bearer ${tokenResult.data.tenant_access_token}`;

      async function collectPages<T>(
        pathname: string,
        schema: typeof departmentPage | typeof userPage,
      ): Promise<T[]> {
        const items: T[] = [];
        let pageToken: string | undefined;
        do {
          const url = new URL(pathname, env.FEISHU_BASE_URL);
          url.searchParams.set('page_size', '50');
          if (pageToken) url.searchParams.set('page_token', pageToken);
          const parsed = schema.safeParse(await request(url, { headers: { authorization } }));
          if (!parsed.success || parsed.data.code !== 0) {
            throw new OrganizationAdapterError(
              'invalid-response',
              'Feishu returned an invalid page',
            );
          }
          items.push(...(parsed.data.data.items as T[]));
          pageToken = parsed.data.data.has_more ? parsed.data.data.page_token : undefined;
          if (parsed.data.data.has_more && !pageToken) {
            throw new OrganizationAdapterError(
              'invalid-response',
              'Feishu pagination response omitted page_token',
            );
          }
        } while (pageToken);
        return items;
      }

      const [departments, users] = await Promise.all([
        collectPages<FeishuDepartment>(
          '/open-apis/contact/v3/departments/0/children',
          departmentPage,
        ),
        collectPages<FeishuUser>('/open-apis/contact/v3/users/find_by_department', userPage),
      ]);
      return convertFeishuOrganization({ departments, users });
    },
  };
}
