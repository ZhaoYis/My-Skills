import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ApiFailure } from '@/components/api-failure';
import { Dashboard } from '@/components/dashboard';
import { apiGet } from '@/lib/api';
import type { TeamMemberDetail } from '@/lib/types';

export default async function TeamMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ developerId: string }>;
  searchParams: Promise<{ teamId?: string; days?: string }>;
}) {
  const [{ developerId }, query] = await Promise.all([params, searchParams]);
  const teamId = Number(query.teamId);
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  let member: TeamMemberDetail;
  try {
    member = await apiGet<TeamMemberDetail>(
      `/metrics/team/${teamId}/members/${Number(developerId)}?days=${days}`,
    );
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  const displayName = member.displayName || member.email;
  return (
    <Dashboard
      data={member.overview}
      emptyDetail="该成员在当前范围内暂无可信指标。"
      periodBase={`/team/member/${member.id}?teamId=${teamId}`}
      periodDays={days}
      scope={`MEMBER ${displayName}`}
      toolbar={
        <div className="member-detail-toolbar">
          <Link className="secondary-command" href={`/team?teamId=${teamId}&days=${days}`}>
            <ArrowLeft size={16} />返回成员列表
          </Link>
          <div><strong>{displayName}</strong><span>{member.email} · {member.team?.name ?? '未分配'}</span></div>
        </div>
      }
    />
  );
}
