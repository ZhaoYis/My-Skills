# Production operations

## Startup configuration gate

The server validates production configuration before connecting to the database or listening on a
port. A failed category must be corrected in the deployment secret/configuration source; do not
work around the gate with example values.

| Category | Production requirement |
| --- | --- |
| JWT | `JWT_SECRET` is at least 32 characters and is not a placeholder; issuer and audience are explicit non-placeholder values |
| Service keys | `SERVICE_API_KEYS` contains at least one named SHA-256 hash with a narrow purpose; raw `API_KEY` is forbidden |
| Fingerprint | `FINGERPRINT_PRIVATE_KEYS` contains a valid RSA key ring with an RSA-2048 or stronger `fp1` PKCS#8 private key |
| Browser origin | Every `CORS_ORIGIN` entry is an explicit non-local HTTP(S) origin |
| Organization adapters | Feishu, LDAP, and WeCom credentials are either absent or configured as a complete set; configured values cannot be placeholders |
| Website identity | `AUTH_SECRET`, OIDC issuer/client credentials, and `METRICS_API_KEY` are present and non-placeholder |

Keep database, JWT, service, fingerprint, OIDC, and adapter credentials in the deployment secret
manager. Do not place them in an image, repository file, command history, browser variable, or log.

## Key generation

Generate values on an access-controlled workstation and send them directly to the secret manager.
Restrict temporary private-key files to the owner and securely remove them through the workstation's
approved secret-handling process after import.

```sh
# JWT/Auth.js secrets: generate separate values for each purpose.
openssl rand -base64 48

# Service key: distribute the plaintext only to its caller; configure only its SHA-256 hash here.
openssl rand -base64 48
printf '%s' '<service-key-plaintext>' | openssl dgst -sha256

# Fingerprint RSA key. Store the private key only in the metrics-server secret manager.
umask 077
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out fp1-private.pem
openssl pkey -in fp1-private.pem -pubout -out fp1-public.pem
base64 < fp1-private.pem | tr -d '\n'
```

Encode the private-key ring as JSON, for example `{"fp1":"<base64-pkcs8-pem>"}`. The matching
public key is the only fingerprint material distributed to state-file producers.

## Rotation and revocation

Use an overlap window so callers and collectors can change without downtime:

1. Add a new service key ID/hash or fingerprint key version while the old entry remains accepted.
2. Deploy consumers with the new plaintext service key, or state producers with the new public key.
3. Confirm `/api/v1/health/ready`, authentication, collection success, and fingerprint rejection
   metrics across at least one complete collection interval.
4. Remove the old service key ID after all callers have moved. For a normal fingerprint rotation,
   retain `fp1` for historical verification and add the next `fpN` key during the overlap.
5. Restart workloads to clear in-memory configuration and verify the old credential is rejected.

JWT and Auth.js use one active signing secret. Rotating either invalidates existing sessions; schedule
the deployment and require users to sign in again. Rotate an OIDC client secret by installing the new
secret at the identity provider and website in the provider's supported overlap order.

For an immediately compromised `fp1`, replace both `fp1` keypair halves rather than retaining the old
private key. Existing trusted database rows remain auditable, but old source snapshots will no longer
verify if recollected; preserve the incident evidence and use an approved historical recovery process.

## Incident recovery

1. Contain access: revoke the affected service/OIDC key, stop collection if a fingerprint key is
   exposed, and restrict the metrics endpoint to the monitoring network.
2. Preserve evidence: capture the time window, deployment revision, request IDs, collection job IDs,
   repo IDs, reason codes, and relevant audit rows. Never paste secrets or raw authorization headers.
3. Rotate affected credentials and increment affected users' token versions when authorization may
   have been exposed.
4. Validate configuration offline, deploy one instance, then require liveness and readiness to pass.
5. Run `npm run metrics:acceptance` against a restored or isolated database before resuming all
   collectors. Follow `database-operations.md` for provider-native backup restoration.
6. Reconcile collection checkpoints and retry durable jobs from the last trusted checkpoint. Investigate
   any increase in `opsx_fingerprint_rejections_total` before accepting new metrics.

## Probes

`/api/v1/health/live` checks only that the process can serve HTTP. `/api/v1/health/ready` checks the
database with `SELECT 1` and validates the fingerprint key configuration. Keep liveness independent:
a database outage must remove an instance from service without causing a restart loop.

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/live
    port: 3001
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3001
  periodSeconds: 10
  failureThreshold: 3
```

The compatibility endpoint `/api/v1/health` remains process-only. Deployment readiness automation
must use `/api/v1/health/ready`, not the compatibility endpoint.

## Metrics and alerts

Prometheus text is exposed at `/observability/metrics`. The endpoint has no application credential
because it is intended for a deployment-boundary scrape: expose it only to the monitoring network,
service mesh, or an authenticated reverse proxy. Never publish it through the public ingress.

Core series:

| Series | Use |
| --- | --- |
| `opsx_api_requests_total` | Request/error rate by method, normalized route, and status |
| `opsx_api_request_duration_seconds` | API latency histogram |
| `opsx_collection_jobs_total` | Completed/error/cancelled/timeout collection outcomes |
| `opsx_collection_success_ratio` | Process-lifetime collection success ratio |
| `opsx_fingerprint_rejections_total` | Fingerprint rejection count by stable reason code |
| `opsx_scheduler_*` | Configured/running state, last run/success/failure, duration, and outcome totals |

Recommended initial alerts should be tuned to the real collection interval and traffic baseline:

```promql
# Sustained server errors
sum(rate(opsx_api_requests_total{status_code=~"5.."}[5m])) > 0

# API p95 above one second
histogram_quantile(0.95, sum by (le) (rate(opsx_api_request_duration_seconds_bucket[10m]))) > 1

# Collection failures or timeouts
increase(opsx_collection_jobs_total{status=~"error|timeout"}[15m]) > 0

# New fingerprint rejection (route by reason_code)
increase(opsx_fingerprint_rejections_total[15m]) > 0

# Collector has not succeeded within two expected four-hour intervals
time() - opsx_scheduler_last_success_timestamp_seconds{job="collector"} > 28800
```

Structured request logs include request ID, normalized route, status, duration, principal type, and a
stable error category. Collection logs add job ID, repo ID, duration, commit/path, and rejection reason
where applicable. Search by request ID first for API incidents and by collection job ID for collector
incidents.
