# Metrics Website

Next.js dashboard for personal, team, and collection administration metrics.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Configure the metrics API and OIDC issuer/client credentials.
3. Run `npm install` and `npm run dev`.

For local development without OIDC, configure `METRICS_DEV_DEVELOPER_ID` to match the server's explicit
development impersonation ID. `METRICS_API_KEY` is server-side only and is used for OIDC session
exchange; it is never sent to browser code or used as a personal identity.

Routes:

- `/` personal dashboard
- `/team` visible-team selector, team dashboard, and member detail navigation
- `/admin` administration overview
- `/admin/repos` repository management
- `/admin/organization` team/developer management
- `/admin/collection` durable collection runs
- `/admin/organization/sync` organization synchronization
- `/signin` organization OIDC login

## Support matrix

| Area | Supported | Boundary |
| --- | --- | --- |
| Runtime | Next.js 16, React 19, Node.js 20+ | Production build is part of the root acceptance command |
| Authentication | OIDC/PKCE session and development-only explicit identity | Production requires HTTPS OIDC, `AUTH_SECRET`, client credentials, and `keyId.secret` exchange key |
| Authorization | Server-side admin route checks plus API authorization | A client-side hidden link is never treated as authorization |
| Request states | Loading, successful empty, 401 reauthentication, 403, 5xx/network retry | Zero data is rendered only after a successful empty response |
| Responsive UI | Personal, team, repository, organization, collection, sync, and sign-in flows | Playwright covers desktop Chromium and Pixel 5 mobile layout/overlap checks |

## Deployment and tests

Set `METRICS_API_URL`, `METRICS_API_KEY`, `AUTH_SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, and
`OIDC_CLIENT_SECRET` only in the server-side deployment environment. Production startup rejects
missing, placeholder, weak, or non-HTTPS identity configuration.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Known limits:

- Playwright uses a deterministic mock API/OIDC service; real identity-provider validation remains deployment-owned.
- Organization adapter credentials and Git credentials are never configured through the browser.
- Browser coverage targets the committed Chromium desktop/mobile projects; other browser engines are not claimed.
