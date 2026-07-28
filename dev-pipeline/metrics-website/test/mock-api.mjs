import { createServer } from 'node:http';

let scenario = 'empty';
let nextRepoId = 2;
let repos = [];
let collectionLogs = [];
let nextCollectionJobId = 10;
let nextTeamId = 4;
let teams = [];
let developers = [];
let nextSyncLogId = 10;
let syncLogs = [];

const emptyOverview = {
  totalRuns: 0,
  completedRuns: 0,
  completionRate: 0,
  abandonmentRate: 0,
  monthlyCompleted: 0,
  overdueRate: 0,
  avgCycleTimeMinutes: 0,
  avgEffectiveCycleTimeMinutes: 0,
  medianCycleTimeMinutes: 0,
  avgReviewRounds: 0,
  reviewPassRate: 0,
  testFirstPassRate: 0,
  avgTestAttempts: 0,
  avgVerifyAttempts: 0,
  avgRollbacksPerChange: 0,
  pauseCount: 0,
  pauseRate: 0,
  bypassFrequency: {},
  bypassRate: 0,
  phaseBreakdown: Array.from({ length: 7 }, (_, phase) => ({
    phase,
    count: 0,
    avgSec: 0,
    p50Sec: 0,
    p95Sec: 0,
  })),
  recentTrend: [],
};

const teamOverview = {
  ...emptyOverview,
  totalRuns: 14,
  completedRuns: 11,
  completionRate: 0.786,
  monthlyCompleted: 8,
  avgCycleTimeMinutes: 42,
  avgEffectiveCycleTimeMinutes: 35,
  medianCycleTimeMinutes: 38,
  avgReviewRounds: 1.8,
  reviewPassRate: 0.714,
  testFirstPassRate: 0.857,
  overdueRate: 0.071,
  recentTrend: [
    { date: '2026-07-26', runs: 5, avgCycleMin: 46 },
    { date: '2026-07-27', runs: 6, avgCycleMin: 39 },
  ],
  phaseBreakdown: emptyOverview.phaseBreakdown.map((phase) => ({
    ...phase,
    count: 2,
    avgSec: 300 + phase.phase * 60,
    p50Sec: 300 + phase.phase * 60,
    p95Sec: 420 + phase.phase * 60,
  })),
};

function memberOverview(index) {
  if (index === 1) return { ...teamOverview, totalRuns: 4, completedRuns: 4, completionRate: 1 };
  if (index === 2) return { ...emptyOverview };
  const totalRuns = (index % 4) + 1;
  const completedRuns = Math.max(0, totalRuns - (index % 2));
  return {
    ...teamOverview,
    totalRuns,
    completedRuns,
    completionRate: completedRuns / totalRuns,
    monthlyCompleted: completedRuns,
    avgCycleTimeMinutes: 25 + index,
    avgEffectiveCycleTimeMinutes: 20 + index,
    avgReviewRounds: 1 + (index % 3) * 0.5,
  };
}

function teamMetricMembers() {
  return Array.from({ length: 12 }, (_, offset) => {
    const index = offset + 1;
    const developer = index === 1
      ? { id: 1, displayName: 'Alice', email: 'alice@example.test', team: { id: 2, name: 'Platform' } }
      : index === 2
        ? { id: 2, displayName: 'Pending User', email: 'pending@example.test', team: { id: 2, name: 'Platform' } }
        : { id: index, displayName: `Member ${String(index).padStart(2, '0')}`, email: `member-${index}@example.test`, team: { id: 1, name: 'Engineering' } };
    return { ...developer, ...memberOverview(index) };
  });
}

function repoFixture() {
  return {
    id: 1,
    name: 'platform-api',
    gitUrl: 'https://git.example.test/platform-api.git',
    gitBranch: 'main',
    collectSince: '2026-01-01T00:00:00.000Z',
    retentionDays: 365,
    isActive: true,
    deletedAt: null,
    collectionStatus: 'idle',
    collectionError: null,
    lastFetchedCommit: '1111111111111111111111111111111111111111',
    lastRelevantCommit: '1111111111111111111111111111111111111111',
    scanFromCommit: null,
    scanToCommit: '1111111111111111111111111111111111111111',
    checkpointPolicy: 'advance-on-record-errors',
    lastFetchedAt: '2026-07-28T01:00:00.000Z',
  };
}

function resetRepositoryState() {
  nextRepoId = 2;
  nextCollectionJobId = 10;
  repos = [repoFixture()];
  collectionLogs = [];
}

function collectionJobFixture(overrides = {}) {
  const status = overrides.status ?? 'completed';
  return {
    id: String(overrides.id ?? nextCollectionJobId++),
    repoId: 1,
    queuedAt: '2026-07-28T05:29:58.000Z',
    startedAt: status === 'queued' ? null : '2026-07-28T05:30:00.000Z',
    finishedAt: ['queued', 'running'].includes(status) ? null : '2026-07-28T05:30:03.000Z',
    heartbeatAt: status === 'queued' ? null : '2026-07-28T05:30:02.000Z',
    status,
    dryRun: false,
    mode: 'trusted',
    triggerSource: 'manual',
    workerId: status === 'queued' ? null : 'mock-worker',
    attempt: 1,
    retryOfId: null,
    cancelRequestedAt: null,
    cancelledAt: null,
    commitsScanned: 3,
    filesFound: 2,
    runsUpserted: 2,
    runsSkipped: 0,
    fingerprintsRejected: 1,
    batchesTotal: 1,
    batchesCompleted: status === 'completed' ? 1 : 0,
    transactionRetries: 0,
    rejectionDetails: [{ code: 'unknown-key', commitSha: '3'.repeat(40), path: '.pipeline/state.json', message: 'Fingerprint key is unknown' }],
    errorCategory: null,
    errorMessage: null,
    repo: { name: 'platform-api' },
    ...overrides,
  };
}

function resetCollectionJobState() {
  resetRepositoryState();
  collectionLogs = [
    collectionJobFixture({ id: '3', status: 'running', runsUpserted: 1 }),
    collectionJobFixture({ id: '2', status: 'error', errorCategory: 'git', errorMessage: 'Remote branch unavailable', finishedAt: '2026-07-28T05:20:00.000Z' }),
    collectionJobFixture({ id: '1', status: 'completed' }),
  ];
}

function resetOrganizationState() {
  nextTeamId = 4;
  teams = [
    { id: 1, name: 'Engineering', slug: 'engineering', parentId: null, externalId: 'team-engineering', syncSource: 'fixture', isActive: true, deactivatedAt: null },
    { id: 2, name: 'Platform', slug: 'platform', parentId: 1, externalId: 'team-platform', syncSource: 'fixture', isActive: true, deactivatedAt: null },
    { id: 3, name: 'Product', slug: 'product', parentId: null, externalId: 'team-product', syncSource: 'fixture', isActive: true, deactivatedAt: null },
  ];
  developers = [
    { id: 1, email: 'alice@example.test', displayName: 'Alice', role: 'member', teamId: 2, externalId: 'oidc-alice', syncSource: 'fixture', isActive: true, deactivatedAt: null, tokenVersion: 0 },
    { id: 2, email: 'pending@example.test', displayName: 'Pending User', role: 'member', teamId: 2, externalId: null, syncSource: null, isActive: true, deactivatedAt: null, tokenVersion: 0 },
  ];
  nextSyncLogId = 10;
  syncLogs = [
    syncLogFixture({ id: '9', source: 'feishu', dryRun: true, teamsCreated: 2, devsCreated: 4 }),
    syncLogFixture({ id: '8', source: 'hr-upload', status: 'error', errorCategory: 'database', errorMessage: 'Directory transaction timed out', failures: 1, canonicalSnapshot: { teams: [], developers: [] } }),
  ];
}

function syncLogFixture(overrides = {}) {
  const status = overrides.status ?? 'completed';
  return {
    id: String(overrides.id ?? nextSyncLogId++),
    source: 'manual',
    adapter: null,
    triggerSource: 'upload',
    attempt: 1,
    retryOfId: null,
    status,
    startedAt: '2026-07-28T08:00:00.000Z',
    finishedAt: status === 'running' ? null : '2026-07-28T08:00:02.000Z',
    dryRun: false,
    teamsCreated: 0,
    teamsUpdated: 0,
    teamsMoved: 0,
    teamsDeactivated: 0,
    devsCreated: 0,
    devsUpdated: 0,
    devsLinked: 0,
    devsMoved: 0,
    devsUnassigned: 0,
    devsDeactivated: 0,
    failures: 0,
    errorCategory: null,
    errorMessage: null,
    canonicalSnapshot: null,
    ...overrides,
  };
}

function teamTree(status = 'all') {
  const visible = teams.filter((team) => status === 'all' || team.isActive === (status === 'active'));
  const nodes = new Map(visible.map((team) => [team.id, { ...team, children: [] }]));
  const roots = [];
  for (const team of visible) {
    const node = nodes.get(team.id);
    const parent = team.parentId ? nodes.get(team.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function organizationDeveloperPage(url) {
  const query = (url.searchParams.get('q') ?? '').toLowerCase();
  const claim = url.searchParams.get('claim') ?? 'all';
  const status = url.searchParams.get('status') ?? 'all';
  const unassigned = url.searchParams.get('unassigned') === 'true';
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum')) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20);
  const filtered = developers.filter((developer) => {
    if (query && !developer.email.toLowerCase().includes(query) && !developer.displayName.toLowerCase().includes(query) && !String(developer.externalId ?? '').toLowerCase().includes(query)) return false;
    if (claim === 'linked' && !developer.externalId) return false;
    if (claim === 'unlinked' && developer.externalId) return false;
    if (status === 'active' && !developer.isActive) return false;
    if (status === 'inactive' && developer.isActive) return false;
    if (unassigned && developer.teamId !== null) return false;
    return true;
  });
  const start = (pageNum - 1) * pageSize;
  return {
    pageNum,
    pageSize,
    totalCount: filtered.length,
    totalPage: Math.ceil(filtered.length / pageSize),
    records: filtered.slice(start, start + pageSize).map((developer) => ({
      ...developer,
      team: teams.find((team) => team.id === developer.teamId) ?? null,
    })),
  };
}

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'x-request-id': `mock-${scenario}`,
  });
  response.end(JSON.stringify(body));
}

function success(response, data, status = 200, message = 'ok') {
  send(response, status, { success: true, code: status, message, data });
}

function failure(response, status, code, message) {
  send(response, status, { success: false, code, message, data: null });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function repoPage(url) {
  const query = (url.searchParams.get('q') ?? '').toLowerCase();
  const status = url.searchParams.get('status') ?? 'all';
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum')) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20);
  const filtered = repos.filter((repo) => {
    if (query && !repo.name.toLowerCase().includes(query) && !repo.gitUrl.toLowerCase().includes(query)) return false;
    if (status === 'deleted') return Boolean(repo.deletedAt);
    if (repo.deletedAt) return false;
    if (status === 'active') return repo.isActive;
    if (status === 'inactive') return !repo.isActive;
    if (status === 'error') return repo.collectionStatus === 'error';
    return true;
  });
  const start = (pageNum - 1) * pageSize;
  return {
    pageNum,
    pageSize,
    totalCount: filtered.length,
    totalPage: Math.ceil(filtered.length / pageSize),
    records: filtered.slice(start, start + pageSize),
  };
}

async function handleRepositoryRequest(request, response, url) {
  if (url.pathname === '/api/v1/repos' && request.method === 'GET') {
    return success(response, repoPage(url));
  }
  if (url.pathname === '/api/v1/repos/test-connection' && request.method === 'POST') {
    const body = await readJson(request);
    if (String(body.gitUrl).includes('auth.invalid')) {
      return failure(response, 422, 'authentication-failed', 'Git 仓库认证失败');
    }
    if (body.gitBranch === 'missing') {
      return failure(response, 422, 'branch-not-found', `Git 分支不存在: ${body.gitBranch}`);
    }
    return success(response, {
      status: 'connected',
      branch: body.gitBranch,
      commit: '2222222222222222222222222222222222222222',
    });
  }
  if (url.pathname === '/api/v1/repos' && request.method === 'POST') {
    const body = await readJson(request);
    const repo = {
      ...repoFixture(),
      ...body,
      id: nextRepoId++,
      isActive: true,
      deletedAt: null,
      lastFetchedCommit: null,
      lastRelevantCommit: null,
      scanFromCommit: null,
      scanToCommit: null,
      lastFetchedAt: null,
    };
    repos.push(repo);
    return success(response, repo, 201, '创建成功');
  }

  const match = url.pathname.match(/^\/api\/v1\/repos\/(\d+)(?:\/(status|collect|reset-collection))?$/);
  if (!match) return false;
  const id = Number(match[1]);
  const operation = match[2];
  const repo = repos.find((record) => record.id === id);
  if (!repo) return failure(response, 404, 'NOT_FOUND', '仓库不存在');

  if (!operation && request.method === 'GET') {
    return success(response, {
      ...repo,
      collectionLogs: collectionLogs.filter((log) => log.repoId === id).slice(0, 10),
    });
  }
  if (!operation && request.method === 'PUT') {
    Object.assign(repo, await readJson(request));
    return success(response, repo, 200, '更新成功');
  }
  if (!operation && request.method === 'DELETE') {
    Object.assign(repo, {
      isActive: false,
      deletedAt: '2026-07-28T06:00:00.000Z',
      collectionStatus: 'idle',
      collectionError: null,
    });
    return success(response, repo, 200, '仓库已软删除，历史指标保留');
  }
  if (operation === 'status' && request.method === 'PATCH') {
    const body = await readJson(request);
    repo.isActive = Boolean(body.isActive);
    if (!repo.isActive) repo.collectionStatus = 'idle';
    return success(response, repo);
  }
  if (operation === 'collect' && request.method === 'POST') {
    const log = collectionJobFixture({ repoId: id, repo: { name: repo.name } });
    collectionLogs.unshift(log);
    repo.lastFetchedCommit = '3333333333333333333333333333333333333333';
    repo.lastRelevantCommit = repo.lastFetchedCommit;
    repo.scanToCommit = repo.lastFetchedCommit;
    repo.lastFetchedAt = log.finishedAt;
    return success(response, { status: 'accepted', repoId: id }, 202, '采集任务已提交');
  }
  if (operation === 'reset-collection' && request.method === 'POST') {
    Object.assign(repo, {
      lastFetchedCommit: null,
      lastRelevantCommit: null,
      scanFromCommit: null,
      scanToCommit: null,
      lastFetchedAt: null,
    });
    return success(response, repo, 200, '采集 checkpoint 已重置，历史指标未删除');
  }
  return false;
}

function organizationSubtreeIds(rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const team of teams) {
      if (team.parentId && ids.has(team.parentId) && !ids.has(team.id)) {
        ids.add(team.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

async function handleOrganizationRequest(request, response, url) {
  if (url.pathname === '/api/v1/sync/adapters' && request.method === 'GET') {
    return success(response, [
      { name: 'feishu', configured: false, supportsPull: true },
      { name: 'ldap', configured: false, supportsPull: false },
      { name: 'wecom', configured: false, supportsPull: false },
    ]);
  }
  if (url.pathname === '/api/v1/sync/logs' && request.method === 'GET') {
    const records = syncLogs.map((log) =>
      Object.fromEntries(Object.entries(log).filter(([key]) => key !== 'canonicalSnapshot')),
    );
    return success(response, {
      pageNum: 1,
      pageSize: 10,
      totalCount: records.length,
      totalPage: records.length ? 1 : 0,
      records,
    });
  }
  if (url.pathname === '/api/v1/sync/org/preview' && request.method === 'POST') {
    const body = await readJson(request);
    const canonicalSnapshot = { teams: body.teams ?? [], developers: body.developers ?? [] };
    const preview = syncLogFixture({
      source: body.source,
      dryRun: true,
      teamsCreated: canonicalSnapshot.teams.length,
      devsCreated: canonicalSnapshot.developers.length,
      canonicalSnapshot,
    });
    syncLogs.unshift(preview);
    return success(response, preview, 200, '组织同步预览完成');
  }
  const syncLogMatch = url.pathname.match(/^\/api\/v1\/sync\/logs\/(\d+)(?:\/(apply|retry))?$/);
  if (syncLogMatch) {
    const log = syncLogs.find((item) => item.id === syncLogMatch[1]);
    if (!log) return failure(response, 404, 'NOT_FOUND', '同步记录不存在');
    const operation = syncLogMatch[2];
    if (!operation && request.method === 'GET') return success(response, log);
    if (operation === 'apply' && request.method === 'POST') {
      const applied = syncLogFixture({ source: log.source, triggerSource: 'apply-preview', retryOfId: log.id, canonicalSnapshot: log.canonicalSnapshot });
      syncLogs.unshift(applied);
      return success(response, { id: applied.id, status: 'running' }, 202, '组织同步已排队');
    }
    if (operation === 'retry' && request.method === 'POST') {
      const retry = syncLogFixture({ source: log.source, triggerSource: 'retry', retryOfId: log.id, attempt: log.attempt + 1, canonicalSnapshot: log.canonicalSnapshot });
      syncLogs.unshift(retry);
      return success(response, { id: retry.id, status: 'running' }, 202, '同步重试已排队');
    }
  }
  if (url.pathname === '/api/v1/teams' && request.method === 'GET') {
    return success(response, teamTree(url.searchParams.get('status') ?? 'all'));
  }
  if (url.pathname === '/api/v1/teams' && request.method === 'POST') {
    const body = await readJson(request);
    const team = { id: nextTeamId++, ...body, syncSource: null, isActive: true, deactivatedAt: null };
    teams.push(team);
    return success(response, { ...team, children: [] }, 201, '创建成功');
  }
  const teamMatch = url.pathname.match(/^\/api\/v1\/teams\/(\d+)$/);
  if (teamMatch) {
    const id = Number(teamMatch[1]);
    const team = teams.find((item) => item.id === id);
    if (!team) return failure(response, 404, 'NOT_FOUND', '团队不存在');
    const body = await readJson(request);
    if (request.method === 'PUT') {
      if (body.parentId && organizationSubtreeIds(id).includes(body.parentId)) {
        return failure(response, 409, 'TEAM_CYCLE', '团队不能移动到自身或其子团队');
      }
      Object.assign(team, body);
      for (const developer of developers.filter((item) => organizationSubtreeIds(id).includes(item.teamId))) developer.tokenVersion += 1;
      return success(response, { ...team, children: [] });
    }
    if (request.method === 'DELETE') {
      const children = teams.filter((item) => item.parentId === id && item.isActive);
      const members = developers.filter((item) => item.teamId === id && item.isActive);
      if (children.length && body.childStrategy === 'reject') return failure(response, 409, 'TEAM_HAS_CHILDREN', '团队仍有活跃子团队，请选择提升子团队后停用');
      if (members.length && body.memberStrategy === 'reject') return failure(response, 409, 'TEAM_HAS_MEMBERS', '团队仍有活跃成员，请选择解绑或迁移成员后停用');
      if (body.childStrategy === 'promote') for (const child of children) child.parentId = team.parentId;
      for (const member of members) {
        member.teamId = body.memberStrategy === 'move' ? body.targetTeamId : null;
        member.tokenVersion += 1;
      }
      team.isActive = false;
      team.deactivatedAt = '2026-07-28T08:00:00.000Z';
      return success(response, team, 200, '团队已停用，历史归属保留');
    }
  }
  if (url.pathname === '/api/v1/developers' && request.method === 'GET') {
    return success(response, organizationDeveloperPage(url));
  }
  const developerMatch = url.pathname.match(/^\/api\/v1\/developers\/(\d+)$/);
  if (developerMatch && request.method === 'PUT') {
    const developer = developers.find((item) => item.id === Number(developerMatch[1]));
    if (!developer) return failure(response, 404, 'NOT_FOUND', '开发者不存在');
    Object.assign(developer, await readJson(request));
    developer.tokenVersion += 1;
    return success(response, { ...developer, team: teams.find((team) => team.id === developer.teamId) ?? null }, 200, '开发者权限与归属已更新');
  }
  return false;
}

async function handleTeamMetricsRequest(request, response, url) {
  if (request.method !== 'GET') return false;
  if (url.pathname === '/api/v1/metrics/teams/visible') {
    return success(response, scenario === 'team-no-team' ? [] : teamTree('active'));
  }
  const match = url.pathname.match(/^\/api\/v1\/metrics\/team\/(\d+)(?:\/(members|trend|phases)(?:\/(\d+))?)?$/);
  if (!match) return false;
  const teamId = Number(match[1]);
  const operation = match[2];
  const developerId = match[3] ? Number(match[3]) : null;
  if (!teams.some((team) => team.id === teamId && team.isActive)) {
    return failure(response, 403, 'FORBIDDEN', '无权访问该团队');
  }
  if (!operation) return success(response, teamId === 3 ? emptyOverview : teamOverview);
  if (operation === 'trend') return success(response, teamId === 3 ? [] : teamOverview.recentTrend);
  if (operation === 'phases') return success(response, teamId === 3 ? emptyOverview.phaseBreakdown : teamOverview.phaseBreakdown);

  let records = teamId === 3 ? [] : teamMetricMembers();
  if (developerId) {
    const member = records.find((record) => record.id === developerId);
    if (!member) return failure(response, 404, 'NOT_FOUND', '团队成员不存在');
    const { id, email, displayName, team, ...overview } = member;
    return success(response, { id, email, displayName, team, overview });
  }
  const query = (url.searchParams.get('q') ?? '').toLowerCase();
  const dataStatus = url.searchParams.get('dataStatus') ?? 'all';
  const sortBy = url.searchParams.get('sortBy') ?? 'displayName';
  const sortOrder = url.searchParams.get('sortOrder') === 'desc' ? -1 : 1;
  if (query) {
    records = records.filter((record) => [record.displayName, record.email].some((value) => value.toLowerCase().includes(query)));
  }
  if (dataStatus === 'with-data') records = records.filter((record) => record.totalRuns > 0);
  if (dataStatus === 'without-data') records = records.filter((record) => record.totalRuns === 0);
  records.sort((left, right) => {
    const leftValue = sortBy === 'displayName' ? left.displayName : left[sortBy];
    const rightValue = sortBy === 'displayName' ? right.displayName : right[sortBy];
    const compared = typeof leftValue === 'string'
      ? leftValue.localeCompare(rightValue)
      : Number(leftValue) - Number(rightValue);
    return compared * sortOrder || left.id - right.id;
  });
  const pageNum = Math.max(1, Number(url.searchParams.get('pageNum')) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 10);
  const start = (pageNum - 1) * pageSize;
  return success(response, {
    pageNum,
    pageSize,
    totalCount: records.length,
    totalPage: Math.ceil(records.length / pageSize),
    records: records.slice(start, start + pageSize),
  });
}

resetRepositoryState();
resetOrganizationState();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4101');
  if (url.pathname === '/__health') return send(response, 200, { ok: true });
  if (url.pathname === '/__scenario') {
    scenario = url.searchParams.get('value') || 'empty';
    if (scenario === 'repos') resetRepositoryState();
    if (scenario === 'organization') resetOrganizationState();
    if (scenario === 'team' || scenario === 'team-no-team') resetOrganizationState();
    if (scenario === 'collection-jobs') resetCollectionJobState();
    return send(response, 200, { scenario });
  }
  if (scenario === 'network') return request.socket.destroy();
  if (scenario === 'unauthorized') return failure(response, 401, 'AUTH_REQUIRED', '请重新登录');
  if (scenario === 'forbidden') return failure(response, 403, 'FORBIDDEN', '需要管理员权限');
  if (scenario === 'server') return failure(response, 500, 'SERVICE_ERROR', '指标服务暂时不可用');
  if (scenario === 'mutation-error' && request.method === 'POST') {
    return failure(response, 500, 'JOB_FAILED', '采集任务提交失败');
  }
  if (url.pathname === '/api/v1/auth/me' && request.method === 'GET') {
    return success(response, {
      kind: 'user',
      developerId: 1,
      email: 'playwright-admin@example.test',
      teamId: 1,
      isAdmin: true,
      tokenVersion: 0,
      impersonated: true,
    });
  }
  if (scenario === 'team' || scenario === 'team-no-team') {
    const handled = await handleTeamMetricsRequest(request, response, url);
    if (handled !== false) return handled;
  }
  if (url.pathname.startsWith('/api/v1/metrics/')) return success(response, emptyOverview);
  if (url.pathname === '/api/v1/collection/logs') {
    const status = url.searchParams.get('status');
    const repoId = Number(url.searchParams.get('repoId'));
    const filtered = collectionLogs.filter((job) => (!status || job.status === status) && (!repoId || job.repoId === repoId));
    return success(response, {
      pageNum: 1,
      pageSize: 8,
      totalCount: filtered.length,
      totalPage: filtered.length ? 1 : 0,
      records: filtered.slice(0, 8),
    });
  }
  const collectionJobMatch = url.pathname.match(/^\/api\/v1\/collection\/jobs\/(\d+)(?:\/(cancel|retry))?$/);
  if (collectionJobMatch) {
    const id = collectionJobMatch[1];
    const operation = collectionJobMatch[2];
    const job = collectionLogs.find((item) => item.id === id);
    if (!job) return failure(response, 404, 'NOT_FOUND', '采集任务不存在');
    if (!operation && request.method === 'GET') return success(response, job);
    if (operation === 'cancel' && request.method === 'POST') {
      Object.assign(job, { status: 'cancelled', cancelRequestedAt: '2026-07-28T06:00:00.000Z', cancelledAt: '2026-07-28T06:00:00.000Z', finishedAt: '2026-07-28T06:00:00.000Z' });
      return success(response, job, 200, '取消请求已记录');
    }
    if (operation === 'retry' && request.method === 'POST') {
      const retry = collectionJobFixture({ status: 'queued', retryOfId: job.id, attempt: job.attempt + 1, rejectionDetails: [] });
      collectionLogs.unshift(retry);
      return success(response, { jobId: retry.id, repoId: retry.repoId, status: retry.status }, 202, '重试任务已排队');
    }
  }
  if (url.pathname === '/api/v1/collection/trigger-all' && request.method === 'POST') {
    const body = await readJson(request);
    const job = collectionJobFixture({ status: 'queued', dryRun: Boolean(body.dryRun), rejectionDetails: [] });
    collectionLogs.unshift(job);
    return success(response, { status: 'queued', jobs: [{ jobId: job.id, repoId: job.repoId }], conflicts: [], dryRun: job.dryRun, mode: 'trusted' }, 202);
  }
  if (url.pathname === '/api/v1/repos' && request.method === 'GET' && scenario !== 'repos') {
    return success(response, {
      pageNum: 1,
      pageSize: 20,
      totalCount: 0,
      totalPage: 0,
      records: [],
    });
  }
  if (scenario === 'repos') {
    const handled = await handleRepositoryRequest(request, response, url);
    if (handled !== false) return handled;
  }
  if (scenario === 'organization') {
    const handled = await handleOrganizationRequest(request, response, url);
    if (handled !== false) return handled;
  }
  return failure(response, 404, 'NOT_FOUND', 'not found');
});

server.listen(4101, '127.0.0.1');
