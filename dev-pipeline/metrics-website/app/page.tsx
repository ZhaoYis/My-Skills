import { Dashboard } from '@/components/dashboard';
import { apiGet, emptyOverview } from '@/lib/api';
import type { Overview } from '@/lib/types';

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: rawDays = '30' } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
  const data = await apiGet<Overview>(`/metrics/me?days=${days}`).catch(emptyOverview);
  return <Dashboard data={data} scope="PERSONAL" periodDays={days} />;
}
