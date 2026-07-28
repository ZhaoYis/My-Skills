'use client';

import {
  Archive,
  CirclePower,
  Edit3,
  GitBranch,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { RepoPage, RepoRecord } from '@/lib/types';

export interface RepoActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  command?: string;
}

const initialState: RepoActionState = { status: 'idle' };

interface RepoDraft {
  name: string;
  gitUrl: string;
  gitBranch: string;
  retentionDays: string;
  collectSince: string;
}

export function RepoManager({
  repos,
  query,
  status,
  action,
}: {
  repos: RepoPage;
  query: string;
  status: string;
  action: (state: RepoActionState, formData: FormData) => Promise<RepoActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [editing, setEditing] = useState<RepoRecord | 'new' | null>(null);
  const [draft, setDraft] = useState<RepoDraft | null>(null);

  const openEditor = (repo: RepoRecord | 'new') => {
    setEditing(repo);
    setDraft(repo === 'new'
      ? {
          name: '',
          gitUrl: '',
          gitBranch: 'main',
          retentionDays: '365',
          collectSince: new Date().toISOString().slice(0, 10),
        }
      : {
          name: repo.name,
          gitUrl: repo.gitUrl,
          gitBranch: repo.gitBranch,
          retentionDays: String(repo.retentionDays),
          collectSince: repo.collectSince.slice(0, 10),
        });
  };

  const pageHref = (pageNum: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (status !== 'all') params.set('status', status);
    params.set('pageNum', String(pageNum));
    return `/admin?${params.toString()}`;
  };

  return (
    <section className="data-section repo-manager">
      <div className="panel-title repo-title">
        <div><span>REPOSITORIES</span><h2>仓库管理</h2></div>
        <button className="primary-command" onClick={() => openEditor('new')} type="button">
          <Plus size={16} />新增仓库
        </button>
      </div>

      <form className="repo-filters" method="get">
        <label className="search-field">
          <Search size={15} />
          <input aria-label="搜索仓库" defaultValue={query} name="q" placeholder="名称或 Git URL" />
        </label>
        <select aria-label="仓库状态" defaultValue={status} name="status">
          <option value="all">全部状态</option>
          <option value="active">已启用</option>
          <option value="inactive">已停用</option>
          <option value="error">采集异常</option>
          <option value="deleted">已删除</option>
        </select>
        <button className="secondary-command" type="submit">筛选</button>
      </form>

      {state.status !== 'idle' && (
        <p className={`action-feedback repo-feedback ${state.status}`} role="status">{state.message}</p>
      )}

      <div className="table-wrap">
        <table className="repo-table">
          <thead><tr><th>仓库</th><th>地址</th><th>分支</th><th>状态</th><th>Checkpoint</th><th>操作</th></tr></thead>
          <tbody>
            {repos.records.map((repo) => (
              <tr key={repo.id}>
                <td><GitBranch size={15} /><Link href={`/admin/repos/${repo.id}`}>{repo.name}</Link></td>
                <td className="repo-url" title={repo.gitUrl}>{repo.gitUrl}</td>
                <td><code>{repo.gitBranch}</code></td>
                <td>
                  <span className={`status ${repo.deletedAt ? 'error' : repo.collectionStatus}`}>
                    {repo.deletedAt ? 'deleted' : repo.isActive ? repo.collectionStatus : 'inactive'}
                  </span>
                </td>
                <td><code>{repo.lastFetchedCommit?.slice(0, 8) ?? 'not-set'}</code></td>
                <td className="row-actions">
                  <button aria-label={`编辑 ${repo.name}`} className="icon-button" onClick={() => openEditor(repo)} title="编辑仓库" type="button"><Edit3 size={15} /></button>
                  {!repo.deletedAt && (
                    <>
                      <RepoCommand action={formAction} command="collect" disabled={pending || !repo.isActive} icon={<Play size={15} />} id={repo.id} label={`采集 ${repo.name}`} />
                      <RepoCommand action={formAction} command="reset" confirm="重置后下次采集将重新扫描历史，已有指标不会删除。继续吗？" disabled={pending} icon={<RotateCcw size={15} />} id={repo.id} label={`重置 ${repo.name}`} />
                      <RepoCommand action={formAction} command="toggle" disabled={pending} icon={<CirclePower size={15} />} id={repo.id} label={`${repo.isActive ? '停用' : '启用'} ${repo.name}`} value={String(!repo.isActive)} />
                      <RepoCommand action={formAction} command="delete" confirm="软删除会停止后续采集，但保留全部历史指标。继续吗？" disabled={pending} icon={<Trash2 size={15} />} id={repo.id} label={`删除 ${repo.name}`} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!repos.records.length && <div className="empty-state">当前筛选条件下没有仓库</div>}
      </div>

      {repos.totalPage > 1 && (
        <nav aria-label="仓库分页" className="pagination">
          {repos.pageNum > 1 && <Link href={pageHref(repos.pageNum - 1)}>上一页</Link>}
          <span>{repos.pageNum} / {repos.totalPage}</span>
          {repos.pageNum < repos.totalPage && <Link href={pageHref(repos.pageNum + 1)}>下一页</Link>}
        </nav>
      )}

      {editing && draft && (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="repo-dialog-title" aria-modal="true" className="repo-dialog" role="dialog">
            <div className="dialog-heading">
              <div><p className="kicker">REPOSITORY / CONFIG</p><h2 id="repo-dialog-title">{editing === 'new' ? '新增仓库' : '编辑仓库'}</h2></div>
              <button aria-label="关闭" className="icon-button" onClick={() => setEditing(null)} title="关闭" type="button"><X size={17} /></button>
            </div>
            <form action={formAction} className="repo-form">
              <input defaultValue="save" name="command" type="hidden" />
              {editing !== 'new' && <input name="id" type="hidden" value={editing.id} />}
              <label>名称<input maxLength={255} name="name" onChange={(event) => setDraft({ ...draft, name: event.target.value })} required value={draft.name} /></label>
              <label>Git URL<input maxLength={512} name="gitUrl" onChange={(event) => setDraft({ ...draft, gitUrl: event.target.value })} required value={draft.gitUrl} /></label>
              <div className="form-grid">
                <label>分支<input maxLength={255} name="gitBranch" onChange={(event) => setDraft({ ...draft, gitBranch: event.target.value })} required value={draft.gitBranch} /></label>
                <label>保留天数<input max={3650} min={1} name="retentionDays" onChange={(event) => setDraft({ ...draft, retentionDays: event.target.value })} required type="number" value={draft.retentionDays} /></label>
              </div>
              <label>采集起始日期<input name="collectSince" onChange={(event) => setDraft({ ...draft, collectSince: event.target.value })} required type="date" value={draft.collectSince} /></label>
              {state.status !== 'idle' && (state.command === 'save' || state.command === 'test') && (
                <p className={`action-feedback dialog-feedback ${state.status}`} role="status">
                  {state.message}
                </p>
              )}
              <div className="dialog-actions">
                <button className="secondary-command" disabled={pending} onClick={(event) => setFormCommand(event.currentTarget.form, 'test')} type="submit">
                  {pending ? <LoaderCircle className="spin" size={15} /> : <Wifi size={15} />}测试连接
                </button>
                <button className="primary-command" disabled={pending} onClick={(event) => setFormCommand(event.currentTarget.form, 'save')} type="submit">
                  {pending ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />}保存
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function setFormCommand(form: HTMLFormElement | null, command: string) {
  const input = form?.elements.namedItem('command');
  if (input instanceof HTMLInputElement) input.value = command;
}

function RepoCommand({ action, command, confirm, disabled, icon, id, label, value }: {
  action: (formData: FormData) => void;
  command: string;
  confirm?: string;
  disabled: boolean;
  icon: React.ReactNode;
  id: number;
  label: string;
  value?: string;
}) {
  return (
    <form action={action} onSubmit={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}>
      <input name="command" type="hidden" value={command} />
      <input name="id" type="hidden" value={id} />
      {value !== undefined && <input name="value" type="hidden" value={value} />}
      <button aria-label={label} className="icon-button" disabled={disabled} title={label} type="submit">{icon}</button>
    </form>
  );
}
