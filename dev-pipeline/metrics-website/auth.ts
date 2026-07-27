import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: 'company-oidc',
      name: '域账号',
      type: 'oidc',
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      checks: ['pkce', 'state'],
      profile(profile) {
        return {
          id: String(profile.sub),
          name: String(profile.name ?? profile.preferred_username ?? profile.email),
          email: String(profile.email),
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.email && profile.sub) {
        const response = await fetch(`${process.env.METRICS_API_URL}/auth/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': process.env.METRICS_API_KEY ?? '' },
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
      return publicRoute || Boolean(session) || Boolean(process.env.METRICS_API_KEY);
    },
  },
  pages: { signIn: '/signin' },
});
