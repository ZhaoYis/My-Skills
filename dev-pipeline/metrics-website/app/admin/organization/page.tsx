import { Users } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { AdminNav } from '@/components/admin-nav';
import { ApiFailure } from '@/components/api-failure';
import { OrganizationManager, type OrganizationActionState } from '@/components/organization-manager';
import {
  OrganizationSyncManager,
  type SyncActionState,
} from '@/components/organization-sync-manager';
import { RequestState } from '@/components/request-state';
import { currentUserIsAdmin } from '@/lib/admin-auth';
import { apiDelete, apiGet, apiPost, apiPut, isMetricsApiError } from '@/lib/api';
import type {
  DeveloperPage,
  DeveloperRecord,
  OrganizationAdapterStatus,
  SyncLogPage,
  SyncLogRecord,
  TeamRecord,
} from '@/lib/types';

async function readOrganizationPayload(formData: FormData) {
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) throw new Error('组织 JSON 文件不能超过 2MB');
    return JSON.parse(await file.text()) as unknown;
  }
  return JSON.parse(String(formData.get('payload') ?? '')) as unknown;
}

async function mutateSync(
  state: SyncActionState,
  formData: FormData,
): Promise<SyncActionState> {
  'use server';
  void state;
  const command = String(formData.get('command') ?? '');
  try {
    if (command === 'sync-preview') {
      const source = String(formData.get('source') ?? '').trim();
      const payload = await readOrganizationPayload(formData);
      const preview = await apiPost<SyncLogRecord>(
        '/sync/org/preview',
        { source, ...(payload as object) },
        { serviceAuth: true },
      );
      return { status: 'success', command, message: '差异预览已生成，确认后才会写入', preview };
    }
    if (command === 'adapter-preview') {
      const adapter = String(formData.get('adapter') ?? '');
      const preview = await apiPost<SyncLogRecord>(
        `/sync/adapters/${adapter}/preview`,
        {},
        { serviceAuth: true },
      );
      return { status: 'success', command, message: '外部组织源预览已生成', preview };
    }
    const id = String(formData.get('id') ?? '');
    if (command === 'sync-apply') {
      await apiPost(`/sync/logs/${id}/apply`, {}, { serviceAuth: true });
      revalidatePath('/admin/organization');
      return { status: 'success', command, message: '组织同步已排队' };
    }
    if (command === 'sync-retry') {
      await apiPost(`/sync/logs/${id}/retry`, {}, { serviceAuth: true });
      revalidatePath('/admin/organization');
      return { status: 'success', command, message: '同步重试已排队' };
    }
    throw new Error('未知同步操作');
  } catch (error) {
    const message = isMetricsApiError(error)
      ? `${error.message}${error.requestId ? ` (Request ${error.requestId})` : ''}`
      : error instanceof SyntaxError
        ? '组织 JSON 格式无效'
        : error instanceof Error
          ? error.message
          : '组织同步操作失败';
    return { status: 'error', command, message };
  }
}

async function mutateOrganization(state: OrganizationActionState, formData: FormData): Promise<OrganizationActionState> {
  'use server';
  void state;
  const command = String(formData.get('command') ?? '');
  const id = Number(formData.get('id'));
  try {
    if (command === 'team-save') {
      const externalId = String(formData.get('externalId') ?? '').trim();
      const parentId = Number(formData.get('parentId')) || null;
      const body = { name: String(formData.get('name') ?? ''), slug: String(formData.get('slug') ?? ''), parentId, externalId: externalId || null };
      if (id) await apiPut<TeamRecord>(`/teams/${id}`, body, { serviceAuth: true });
      else await apiPost<TeamRecord>('/teams', body, { serviceAuth: true });
    } else if (command === 'team-deactivate') {
      const targetTeamId = Number(formData.get('targetTeamId')) || undefined;
      await apiDelete<TeamRecord>(`/teams/${id}`, { serviceAuth: true, body: { childStrategy: String(formData.get('childStrategy')), memberStrategy: String(formData.get('memberStrategy')), targetTeamId } });
    } else if (command === 'developer-save') {
      const externalId = String(formData.get('externalId') ?? '').trim();
      await apiPut<DeveloperRecord>(`/developers/${id}`, { displayName: String(formData.get('displayName') ?? ''), teamId: Number(formData.get('teamId')) || null, role: String(formData.get('role')), externalId: externalId || null, isActive: formData.get('isActive') === 'true' }, { serviceAuth: true });
    } else throw new Error('未知组织操作');
    revalidatePath('/admin/organization');
    const message = command === 'team-save' ? '团队配置已保存' : command === 'team-deactivate' ? '团队已停用，历史归属保留' : '开发者权限与归属已更新';
    return { status: 'success', command, message };
  } catch (error) {
    return { status: 'error', command, message: isMetricsApiError(error) ? `${error.message}${error.requestId ? ` (Request ${error.requestId})` : ''}` : '组织操作失败' };
  }
}

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ q?: string; unassigned?: string; claim?: string; status?: string; pageNum?: string }> }) {
  if (!(await currentUserIsAdmin())) return <RequestState kind="forbidden" />;
  const params = await searchParams;
  const filters = { q: params.q?.trim() ?? '', unassigned: params.unassigned === 'true', claim: ['all', 'linked', 'unlinked'].includes(params.claim ?? '') ? (params.claim ?? 'all') : 'all', status: ['all', 'active', 'inactive'].includes(params.status ?? '') ? (params.status ?? 'all') : 'all' };
  const query = new URLSearchParams({ pageNum: String(Math.max(1, Number(params.pageNum) || 1)), pageSize: '20', claim: filters.claim, status: filters.status });
  if (filters.q) query.set('q', filters.q);
  if (filters.unassigned) query.set('unassigned', 'true');
  let teams: TeamRecord[];
  let developers: DeveloperPage;
  let syncLogs: SyncLogPage;
  let adapters: OrganizationAdapterStatus[];
  try {
    [teams, developers, syncLogs, adapters] = await Promise.all([
      apiGet<TeamRecord[]>('/teams?status=all', { serviceAuth: true }),
      apiGet<DeveloperPage>(`/developers?${query.toString()}`, { serviceAuth: true }),
      apiGet<SyncLogPage>('/sync/logs?pageNum=1&pageSize=10', { serviceAuth: true }),
      apiGet<OrganizationAdapterStatus[]>('/sync/adapters', { serviceAuth: true }),
    ]);
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  return <><header className="topbar"><div><span className="live-dot" /> ORGANIZATION CONTROL</div></header><div className="workspace admin-workspace"><section className="page-heading"><div><p className="kicker">ADMIN / ORGANIZATION</p><h1>组织管理</h1><p>同步状态、团队层级、成员归属与身份关联。</p></div><Users size={28} /></section><AdminNav active="organization" /><OrganizationSyncManager action={mutateSync} adapters={adapters} logs={syncLogs} /><OrganizationManager action={mutateOrganization} developers={developers} filters={filters} teams={teams} /></div></>;
}
