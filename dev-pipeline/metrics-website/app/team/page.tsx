import { Dashboard } from '@/components/dashboard';
import { ApiFailure } from '@/components/api-failure';
import { RequestState } from '@/components/request-state';
import { flattenTeams, TeamMembers, TeamSelector, type TeamViewQuery } from '@/components/team-workspace';
import { apiGet } from '@/lib/api';
import type { Overview, TeamMemberPage, VisibleTeam } from '@/lib/types';

type TeamSearchParams = {
  teamId?: string;
  days?: string;
  pageNum?: string;
  pageSize?: string;
  q?: string;
  dataStatus?: string;
  sortBy?: string;
  sortOrder?: string;
};

export default async function TeamPage({ searchParams }: { searchParams: Promise<TeamSearchParams> }) {
  const params = await searchParams;
  const rawDays = params.days ?? '30';
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
  let visibleTree: VisibleTeam[];
  try {
    visibleTree = await apiGet<VisibleTeam[]>('/metrics/teams/visible');
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  const teams = flattenTeams(visibleTree);
  if (!teams.length) return <RequestState kind="no-team" />;

  const selectedTeamId = params.teamId ? Number(params.teamId) : teams[0].id;
  const pageNum = Math.max(1, Number(params.pageNum) || 1);
  const pageSize = [10, 20, 50].includes(Number(params.pageSize)) ? Number(params.pageSize) : 10;
  const dataStatus = ['with-data', 'without-data'].includes(String(params.dataStatus))
    ? (params.dataStatus as TeamViewQuery['dataStatus'])
    : 'all';
  const sortBy = [
    'displayName',
    'completedRuns',
    'completionRate',
    'avgCycleTimeMinutes',
    'avgReviewRounds',
  ].includes(String(params.sortBy))
    ? (params.sortBy as TeamViewQuery['sortBy'])
    : 'displayName';
  const sortOrder = params.sortOrder === 'desc' ? 'desc' : 'asc';
  const query: TeamViewQuery = {
    teamId: selectedTeamId,
    days,
    pageNum,
    pageSize,
    q: params.q ?? '',
    dataStatus,
    sortBy,
    sortOrder,
  };
  const memberParams = new URLSearchParams({
    pageNum: String(query.pageNum),
    pageSize: String(query.pageSize),
    q: query.q,
    dataStatus: query.dataStatus,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    days: String(days),
  });

  let data: Overview;
  let members: TeamMemberPage;
  try {
    [data, members] = await Promise.all([
      apiGet<Overview>(`/metrics/team/${selectedTeamId}?days=${days}`),
      apiGet<TeamMemberPage>(`/metrics/team/${selectedTeamId}/members?${memberParams}`),
    ]);
  } catch (error) {
    return <ApiFailure error={error} />;
  }

  const team = teams.find(({ id }) => id === selectedTeamId);
  const periodBase = `/team?teamId=${selectedTeamId}`;
  return (
    <Dashboard
      data={data}
      emptyDetail={members.totalCount ? '团队成员在当前范围内暂无可信指标。' : undefined}
      emptyKind={members.totalCount ? 'empty' : 'empty-team'}
      periodBase={periodBase}
      periodDays={days}
      scope={`TEAM ${team?.name ?? selectedTeamId}`}
      toolbar={<TeamSelector query={query} teams={teams} />}
    >
      {members.totalCount > 0 && <TeamMembers page={members} query={query} teams={teams} />}
    </Dashboard>
  );
}
