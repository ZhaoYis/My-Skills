'use client';

import { Edit3, LoaderCircle, Plus, Search, UserRoundCog, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { DeveloperPage, DeveloperRecord, TeamRecord } from '@/lib/types';

export interface OrganizationActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  command?: string;
}

const initialState: OrganizationActionState = { status: 'idle' };

function flattenTeams(teams: TeamRecord[], depth = 0): Array<TeamRecord & { depth: number }> {
  return teams.flatMap((team) => [
    { ...team, depth },
    ...flattenTeams(team.children, depth + 1),
  ]);
}

export function OrganizationManager({
  teams,
  developers,
  filters,
  action,
}: {
  teams: TeamRecord[];
  developers: DeveloperPage;
  filters: { q: string; unassigned: boolean; claim: string; status: string };
  action: (state: OrganizationActionState, formData: FormData) => Promise<OrganizationActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [teamEditor, setTeamEditor] = useState<TeamRecord | 'new' | null>(null);
  const [deactivatingTeam, setDeactivatingTeam] = useState<TeamRecord | null>(null);
  const [developerEditor, setDeveloperEditor] = useState<DeveloperRecord | null>(null);
  const flatTeams = flattenTeams(teams);
  const activeTeams = flatTeams.filter((team) => team.isActive);

  const pageHref = (pageNum: number) => {
    const params = new URLSearchParams({ pageNum: String(pageNum) });
    if (filters.q) params.set('q', filters.q);
    if (filters.unassigned) params.set('unassigned', 'true');
    if (filters.claim !== 'all') params.set('claim', filters.claim);
    if (filters.status !== 'all') params.set('status', filters.status);
    return `/admin/organization?${params.toString()}`;
  };

  return (
    <div className="organization-layout">
      {state.status !== 'idle' && (
        <p className={`action-feedback repo-feedback organization-feedback ${state.status}`} role="status">
          {state.message}
        </p>
      )}

      <section className="data-section">
        <div className="panel-title repo-title">
          <div><span>TEAM TREE</span><h2>团队结构</h2></div>
          <button className="primary-command" onClick={() => setTeamEditor('new')} type="button"><Plus size={16} />新增团队</button>
        </div>
        <div className="table-wrap">
          <table className="organization-table">
            <thead><tr><th>团队</th><th>Slug</th><th>外部 ID</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{flatTeams.map((team) => (
              <tr key={team.id}>
                <td><span className="tree-cell" style={{ paddingLeft: `${team.depth * 18}px` }}><Users size={14} />{team.name}</span></td>
                <td><code>{team.slug}</code></td>
                <td>{team.externalId ?? '未关联'}</td>
                <td><span className={`status ${team.isActive ? 'completed' : 'inactive'}`}>{team.isActive ? 'active' : 'inactive'}</span></td>
                <td className="row-actions">
                  <button aria-label={`编辑团队 ${team.name}`} className="icon-button" onClick={() => setTeamEditor(team)} title="编辑团队" type="button"><Edit3 size={15} /></button>
                  {team.isActive && <button aria-label={`停用团队 ${team.name}`} className="icon-button" onClick={() => setDeactivatingTeam(team)} title="停用团队" type="button"><X size={15} /></button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!flatTeams.length && <div className="empty-state">暂无团队</div>}
        </div>
      </section>

      <section className="data-section">
        <div className="panel-title"><div><span>DEVELOPERS</span><h2>开发者管理</h2></div></div>
        <form className="developer-filters" method="get">
          <label className="search-field"><Search size={15} /><input aria-label="搜索开发者" defaultValue={filters.q} name="q" placeholder="邮箱、姓名或外部 ID" /></label>
          <select aria-label="认领状态" defaultValue={filters.claim} name="claim"><option value="all">全部认领</option><option value="linked">已关联</option><option value="unlinked">待认领</option></select>
          <select aria-label="开发者状态" defaultValue={filters.status} name="status"><option value="all">全部状态</option><option value="active">在职</option><option value="inactive">已停用</option></select>
          <label className="checkbox-field"><input defaultChecked={filters.unassigned} name="unassigned" type="checkbox" value="true" />仅未分配</label>
          <button className="secondary-command" type="submit">筛选</button>
        </form>
        <div className="table-wrap">
          <table className="developer-table">
            <thead><tr><th>开发者</th><th>团队</th><th>角色</th><th>OIDC 关联</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>{developers.records.map((developer) => (
              <tr key={developer.id}>
                <td><div className="developer-identity"><strong>{developer.displayName ?? '未命名'}</strong><span>{developer.email}</span></div></td>
                <td>{developer.team?.name ?? '未分配'}</td>
                <td><code>{developer.role ?? 'member'}</code></td>
                <td><span className={`claim-state ${developer.externalId ? 'linked' : 'unlinked'}`}>{developer.externalId ? '已关联' : '待认领'}</span></td>
                <td><span className={`status ${developer.isActive ? 'completed' : 'inactive'}`}>{developer.isActive ? 'active' : 'inactive'}</span></td>
                <td><button aria-label={`编辑开发者 ${developer.email}`} className="icon-button" onClick={() => setDeveloperEditor(developer)} title="编辑开发者" type="button"><UserRoundCog size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table>
          {!developers.records.length && <div className="empty-state">当前筛选条件下没有开发者</div>}
        </div>
        {developers.totalPage > 1 && <nav aria-label="开发者分页" className="pagination">{developers.pageNum > 1 && <Link href={pageHref(developers.pageNum - 1)}>上一页</Link>}<span>{developers.pageNum} / {developers.totalPage}</span>{developers.pageNum < developers.totalPage && <Link href={pageHref(developers.pageNum + 1)}>下一页</Link>}</nav>}
      </section>

      {teamEditor && <TeamDialog action={formAction} pending={pending} state={state} teams={activeTeams} team={teamEditor} onClose={() => setTeamEditor(null)} />}
      {deactivatingTeam && <DeactivateTeamDialog action={formAction} pending={pending} state={state} team={deactivatingTeam} teams={activeTeams} onClose={() => setDeactivatingTeam(null)} />}
      {developerEditor && <DeveloperDialog action={formAction} developer={developerEditor} pending={pending} state={state} teams={activeTeams} onClose={() => setDeveloperEditor(null)} />}
    </div>
  );
}

function TeamDialog({ team, teams, action, pending, state, onClose }: { team: TeamRecord | 'new'; teams: Array<TeamRecord & { depth: number }>; action: (formData: FormData) => void; pending: boolean; state: OrganizationActionState; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section aria-labelledby="team-dialog-title" aria-modal="true" className="repo-dialog" role="dialog"><div className="dialog-heading"><div><p className="kicker">ORGANIZATION / TEAM</p><h2 id="team-dialog-title">{team === 'new' ? '新增团队' : '编辑团队'}</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><X size={17} /></button></div><form action={action} className="repo-form"><input name="command" type="hidden" value="team-save" />{team !== 'new' && <input name="id" type="hidden" value={team.id} />}<label>名称<input defaultValue={team === 'new' ? '' : team.name} name="name" required /></label><label>Slug<input defaultValue={team === 'new' ? '' : team.slug} name="slug" pattern="[a-z0-9-]+" required /></label><label>父团队<select defaultValue={team === 'new' ? '' : (team.parentId ?? '')} name="parentId"><option value="">根团队</option>{teams.filter((item) => team === 'new' || item.id !== team.id).map((item) => <option key={item.id} value={item.id}>{'--'.repeat(item.depth)} {item.name}</option>)}</select></label><label>外部 ID<input defaultValue={team === 'new' ? '' : (team.externalId ?? '')} name="externalId" /></label><DialogFeedback command="team-save" state={state} /><div className="dialog-actions"><button className="primary-command" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={15} /> : <Users size={15} />}保存团队</button></div></form></section></div>;
}

function DeactivateTeamDialog({ team, teams, action, pending, state, onClose }: { team: TeamRecord; teams: Array<TeamRecord & { depth: number }>; action: (formData: FormData) => void; pending: boolean; state: OrganizationActionState; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section aria-labelledby="deactivate-dialog-title" aria-modal="true" className="repo-dialog" role="dialog"><div className="dialog-heading"><div><p className="kicker">TEAM / DEACTIVATE</p><h2 id="deactivate-dialog-title">停用 {team.name}</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><X size={17} /></button></div><p className="danger-note">停用不会删除历史指标。存在子团队或成员时，必须明确选择处理方式。</p><form action={action} className="repo-form"><input name="command" type="hidden" value="team-deactivate" /><input name="id" type="hidden" value={team.id} /><label>子团队处理<select defaultValue="reject" name="childStrategy"><option value="reject">有子团队时拒绝</option><option value="promote">提升到当前团队的上级</option></select></label><label>成员处理<select defaultValue="reject" name="memberStrategy"><option value="reject">有成员时拒绝</option><option value="unassign">解绑为未分配</option><option value="move">迁移到目标团队</option></select></label><label>成员目标团队<select defaultValue="" name="targetTeamId"><option value="">不迁移</option>{teams.filter((item) => item.id !== team.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><DialogFeedback command="team-deactivate" state={state} /><div className="dialog-actions"><button className="secondary-command" onClick={onClose} type="button">取消</button><button className="primary-command danger-command" disabled={pending} type="submit">确认停用</button></div></form></section></div>;
}

function DeveloperDialog({ developer, teams, action, pending, state, onClose }: { developer: DeveloperRecord; teams: Array<TeamRecord & { depth: number }>; action: (formData: FormData) => void; pending: boolean; state: OrganizationActionState; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section aria-labelledby="developer-dialog-title" aria-modal="true" className="repo-dialog" role="dialog"><div className="dialog-heading"><div><p className="kicker">ORGANIZATION / DEVELOPER</p><h2 id="developer-dialog-title">编辑开发者</h2></div><button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><X size={17} /></button></div><form action={action} className="repo-form"><input name="command" type="hidden" value="developer-save" /><input name="id" type="hidden" value={developer.id} /><label>邮箱<input disabled value={developer.email} /></label><label>显示名称<input defaultValue={developer.displayName ?? ''} name="displayName" required /></label><div className="form-grid"><label>团队<select defaultValue={developer.teamId ?? ''} name="teamId"><option value="">未分配</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>角色<select defaultValue={developer.role ?? 'member'} name="role"><option value="member">成员</option><option value="admin">管理员</option></select></label></div><label>OIDC externalId<input defaultValue={developer.externalId ?? ''} name="externalId" placeholder="留空表示待认领" /></label><label>状态<select defaultValue={String(developer.isActive)} name="isActive"><option value="true">在职</option><option value="false">停用</option></select></label><DialogFeedback command="developer-save" state={state} /><div className="dialog-actions"><button className="primary-command" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={15} /> : <UserRoundCog size={15} />}保存开发者</button></div></form></section></div>;
}

function DialogFeedback({ command, state }: { command: string; state: OrganizationActionState }) {
  if (state.status === 'idle' || state.command !== command) return null;
  return <p className={`action-feedback dialog-feedback ${state.status}`} role="status">{state.message}</p>;
}
