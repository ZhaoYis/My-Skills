import 'next-auth';

declare module 'next-auth' {
  interface Session {
    apiToken: string;
    isAdmin: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    apiToken?: string;
    isAdmin?: boolean;
  }
}
