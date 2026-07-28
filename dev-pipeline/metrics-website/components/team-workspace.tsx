import { ChevronLeft, ChevronRight, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import type { TeamMemberPage, VisibleTeam } from '@/lib/types';

export interface TeamViewQuery {
  teamId: number;
  days: number;
  pageNum: number;
  pageSize: number;
  q: string;
  dataStatus: 'all' | 'with-data' | 'without-data';
  sortBy:
    | 'displayName'
    | 'completedRuns'
    | 'completionRate'
    | 'avgCycleTimeMinutes'
    | 'avgReviewRounds';
  sortOrder: 'asc' | 'desc';
}

export interface FlatTeam extends Omit<VisibleTeam, 'children'> {
  depth: number;
}

export function flattenTeams(teams: VisibleTeam[], depth = 0): FlatTeam[] {
  return teams.flatMap((team) => [
    { id: team.id, name: team.name, slug: team.slug, parentId: team.parentId, depth },
    ...flattenTeams(team.children, depth + 1),
  ]);
}

function teamHref(query: TeamViewQuery, overrides: Partial<TeamViewQuery>) {
  const next = { ...query, ...overrides };
  const params = new URLSearchParams({
    teamId: String(next.teamId),
    days: String(next.days),
    pageNum: String(next.pageNum),
    pageSize: String(next.pageSize),
    q: next.q,
    dataStatus: next.dataStatus,
    sortBy: next.sortBy,
    sortOrder: next.sortOrder,
  });
  return `/team?${params}`;
}

export function TeamSelector({ teams, query }: { teams: FlatTeam[]; query: TeamViewQuery }) {
  return (
    <section className="team-selector" aria-label="团队范围">
      <div>
        <p className="kicker">TEAM / SCOPE</p>
        <h2>团队范围</h2>
      </div>
      <form action="/team" method="get">
        <input name="days" type="hidden" value={query.days} />
        <label>
          <span>可见团队</span>
          <select aria-label="可见团队" defaultValue={query.teamId} name="teamId">
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {`${'- '.repeat(team.depth)}${team.name}`}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-command" type="submit">
          查看团队
        </button>
      </form>
    </section>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function TeamMembers({ page, teams, query }: { page: TeamMemberPage; teams: FlatTeam[]; query: TeamViewQuery }) {
  return (
    <section className="data-section team-members">
      <div className="panel-title">
        <div>
          <span>TEAM / MEMBERS</span>
          <h2>成员明细</h2>
        </div>
        <b>{page.totalCount} MEMBERS</b>
      </div>
      <form action="/team" className="member-filters" method="get">
        <input name="teamId" type="hidden" value={query.teamId} />
        <input name="days" type="hidden" value={query.days} />
        <label className="search-field">
          <Search size={16} />
          <input aria-label="搜索成员" defaultValue={query.q} name="q" placeholder="姓名或邮箱" />
        </label>
        <select aria-label="数据状态" defaultValue={query.dataStatus} name="dataStatus">
          <option value="all">全部成员</option>
          <option value="with-data">有可信数据</option>
          <option value="without-data">暂无数据</option>
        </select>
        <select aria-label="成员排序" defaultValue={query.sortBy} name="sortBy">
          <option value="displayName">按姓名</option>
          <option value="completedRuns">按完成数</option>
          <option value="completionRate">按完成率</option>
          <option value="avgCycleTimeMinutes">按周期时间</option>
          <option value="avgReviewRounds">按审查轮次</option>
        </select>
        <select aria-label="排序方向" defaultValue={query.sortOrder} name="sortOrder">
          <option value="asc">升序</option>
          <option value="desc">降序</option>
        </select>
        <select aria-label="每页数量" defaultValue={query.pageSize} name="pageSize">
          <option value="10">10 / 页</option>
          <option value="20">20 / 页</option>
          <option value="50">50 / 页</option>
        </select>
        <button className="secondary-command" type="submit">
          <Search size={15} />筛选
        </button>
      </form>

      {page.records.length ? (
        <div className="table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>成员</th>
                <th>归属团队</th>
                <th>完成</th>
                <th>完成率</th>
                <th>周期时间</th>
                <th>审查轮次</th>
              </tr>
            </thead>
            <tbody>
              {page.records.map((member) => (
                <tr key={member.id}>
                  <td>
                    <UserRound size={15} />
                    <a href={`/team/member/${member.id}?teamId=${query.teamId}&days=${query.days}`}>
                      <strong>{member.displayName || member.email}</strong>
                      <small>{member.email}</small>
                    </a>
                  </td>
                  <td>{member.team?.name ?? '未分配'}</td>
                  <td>{member.completedRuns} / {member.totalRuns}</td>
                  <td>{percent(member.completionRate)}</td>
                  <td>{member.avgCycleTimeMinutes} 分钟</td>
                  <td>{member.avgReviewRounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">当前筛选没有匹配成员</div>
      )}

      <nav className="pagination" aria-label="成员分页">
        {page.pageNum > 1 ? (
          <Link aria-label="上一页" className="icon-button" href={teamHref(query, { pageNum: page.pageNum - 1 })}>
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span aria-disabled="true" className="icon-button"><ChevronLeft size={16} /></span>
        )}
        <span>{page.pageNum} / {Math.max(page.totalPage, 1)}</span>
        {page.pageNum < page.totalPage ? (
          <Link aria-label="下一页" className="icon-button" href={teamHref(query, { pageNum: page.pageNum + 1 })}>
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span aria-disabled="true" className="icon-button"><ChevronRight size={16} /></span>
        )}
      </nav>
      <p className="team-visibility-note">当前可见 {teams.length} 个团队</p>
    </section>
  );
}
