import type { Session } from 'next-auth';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const apiGet = vi.fn();
vi.mock('@/auth', () => ({ auth }));
vi.mock('@/lib/api', () => ({ apiGet }));

const { currentUserIsAdmin, hasAdminAccess } = await import('@/lib/admin-auth');

function session(isAdmin: boolean) {
  return { isAdmin, apiToken: 'token', user: {}, expires: new Date().toISOString() } as Session;
}

describe('server-side administrator access', () => {
  it('allows only an administrator session', () => {
    expect(hasAdminAccess(session(true), { NODE_ENV: 'production' })).toBe(true);
    expect(hasAdminAccess(session(false), { NODE_ENV: 'production' })).toBe(false);
  });

  it('requires an explicit administrator flag for development impersonation', () => {
    expect(
      hasAdminAccess(null, {
        NODE_ENV: 'development',
        METRICS_DEV_DEVELOPER_ID: '1',
        METRICS_DEV_IS_ADMIN: 'true',
      }),
    ).toBe(true);
    expect(
      hasAdminAccess(null, {
        NODE_ENV: 'development',
        METRICS_DEV_DEVELOPER_ID: '1',
        METRICS_DEV_IS_ADMIN: 'false',
      }),
    ).toBe(false);
  });

  it('uses current API authorization instead of a stale administrator session claim', async () => {
    auth.mockResolvedValue(session(true));
    apiGet.mockResolvedValue({ kind: 'user', isAdmin: false });
    await expect(currentUserIsAdmin()).resolves.toBe(false);

    auth.mockResolvedValue(session(false));
    apiGet.mockResolvedValue({ kind: 'user', isAdmin: true });
    await expect(currentUserIsAdmin()).resolves.toBe(true);
  });

  it('denies rendering when current authorization cannot be verified', async () => {
    auth.mockResolvedValue(session(true));
    apiGet.mockRejectedValue(new Error('metrics API unavailable'));
    await expect(currentUserIsAdmin()).resolves.toBe(false);
  });
});
