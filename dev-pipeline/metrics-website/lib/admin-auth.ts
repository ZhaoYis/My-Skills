import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { apiGet } from '@/lib/api';

interface CurrentIdentity {
  kind: 'user';
  isAdmin: boolean;
}

export function hasAdminAccess(
  session: Session | null,
  env: Partial<
    Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'METRICS_DEV_DEVELOPER_ID' | 'METRICS_DEV_IS_ADMIN'>
  > =
    process.env,
) {
  if (session) return session.isAdmin;
  return (
    env.NODE_ENV === 'development' &&
    Boolean(env.METRICS_DEV_DEVELOPER_ID) &&
    env.METRICS_DEV_IS_ADMIN === 'true'
  );
}

export async function currentUserIsAdmin() {
  const session = await auth();
  if (!session && !hasAdminAccess(null)) return false;
  try {
    const identity = await apiGet<CurrentIdentity>('/auth/me');
    return identity.kind === 'user' && identity.isAdmin;
  } catch {
    return false;
  }
}
