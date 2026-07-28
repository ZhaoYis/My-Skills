export interface PhaseMetric {
  phase: number;
  count: number;
  avgSec: number;
  p50Sec: number;
  p95Sec: number;
}

export interface TrendMetric {
  date: string;
  runs: number;
  avgCycleMin: number;
}

export interface Overview {
  totalRuns: number;
  completedRuns: number;
  completionRate: number;
  abandonmentRate: number;
  monthlyCompleted: number;
  overdueRate: number;
  avgCycleTimeMinutes: number;
  avgEffectiveCycleTimeMinutes: number;
  medianCycleTimeMinutes: number;
  avgReviewRounds: number;
  reviewPassRate: number;
  testFirstPassRate: number;
  avgTestAttempts: number;
  avgVerifyAttempts: number;
  avgRollbacksPerChange: number;
  pauseCount: number;
  pauseRate: number;
  bypassFrequency: Record<string, number>;
  bypassRate: number;
  phaseBreakdown: PhaseMetric[];
  recentTrend: TrendMetric[];
}

export interface CollectionLogRecord {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'error' | 'cancelled' | 'timeout';
  repoId: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  dryRun: boolean;
  mode: 'trusted' | 'history-import';
  triggerSource: string;
  workerId: string | null;
  attempt: number;
  retryOfId: string | null;
  cancelRequestedAt: string | null;
  cancelledAt: string | null;
  commitsScanned: number;
  filesFound: number;
  runsUpserted: number;
  runsSkipped: number;
  fingerprintsRejected: number;
  batchesTotal: number;
  batchesCompleted: number;
  transactionRetries: number;
  rejectionDetails?: Array<{ code: string; commitSha: string; path: string; message: string }> | null;
  errorCategory?: string | null;
  errorMessage?: string | null;
  repo?: { name: string };
}

export interface CollectionJobPage {
  records: CollectionLogRecord[];
  pageNum: number;
  pageSize: number;
  totalCount: number;
  totalPage: number;
}

export interface RepoRecord {
  id: number;
  name: string;
  gitUrl: string;
  gitBranch: string;
  collectSince: string;
  retentionDays: number;
  isActive: boolean;
  deletedAt: string | null;
  collectionStatus: string;
  collectionError: string | null;
  lastFetchedCommit: string | null;
  lastRelevantCommit: string | null;
  lastFetchedAt: string | null;
}

export interface RepoPage {
  records: RepoRecord[];
  pageNum: number;
  pageSize: number;
  totalCount: number;
  totalPage: number;
}

export interface RepoDetail extends RepoRecord {
  scanFromCommit: string | null;
  scanToCommit: string | null;
  checkpointPolicy: string;
  collectionLogs: CollectionLogRecord[];
}

export interface TeamRecord {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  externalId: string | null;
  syncSource: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  children: TeamRecord[];
}

export interface DeveloperRecord {
  id: number;
  email: string;
  displayName: string | null;
  role: 'admin' | 'member' | null;
  teamId: number | null;
  externalId: string | null;
  syncSource: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  tokenVersion: number;
  team: Omit<TeamRecord, 'children'> | null;
}

export interface DeveloperPage {
  records: DeveloperRecord[];
  pageNum: number;
  pageSize: number;
  totalCount: number;
  totalPage: number;
}

export interface OrganizationSnapshot {
  teams: Array<{
    externalId: string;
    name: string;
    slug: string;
    parentExternalId?: string | null;
  }>;
  developers: Array<{
    externalId: string;
    email: string;
    name: string;
    teamExternalId?: string | null;
  }>;
}

export interface SyncLogRecord {
  id: string;
  source: string;
  adapter: string | null;
  triggerSource: string;
  attempt: number;
  retryOfId: string | null;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  finishedAt: string | null;
  dryRun: boolean;
  teamsCreated: number;
  teamsUpdated: number;
  teamsMoved: number;
  teamsDeactivated: number;
  devsCreated: number;
  devsUpdated: number;
  devsLinked: number;
  devsMoved: number;
  devsUnassigned: number;
  devsDeactivated: number;
  failures: number;
  errorCategory: string | null;
  errorMessage: string | null;
  canonicalSnapshot?: OrganizationSnapshot | null;
}

export interface SyncLogPage {
  records: SyncLogRecord[];
  pageNum: number;
  pageSize: number;
  totalCount: number;
  totalPage: number;
}

export interface OrganizationAdapterStatus {
  name: 'feishu' | 'ldap' | 'wecom';
  configured: boolean;
  supportsPull: boolean;
}

export interface VisibleTeam {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  children: VisibleTeam[];
}

export interface TeamMemberRecord extends Overview {
  id: number;
  email: string;
  displayName: string | null;
  team: { id: number; name: string } | null;
}

export interface TeamMemberPage {
  records: TeamMemberRecord[];
  pageNum: number;
  pageSize: number;
  totalCount: number;
  totalPage: number;
}

export interface TeamMemberDetail {
  id: number;
  email: string;
  displayName: string | null;
  team: { id: number; name: string } | null;
  overview: Overview;
}
