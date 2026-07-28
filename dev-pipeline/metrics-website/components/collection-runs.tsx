'use client';

import { ExternalLink, LoaderCircle, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import type { CollectionJobPage, CollectionLogRecord } from '@/lib/types';

export interface CollectionJobActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
}

const initialState: CollectionJobActionState = { status: 'idle' };

export function CollectionJobActions({
  action,
  job,
}: {
  action: (state: CollectionJobActionState, formData: FormData) => Promise<CollectionJobActionState>;
  job: CollectionLogRecord;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const cancellable = job.status === 'queued' || job.status === 'running';
  const retryable = ['error', 'cancelled', 'timeout'].includes(job.status);
  if (!cancellable && !retryable && state.status === 'idle') return null;
  return (
    <form action={formAction} className="job-actions">
      <input name="jobId" type="hidden" value={job.id} />
      {cancellable && (
        <button className="secondary-command" disabled={pending} name="command" type="submit" value="cancel">
          {pending ? <LoaderCircle className="spin" size={15} /> : <XCircle size={15} />}取消
        </button>
      )}
      {retryable && (
        <button className="secondary-command" disabled={pending} name="command" type="submit" value="retry">
          {pending ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />}重试
        </button>
      )}
      {state.status !== 'idle' && <span className={`action-feedback ${state.status}`} role="status">{state.message}</span>}
    </form>
  );
}

export function CollectionRuns({ page }: { page: CollectionJobPage }) {
  const router = useRouter();
  const active = page.records.some(({ status }) => status === 'queued' || status === 'running');
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return (
    <div className="table-wrap">
      <table className="collection-table">
        <thead><tr><th>Run</th><th>仓库</th><th>类型</th><th>进度</th><th>统计</th><th>状态</th><th>详情</th></tr></thead>
        <tbody>
          {page.records.map((job) => (
            <tr key={job.id}>
              <td><code>#{job.id}</code></td>
              <td>{job.repo?.name ?? `Repo ${job.repoId}`}</td>
              <td>{job.dryRun ? 'dry-run' : job.mode}</td>
              <td>{job.batchesCompleted} / {job.batchesTotal}</td>
              <td>{job.runsUpserted} 入库 · {job.fingerprintsRejected} 拒绝</td>
              <td><span className={`status ${job.status}`}>{job.status}</span></td>
              <td><Link aria-label={`查看 Run ${job.id}`} className="icon-button" href={`/admin/collection/${job.id}`}><ExternalLink size={15} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!page.records.length && <div className="empty-state">暂无采集运行</div>}
    </div>
  );
}
