import { z } from 'zod';

export const positiveId = z.coerce.number().int().positive();
export const positiveBigIntId = z
  .string()
  .regex(/^[1-9]\d*$/, '必须为正整数 ID')
  .transform((value) => BigInt(value));
export const paginationQuerySchema = z.object({
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const metricsFilterQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((value) => [7, 30, 90].includes(value), '时间范围必须为 7、30 或 90 天')
    .default(30),
  repoId: positiveId.optional(),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  code: z.union([z.string(), z.number()]),
  message: z.string(),
  data: z.null(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

export const apiSuccessSchema = z.object({
  success: z.literal(true),
  code: z.number().int(),
  message: z.string(),
  data: z.unknown(),
});

const idParams = z.object({ id: positiveId });
const bigintIdParams = z.object({ id: positiveBigIntId });
const teamParams = z.object({ teamId: positiveId });
const memberParams = z.object({ teamId: positiveId, developerId: positiveId });
const adapterParams = z.object({ adapter: z.enum(['feishu', 'ldap', 'wecom']) });
const emptyObject = z.object({});
const sessionBody = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(255),
  sub: z.string().trim().min(1).max(255),
});
const repoBody = z.object({
  name: z.string().trim().min(1).max(255),
  gitUrl: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((value) => !value.startsWith('-')),
  gitBranch: z.string().trim().min(1).max(255).default('main'),
  collectSince: z.iso.datetime(),
  isActive: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(3650).default(365),
});
const teamBody = z.object({
  name: z.string().trim().min(1).max(128),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/),
  parentId: positiveId.nullable().optional(),
  externalId: z.string().trim().max(255).nullable().optional(),
});
const developerBody = z.object({
  teamId: positiveId.nullable().optional(),
  role: z.enum(['admin', 'member']).nullable().optional(),
  displayName: z.string().trim().min(1).max(255).optional(),
  externalId: z.string().trim().min(1).max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});
const triggerBody = z.object({
  dryRun: z.boolean().default(false),
  mode: z.enum(['trusted', 'history-import']).default('trusted'),
});
const orgBody = z.object({
  source: z.string().min(1).max(32),
  dryRun: z.boolean().default(false),
  teams: z.array(z.object({}).passthrough()).max(10_000),
  developers: z.array(z.object({}).passthrough()).max(100_000),
});

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
export type EndpointAuth = 'public' | 'user' | 'admin';

export interface EndpointContract {
  method: HttpMethod;
  path: string;
  auth: EndpointAuth;
  params: z.ZodType;
  query: z.ZodType;
  body: z.ZodType;
  successStatus: number;
  success: typeof apiSuccessSchema;
  errors: readonly number[];
  error: typeof apiErrorSchema;
}

interface EndpointOptions {
  auth?: EndpointAuth;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  successStatus?: number;
  errors?: readonly number[];
}

function endpoint(
  method: HttpMethod,
  path: string,
  options: EndpointOptions = {},
): EndpointContract {
  const auth = options.auth ?? 'admin';
  return {
    method,
    path,
    auth,
    params: options.params ?? emptyObject,
    query: options.query ?? emptyObject,
    body: options.body ?? emptyObject,
    successStatus: options.successStatus ?? 200,
    success: apiSuccessSchema,
    errors:
      options.errors ?? (auth === 'public' ? [400, 404, 409, 500] : [400, 401, 403, 404, 409, 500]),
    error: apiErrorSchema,
  };
}

const metricsQuery = metricsFilterQuerySchema;
const memberQuery = paginationQuerySchema
  .extend({
    q: z.string().trim().max(255).default(''),
    dataStatus: z.enum(['all', 'with-data', 'without-data']).default('all'),
    sortBy: z
      .enum([
        'displayName',
        'completedRuns',
        'completionRate',
        'avgCycleTimeMinutes',
        'avgReviewRounds',
      ])
      .default('displayName'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .extend(metricsFilterQuerySchema.shape);
const pageQuery = paginationQuerySchema;

export const endpointRegistry = [
  endpoint('get', '/health', { auth: 'public', errors: [500] }),
  endpoint('get', '/health/live', { auth: 'public', errors: [500] }),
  endpoint('get', '/health/ready', { auth: 'public', errors: [500, 503] }),
  endpoint('post', '/auth/session', {
    auth: 'public',
    body: sessionBody,
    errors: [400, 401, 403, 500],
  }),
  endpoint('get', '/auth/me', { auth: 'user', errors: [401, 403, 500] }),

  ...[
    '/metrics/me',
    '/metrics/me/cycle-time',
    '/metrics/me/phases',
    '/metrics/me/reviews',
    '/metrics/me/completions',
    '/metrics/me/pauses',
    '/metrics/me/bypasses',
  ].map((path) =>
    endpoint('get', path, { auth: 'user', query: metricsQuery, errors: [400, 401, 403, 500] }),
  ),
  endpoint('get', '/metrics/teams/visible', { auth: 'user', errors: [401, 403, 500] }),
  endpoint('get', '/metrics/team/:teamId', {
    auth: 'user',
    params: teamParams,
    query: metricsQuery,
  }),
  endpoint('get', '/metrics/team/:teamId/members', {
    auth: 'user',
    params: teamParams,
    query: memberQuery,
  }),
  endpoint('get', '/metrics/team/:teamId/members/:developerId', {
    auth: 'user',
    params: memberParams,
    query: metricsQuery,
  }),
  endpoint('get', '/metrics/team/:teamId/trend', {
    auth: 'user',
    params: teamParams,
    query: metricsQuery,
  }),
  endpoint('get', '/metrics/team/:teamId/phases', {
    auth: 'user',
    params: teamParams,
    query: metricsQuery,
  }),

  endpoint('get', '/repos', {
    query: pageQuery.extend({
      q: z.string().trim().max(255).optional(),
      status: z.enum(['all', 'active', 'inactive', 'error', 'deleted']).default('all'),
    }),
  }),
  endpoint('post', '/repos/test-connection', {
    body: repoBody.pick({ gitUrl: true, gitBranch: true }),
    errors: [400, 401, 403, 422, 500],
  }),
  endpoint('get', '/repos/:id', { params: idParams }),
  endpoint('get', '/repos/:id/retention', { params: idParams }),
  endpoint('get', '/repos/:id/retention/archive', {
    params: idParams,
    query: z.object({
      take: z.coerce.number().int().min(1).max(1000).default(100),
      cursor: positiveBigIntId.optional(),
    }),
  }),
  endpoint('post', '/repos/:id/retention', {
    params: idParams,
    body: z.object({ dryRun: z.boolean().default(true) }),
  }),
  endpoint('post', '/repos/:id/restore', { params: idParams }),
  endpoint('post', '/repos', { body: repoBody, successStatus: 201 }),
  endpoint('put', '/repos/:id', { params: idParams, body: repoBody.partial() }),
  endpoint('patch', '/repos/:id/status', {
    params: idParams,
    body: z.object({ isActive: z.boolean() }),
  }),
  endpoint('delete', '/repos/:id', { params: idParams }),
  endpoint('post', '/repos/:id/reset-collection', { params: idParams }),
  endpoint('post', '/repos/:id/collect', { params: idParams, successStatus: 202 }),

  endpoint('get', '/teams', {
    query: z.object({ status: z.enum(['all', 'active', 'inactive']).default('all') }),
  }),
  endpoint('post', '/teams', { body: teamBody, successStatus: 201 }),
  endpoint('put', '/teams/:id', { params: idParams, body: teamBody.partial() }),
  endpoint('delete', '/teams/:id', {
    params: idParams,
    body: z.object({
      childStrategy: z.enum(['reject', 'promote']).default('reject'),
      memberStrategy: z.enum(['reject', 'unassign', 'move']).default('reject'),
      targetTeamId: positiveId.optional(),
    }),
  }),

  endpoint('get', '/developers', {
    query: pageQuery.extend({
      q: z.string().trim().max(255).optional(),
      unassigned: z.enum(['true', 'false']).optional(),
      claim: z.enum(['all', 'linked', 'unlinked']).default('all'),
      status: z.enum(['all', 'active', 'inactive']).default('all'),
      teamId: positiveId.optional(),
    }),
  }),
  endpoint('put', '/developers/:id', { params: idParams, body: developerBody }),

  endpoint('get', '/collection/status'),
  endpoint('get', '/collection/logs', {
    query: pageQuery.extend({
      status: z
        .enum(['queued', 'running', 'completed', 'error', 'cancelled', 'timeout'])
        .optional(),
      repoId: positiveId.optional(),
    }),
  }),
  endpoint('get', '/collection/jobs/:id', { params: bigintIdParams }),
  endpoint('get', '/collection/history-imports', { query: pageQuery }),
  endpoint('post', '/collection/trigger', {
    body: triggerBody.extend({ repoId: z.number().int().positive() }),
    successStatus: 202,
  }),
  endpoint('post', '/collection/trigger-all', { body: triggerBody, successStatus: 202 }),
  endpoint('post', '/collection/jobs/:id/cancel', { params: bigintIdParams }),
  endpoint('post', '/collection/jobs/:id/retry', { params: bigintIdParams, successStatus: 202 }),

  endpoint('get', '/sync/adapters'),
  endpoint('post', '/sync/adapters/:adapter/preview', {
    params: adapterParams,
    errors: [400, 401, 403, 409, 502, 503],
  }),
  endpoint('post', '/sync/org/preview', { body: orgBody.omit({ dryRun: true }) }),
  endpoint('post', '/sync/org', { body: orgBody, successStatus: 202 }),
  endpoint('get', '/sync/logs', {
    query: pageQuery.extend({
      status: z.enum(['all', 'running', 'completed', 'error']).default('all'),
    }),
  }),
  endpoint('get', '/sync/logs/:id', { params: bigintIdParams }),
  endpoint('post', '/sync/logs/:id/apply', { params: bigintIdParams, successStatus: 202 }),
  endpoint('post', '/sync/logs/:id/retry', { params: bigintIdParams, successStatus: 202 }),
  endpoint('get', '/sync/status'),
] as const satisfies readonly EndpointContract[];

export function endpointKey(endpoint: Pick<EndpointContract, 'method' | 'path'>) {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}
