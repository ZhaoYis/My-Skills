import { Dashboard } from '@/components/dashboard';
import { ApiFailure } from '@/components/api-failure';
import { RequestState } from '@/components/request-state';
import { apiGet } from '@/lib/api';
import type { Overview } from '@/lib/types';

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: rawDays = '30' } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
  let data: Overview;
  try {
    data = await apiGet<Overview>(`/metrics/me?days=${days}`);
  } catch (error) {
    return <ApiFailure error={error} />;
  }
  if (data.totalRuns === 0) return <RequestState kind="empty" />;
  return <Dashboard data={data} scope="PERSONAL" periodDays={days} />;
}
