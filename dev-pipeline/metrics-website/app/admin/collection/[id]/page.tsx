import { Activity, ArrowLeft, Clock3, GitCommit, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ApiFailure } from '@/components/api-failure';
import { CollectionJobActions, type CollectionJobActionState } from '@/components/collection-runs';
import { RequestState } from '@/components/request-state';
import { apiGet, apiPost, isMetricsApiError } from '@/lib/api';
import { currentUserIsAdmin } from '@/lib/admin-auth';
import type { CollectionLogRecord } from '@/lib/types';

async function mutateJob(
  state: CollectionJobActionState,
  formData: FormData,
): Promise<CollectionJobActionState> {
  'use server';
  void state;
  const jobId = String(formData.get('jobId'));
  const command = String(formData.get('command'));
  try {
    await apiPost(`/collection/jobs/${jobId}/${command}`, {}, { serviceAuth: true });
    revalidatePath('/admin');
    revalidatePath(`/admin/collection/${jobId}`);
    return { status: 'success', message: command === 'cancel' ? '取消请求已记录' : '重试任务已排队' };
  } catch (error) {
    return {
      status: 'error',
      message: isMetricsApiError(error) ? error.message : '采集任务操作失败',
    };
  }
}

export default async function CollectionJobPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserIsAdmin())) return <RequestState kind="forbidden" />;
  const { id } = await params;
  let job: CollectionLogRecord;
  try {
    job = await apiGet<CollectionLogRecord>(`/collection/jobs/${id}`, { serviceAuth: true });
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  return (
    <>
      <header className="topbar"><div><span className="live-dot" /> COLLECTION RUN / {job.id}</div></header>
      <div className="workspace admin-workspace collection-detail">
        <Link className="back-link" href="/admin"><ArrowLeft size={15} />返回采集控制台</Link>
        <section className="page-heading">
          <div><p className="kicker">RUN / {job.id}</p><h1>{job.repo?.name ?? `Repo ${job.repoId}`}</h1><p>{job.dryRun ? 'Dry-run' : job.mode} · Attempt {job.attempt}</p></div>
          <div className="collection-detail-action"><span className={`status ${job.status}`}>{job.status}</span><CollectionJobActions action={mutateJob} job={job} /></div>
        </section>
        <dl className="detail-grid">
          <div><dt>扫描 Commit</dt><dd><GitCommit size={15} />{job.commitsScanned}</dd></div>
          <div><dt>文件 / 入库 / 跳过</dt><dd><Activity size={15} />{job.filesFound} / {job.runsUpserted} / {job.runsSkipped}</dd></div>
          <div><dt>批次</dt><dd>{job.batchesCompleted} / {job.batchesTotal}</dd></div>
          <div><dt>指纹拒绝</dt><dd><ShieldAlert size={15} />{job.fingerprintsRejected}</dd></div>
          <div><dt>Heartbeat</dt><dd><Clock3 size={15} />{job.heartbeatAt ? new Date(job.heartbeatAt).toLocaleString('zh-CN') : '-'}</dd></div>
          <div><dt>Worker</dt><dd><code>{job.workerId ?? '-'}</code></dd></div>
        </dl>
        {(job.errorMessage || job.errorCategory) && <p className="danger-note">{job.errorCategory ?? 'error'}: {job.errorMessage}</p>}
        <section className="data-section">
          <div className="panel-title"><div><span>REJECTIONS</span><h2>拒绝原因</h2></div></div>
          <div className="table-wrap">
            <table className="rejection-table"><thead><tr><th>原因</th><th>Commit</th><th>路径</th><th>说明</th></tr></thead><tbody>
              {(job.rejectionDetails ?? []).map((item) => <tr key={`${item.commitSha}:${item.path}`}><td><code>{item.code}</code></td><td><code>{item.commitSha.slice(0, 8)}</code></td><td>{item.path}</td><td>{item.message}</td></tr>)}
            </tbody></table>
            {!job.rejectionDetails?.length && <div className="empty-state">本次运行没有拒绝记录</div>}
          </div>
        </section>
      </div>
    </>
  );
}
