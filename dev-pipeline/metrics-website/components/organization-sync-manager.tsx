'use client';

import { Eye, LoaderCircle, Play, RefreshCw, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import type {
  OrganizationAdapterStatus,
  SyncLogPage,
  SyncLogRecord,
} from '@/lib/types';

export interface SyncActionState {
  status: 'idle' | 'success' | 'error';
  command?: string;
  message?: string;
  preview?: SyncLogRecord;
}

const initialState: SyncActionState = { status: 'idle' };
const examplePayload = JSON.stringify(
  {
    teams: [{ externalId: 'engineering', name: 'Engineering', slug: 'engineering' }],
    developers: [],
  },
  null,
  2,
);

const diffFields: Array<[keyof SyncLogRecord, string]> = [
  ['teamsCreated', '新增团队'],
  ['teamsUpdated', '更新团队'],
  ['teamsMoved', '移动团队'],
  ['teamsDeactivated', '停用团队'],
  ['devsCreated', '新增成员'],
  ['devsMoved', '移动成员'],
  ['devsUnassigned', '解绑成员'],
  ['devsDeactivated', '停用成员'],
];

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '进行中';
}

export function OrganizationSyncManager({
  action,
  adapters,
  logs,
}: {
  action: (state: SyncActionState, formData: FormData) => Promise<SyncActionState>;
  adapters: OrganizationAdapterStatus[];
  logs: SyncLogPage;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [detail, setDetail] = useState<SyncLogRecord | null>(null);
  const router = useRouter();
  const hasRunning = logs.records.some((log) => log.status === 'running');

  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(timer);
  }, [hasRunning, router]);

  return (
    <section className="sync-workspace" aria-labelledby="sync-workspace-title">
      <div className="panel-title repo-title">
        <div>
          <span>ORGANIZATION SYNC</span>
          <h2 id="sync-workspace-title">同步控制</h2>
        </div>
        {hasRunning && <span className="sync-live"><LoaderCircle className="spin" size={14} />同步执行中</span>}
      </div>

      <div className="sync-control-grid">
        <form action={formAction} className="sync-upload-form">
          <input name="command" type="hidden" value="sync-preview" />
          <label>
            同步源
            <input defaultValue="manual" maxLength={32} name="source" required />
          </label>
          <label>
            上传 canonical JSON
            <input accept="application/json,.json" name="file" type="file" />
          </label>
          <label>
            JSON 预览内容
            <textarea defaultValue={examplePayload} name="payload" rows={9} />
          </label>
          <button className="primary-command" disabled={pending} type="submit">
            {pending && state.command === 'sync-preview' ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />}
            预览差异
          </button>
        </form>

        <div className="adapter-panel">
          <div><span>SERVER ADAPTERS</span><h3>外部组织源</h3></div>
          {adapters.map((adapter) => (
            <form action={formAction} className="adapter-row" key={adapter.name}>
              <input name="command" type="hidden" value="adapter-preview" />
              <input name="adapter" type="hidden" value={adapter.name} />
              <div><strong>{adapter.name}</strong><span>{adapter.configured ? '凭证已配置' : '凭证未配置'}</span></div>
              <button className="secondary-command" disabled={pending || !adapter.configured || !adapter.supportsPull} type="submit"><RefreshCw size={14} />拉取预览</button>
            </form>
          ))}
        </div>
      </div>

      {state.status !== 'idle' && (
        <p className={`action-feedback repo-feedback sync-feedback ${state.status}`} role="status">
          {state.message}
        </p>
      )}

      {state.preview && state.preview.status === 'completed' && (
        <div className="sync-preview" data-state="sync-preview">
          <div className="panel-title"><div><span>DRY RUN #{state.preview.id}</span><h3>预计变更</h3></div><code>{state.preview.source}</code></div>
          <div className="sync-diff-grid">
            {diffFields.map(([field, label]) => <div key={field}><span>{label}</span><strong>{String(state.preview?.[field] ?? 0)}</strong></div>)}
          </div>
          <form action={formAction} className="sync-confirm-form">
            <input name="command" type="hidden" value="sync-apply" />
            <input name="id" type="hidden" value={state.preview.id} />
            <p>确认后按当前完整快照执行新增、移动、解绑和停用。</p>
            <button className="primary-command" disabled={pending} type="submit"><Play size={15} />确认执行</button>
          </form>
        </div>
      )}

      <div className="sync-history">
        <div className="panel-title"><div><span>SYNC HISTORY</span><h3>最近同步</h3></div><b>{logs.totalCount} RUNS</b></div>
        <div className="table-wrap">
          <table className="sync-table">
            <thead><tr><th>ID</th><th>来源</th><th>模式</th><th>状态</th><th>开始时间</th><th>变更</th><th>操作</th></tr></thead>
            <tbody>{logs.records.map((log) => (
              <tr key={log.id}>
                <td><code>#{log.id}</code></td><td>{log.source}</td><td>{log.dryRun ? 'dry-run' : log.triggerSource}</td>
                <td><span className={`status ${log.status}`}>{log.status}</span></td><td>{formatTime(log.startedAt)}</td>
                <td>{log.teamsCreated + log.teamsUpdated + log.devsCreated + log.devsUpdated}</td>
                <td className="row-actions">
                  <button aria-label={`查看同步 ${log.id}`} className="icon-button" onClick={() => setDetail(log)} title="查看详情" type="button"><Eye size={15} /></button>
                  {log.status === 'error' && <form action={formAction}><input name="command" type="hidden" value="sync-retry" /><input name="id" type="hidden" value={log.id} /><button aria-label={`重试同步 ${log.id}`} className="icon-button" disabled={pending} title="重试" type="submit"><RefreshCw size={15} /></button></form>}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!logs.records.length && <div className="empty-state">暂无同步历史</div>}
        </div>
      </div>

      {detail && <SyncDetailDialog log={detail} onClose={() => setDetail(null)} />}
    </section>
  );
}

function SyncDetailDialog({ log, onClose }: { log: SyncLogRecord; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section aria-labelledby="sync-detail-title" aria-modal="true" className="repo-dialog sync-detail-dialog" role="dialog"><div className="dialog-heading"><div><p className="kicker">SYNC / #{log.id}</p><h2 id="sync-detail-title">同步详情</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><X size={17} /></button></div><dl className="detail-grid"><div><dt>来源</dt><dd>{log.source}</dd></div><div><dt>状态</dt><dd><span className={`status ${log.status}`}>{log.status}</span></dd></div><div><dt>模式</dt><dd>{log.dryRun ? 'dry-run' : log.triggerSource}</dd></div><div><dt>开始</dt><dd>{formatTime(log.startedAt)}</dd></div><div><dt>结束</dt><dd>{formatTime(log.finishedAt)}</dd></div><div><dt>尝试</dt><dd>{log.attempt}</dd></div></dl><div className="sync-diff-grid detail-diff">{diffFields.map(([field, label]) => <div key={field}><span>{label}</span><strong>{String(log[field] ?? 0)}</strong></div>)}</div>{log.errorMessage && <p className="danger-note"><strong>{log.errorCategory ?? 'error'}</strong><br />{log.errorMessage}</p>}</section></div>;
}
