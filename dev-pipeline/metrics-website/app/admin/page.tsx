import { Database, ShieldCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { TriggerAllAction, type AdminActionState } from '@/components/admin-actions';
import { AdminNav } from '@/components/admin-nav';
import { ApiFailure } from '@/components/api-failure';
import { CollectionRuns } from '@/components/collection-runs';
import { RepoManager, type RepoActionState } from '@/components/repo-manager';
import { RequestState } from '@/components/request-state';
import { currentUserIsAdmin } from '@/lib/admin-auth';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  isMetricsApiError,
} from '@/lib/api';
import type { CollectionJobPage, RepoPage, RepoRecord } from '@/lib/types';

async function triggerAll(state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  'use server';
  void state;
  const dryRun = formData.get('trigger') === 'dry-run';
  try {
    await apiPost('/collection/trigger-all', { dryRun }, { serviceAuth: true });
    revalidatePath('/admin');
    return { status: 'success', message: dryRun ? 'Dry-run 已排队' : '采集任务已排队' };
  } catch (error) {
    return { status: 'error', message: isMetricsApiError(error) ? error.message : '采集任务提交失败' };
  }
}

async function mutateRepo(state: RepoActionState, formData: FormData): Promise<RepoActionState> {
  'use server';
  void state;
  const command = String(formData.get('command') ?? '');
  const id = Number(formData.get('id'));
  try {
    if (command === 'save' || command === 'test') {
      const gitUrl = String(formData.get('gitUrl') ?? '');
      const gitBranch = String(formData.get('gitBranch') ?? 'main');
      if (command === 'test') {
        await apiPost('/repos/test-connection', { gitUrl, gitBranch }, { serviceAuth: true });
        return { status: 'success', command, message: '仓库与分支连接成功' };
      }
      const body = {
        name: String(formData.get('name') ?? ''),
        gitUrl,
        gitBranch,
        collectSince: new Date(`${String(formData.get('collectSince'))}T00:00:00.000Z`).toISOString(),
        retentionDays: Number(formData.get('retentionDays')),
      };
      if (id) await apiPut<RepoRecord>(`/repos/${id}`, body, { serviceAuth: true });
      else await apiPost<RepoRecord>('/repos', body, { serviceAuth: true });
    } else if (command === 'collect') {
      await apiPost(`/repos/${id}/collect`, {}, { serviceAuth: true });
    } else if (command === 'reset') {
      await apiPost(`/repos/${id}/reset-collection`, {}, { serviceAuth: true });
    } else if (command === 'toggle') {
      await apiPatch(`/repos/${id}/status`, { isActive: formData.get('value') === 'true' }, { serviceAuth: true });
    } else if (command === 'delete') {
      await apiDelete(`/repos/${id}`, { serviceAuth: true });
    } else {
      throw new Error('未知仓库操作');
    }
    revalidatePath('/admin');
    revalidatePath(`/admin/repos/${id}`);
    const messages: Record<string, string> = {
      save: '仓库配置已保存',
      collect: '单仓库采集已提交',
      reset: 'Checkpoint 已重置，历史指标保留',
      toggle: formData.get('value') === 'true' ? '仓库已启用' : '仓库已停用',
      delete: '仓库已软删除，历史指标保留',
    };
    return { status: 'success', command, message: messages[command] };
  } catch (error) {
    return {
      status: 'error',
      command,
      message: isMetricsApiError(error)
        ? `${error.message}${error.requestId ? ` (Request ${error.requestId})` : ''}`
        : '仓库操作失败',
    };
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; pageNum?: string }>;
}) {
  if (!(await currentUserIsAdmin())) return <RequestState kind="forbidden" />;
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const status = ['all', 'active', 'inactive', 'error', 'deleted'].includes(params.status ?? '')
    ? (params.status ?? 'all')
    : 'all';
  const pageNum = Math.max(1, Number(params.pageNum) || 1);
  let repos: RepoPage;
  let logs: CollectionJobPage;
  try {
    const search = new URLSearchParams({ pageSize: '20', pageNum: String(pageNum), status });
    if (query) search.set('q', query);
    [repos, logs] = await Promise.all([
      apiGet<RepoPage>(`/repos?${search.toString()}`, { serviceAuth: true }),
      apiGet<CollectionJobPage>('/collection/logs?pageSize=8', { serviceAuth: true }),
    ]);
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  return (
    <>
      <header className="topbar"><div><span className="live-dot" /> COLLECTOR CONTROL</div></header>
      <div className="workspace admin-workspace">
        <section className="page-heading">
          <div><p className="kicker">ADMIN / INGESTION</p><h1>采集控制台</h1><p>仓库连接、增量位置与指纹拒绝记录。</p></div>
          <TriggerAllAction action={triggerAll} />
        </section>
        <AdminNav active="repos" />
        <section className="admin-summary">
          <div><Database size={18} /><span>当前仓库</span><strong>{repos.totalCount}</strong></div>
          <div><ShieldCheck size={18} /><span>最近拒绝</span><strong>{logs.records.reduce((sum, log) => sum + log.fingerprintsRejected, 0)}</strong></div>
        </section>
        <RepoManager action={mutateRepo} query={query} repos={repos} status={status} />
        <section className="data-section">
          <div className="panel-title"><div><span>COLLECTION JOBS</span><h2>采集运行</h2></div></div>
          <CollectionRuns page={logs} />
        </section>
      </div>
    </>
  );
}
