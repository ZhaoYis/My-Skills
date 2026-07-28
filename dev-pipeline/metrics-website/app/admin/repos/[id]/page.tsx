import { ArrowLeft, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { ApiFailure } from '@/components/api-failure';
import { RequestState } from '@/components/request-state';
import { apiGet } from '@/lib/api';
import { currentUserIsAdmin } from '@/lib/admin-auth';
import type { RepoDetail } from '@/lib/types';

export default async function RepoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUserIsAdmin())) return <RequestState kind="forbidden" />;
  const { id } = await params;
  let repo: RepoDetail;
  try {
    repo = await apiGet<RepoDetail>(`/repos/${id}`, { serviceAuth: true });
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  return (
    <>
      <header className="topbar"><div><span className="live-dot" /> REPOSITORY DETAIL</div></header>
      <div className="workspace admin-workspace repo-detail">
        <Link className="back-link" href="/admin"><ArrowLeft size={15} />返回仓库列表</Link>
        <section className="page-heading">
          <div><p className="kicker">REPOSITORY / {repo.id}</p><h1>{repo.name}</h1><p>{repo.gitUrl}</p></div>
          <span className={`status ${repo.collectionStatus}`}>{repo.collectionStatus}</span>
        </section>
        <dl className="detail-grid">
          <div><dt>分支</dt><dd><GitBranch size={14} /><code>{repo.gitBranch}</code></dd></div>
          <div><dt>采集起点</dt><dd>{new Date(repo.collectSince).toLocaleDateString('zh-CN')}</dd></div>
          <div><dt>Scan from</dt><dd><code>{repo.scanFromCommit?.slice(0, 12) ?? 'not-set'}</code></dd></div>
          <div><dt>Scan to</dt><dd><code>{repo.scanToCommit?.slice(0, 12) ?? 'not-set'}</code></dd></div>
          <div><dt>最后相关 Commit</dt><dd><code>{repo.lastRelevantCommit?.slice(0, 12) ?? 'not-set'}</code></dd></div>
          <div><dt>保留策略</dt><dd>{repo.retentionDays} 天</dd></div>
        </dl>
        <section className="data-section">
          <div className="panel-title"><div><span>RECENT RUNS</span><h2>最近采集日志</h2></div></div>
          <div className="table-wrap"><table><thead><tr><th>排队时间</th><th>Commit</th><th>文件</th><th>入库</th><th>拒绝</th><th>状态</th></tr></thead><tbody>{repo.collectionLogs.map((log) => <tr key={log.id}><td>{new Date(log.startedAt ?? log.queuedAt).toLocaleString('zh-CN')}</td><td>{log.commitsScanned}</td><td>{log.filesFound}</td><td>{log.runsUpserted}</td><td>{log.fingerprintsRejected}</td><td><span className={`status ${log.status}`}>{log.status}</span></td></tr>)}</tbody></table>{!repo.collectionLogs.length && <div className="empty-state">暂无采集日志</div>}</div>
        </section>
      </div>
    </>
  );
}
