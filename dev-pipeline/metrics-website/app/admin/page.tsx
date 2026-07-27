import { Database, GitBranch, RefreshCw, ShieldCheck } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import { apiGet, apiPost } from '@/lib/api';

interface RepoPage { records: Array<{ id: number; name: string; gitBranch: string; collectionStatus: string; lastFetchedAt: string | null }>; totalCount: number }
interface LogPage { records: Array<{ id: string; status: string; commitsScanned: number; filesFound: number; runsUpserted: number; fingerprintsRejected: number; startedAt: string; repo: { name: string } }> }

export default async function AdminPage() {
  const repos = await apiGet<RepoPage>('/repos?pageSize=100').catch(() => ({ records: [], totalCount: 0 }));
  const logs = await apiGet<LogPage>('/collection/logs?pageSize=8').catch(() => ({ records: [] }));
  return (
    <><header className="topbar"><div><span className="live-dot" /> COLLECTOR CONTROL</div></header>
      <div className="workspace admin-workspace">
        <section className="page-heading"><div><p className="kicker">ADMIN / INGESTION</p><h1>采集控制台</h1><p>仓库连接、增量位置与指纹拒绝记录。</p></div><form action={async () => { 'use server'; await apiPost('/collection/trigger-all'); revalidatePath('/admin'); }}><button className="primary-command" type="submit"><RefreshCw size={16} />全部采集</button></form></section>
        <section className="admin-summary"><div><Database size={18} /><span>启用仓库</span><strong>{repos.totalCount}</strong></div><div><ShieldCheck size={18} /><span>最近拒绝</span><strong>{logs.records.reduce((sum, log) => sum + log.fingerprintsRejected, 0)}</strong></div></section>
        <section className="data-section"><div className="panel-title"><div><span>REPOSITORIES</span><h2>仓库状态</h2></div></div><div className="table-wrap"><table><thead><tr><th>仓库</th><th>分支</th><th>状态</th><th>最后采集</th></tr></thead><tbody>{repos.records.map((repo) => <tr key={repo.id}><td><GitBranch size={15} />{repo.name}</td><td><code>{repo.gitBranch}</code></td><td><span className={`status ${repo.collectionStatus}`}>{repo.collectionStatus}</span></td><td>{repo.lastFetchedAt ? new Date(repo.lastFetchedAt).toLocaleString('zh-CN') : '尚未采集'}</td></tr>)}</tbody></table>{!repos.records.length && <div className="empty-state">暂无已配置仓库</div>}</div></section>
        <section className="data-section"><div className="panel-title"><div><span>RECENT LOG</span><h2>采集记录</h2></div></div><div className="table-wrap"><table><thead><tr><th>仓库</th><th>Commit</th><th>文件</th><th>入库</th><th>指纹拒绝</th><th>状态</th></tr></thead><tbody>{logs.records.map((log) => <tr key={log.id}><td>{log.repo.name}</td><td>{log.commitsScanned}</td><td>{log.filesFound}</td><td>{log.runsUpserted}</td><td>{log.fingerprintsRejected}</td><td><span className={`status ${log.status}`}>{log.status}</span></td></tr>)}</tbody></table>{!logs.records.length && <div className="empty-state">暂无采集记录</div>}</div></section>
      </div></>
  );
}
