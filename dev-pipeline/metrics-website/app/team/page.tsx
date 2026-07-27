import { Dashboard } from '@/components/dashboard';
import { apiGet, emptyOverview } from '@/lib/api';
import type { Overview } from '@/lib/types';

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ teamId?: string; days?: string }> }) {
  const { teamId = '1', days: rawDays = '30' } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
  const data = await apiGet<Overview>(`/metrics/team/${Number(teamId) || 1}?days=${days}`).catch(emptyOverview);
  return <Dashboard data={data} scope={`TEAM ${teamId}`} periodDays={days} periodBase={`/team?teamId=${teamId}`} />;
}
