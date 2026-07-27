# Metrics Website

Next.js dashboard for personal, team, and collection administration metrics.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Configure the metrics API and OIDC issuer/client credentials.
3. Run `npm install` and `npm run dev`.

For local administrator access without OIDC, set `METRICS_API_KEY` only in the server-side Next.js environment. It is never sent to browser code.

Routes:

- `/` personal dashboard
- `/team?teamId=1` team dashboard
- `/admin` repository and collection status
- `/signin` organization OIDC login
