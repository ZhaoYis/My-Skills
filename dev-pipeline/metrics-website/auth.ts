import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getWebsiteAuthConfig } from '@/lib/auth-config';

const authConfig = getWebsiteAuthConfig();

const oidcConfigured = Boolean(authConfig.oidcIssuer);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: oidcConfigured
    ? [
        {
          id: 'company-oidc',
          name: '域账号',
          type: 'oidc',
          issuer: authConfig.oidcIssuer,
          clientId: authConfig.oidcClientId,
          clientSecret: authConfig.oidcClientSecret,
          checks: ['pkce', 'state'],
          profile(profile) {
            return {
              id: String(profile.sub),
              name: String(profile.name ?? profile.preferred_username ?? profile.email),
              email: String(profile.email),
            };
          },
        },
      ]
    : [
        // Development-only placeholder: when OIDC is not configured, the authorized
        // callback lets through requests with METRICS_DEV_DEVELOPER_ID set.
        // This provider exists only to satisfy NextAuth's provider validation.
        Credentials({
          name: 'Development',
          credentials: {},
          authorize() {
            return null;
          },
        }),
      ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.email && profile.sub) {
        const response = await fetch(`${authConfig.metricsApiUrl}/auth/session`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': authConfig.metricsServiceKey ?? '',
          },
          body: JSON.stringify({
            email: profile.email,
            name: profile.name ?? profile.preferred_username ?? profile.email,
            sub: profile.sub,
          }),
        });
        if (!response.ok) throw new Error('Metrics API session exchange failed');
        const payload = (await response.json()) as { data: { token: string; developer: { role?: string } } };
        token.apiToken = payload.data.token;
        token.isAdmin = payload.data.developer.role === 'admin';
      }
      return token;
    },
    session({ session, token }) {
      session.apiToken = String(token.apiToken ?? '');
      session.isAdmin = Boolean(token.isAdmin);
      return session;
    },
    authorized({ auth: session, request }) {
      const publicRoute = request.nextUrl.pathname.startsWith('/signin') || request.nextUrl.pathname.startsWith('/api/auth');
      if (!publicRoute) getWebsiteAuthConfig();
      const developmentIdentity =
        process.env.NODE_ENV === 'development' && Boolean(process.env.METRICS_DEV_DEVELOPER_ID);
      return publicRoute || Boolean(session) || developmentIdentity;
    },
  },
  pages: { signIn: '/signin' },
});
