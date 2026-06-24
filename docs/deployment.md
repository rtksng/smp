# Deployment And Operations

This project ships five production surfaces: customer website, admin dashboard, API server, PostgreSQL, Redis, and the background worker. Do not deploy a delivery partner web app.

## Environment Variables

Use separate environment groups for local, preview, staging, and production. Never reuse local secrets in production.

API and worker:

```bash
NODE_ENV=production
API_PORT=4000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
REDIS_QUEUE_PREFIX=surgical-platform-prod
CORS_ORIGINS=https://www.example.com,https://admin.example.com
TRUST_PROXY=1
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_BLOCK_MS=60000
ERROR_MONITORING_ENABLED=false
ERROR_MONITORING_DSN=
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
BCRYPT_SALT_ROUNDS=12
OTP_TTL_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_RATE_LIMIT=5
OTP_RATE_WINDOW_SECONDS=3600
OTP_EXPOSE_IN_RESPONSE=false
RAZORPAY_KEY_ID=<production-key>
RAZORPAY_KEY_SECRET=<production-secret>
RAZORPAY_WEBHOOK_SECRET=<production-webhook-secret>
STORAGE_PROVIDER=local
STORAGE_PUBLIC_BASE_URL=https://api.example.com/uploads
```

Customer website:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_SITE_URL=https://www.example.com
NEXT_PUBLIC_APP_ENV=production
```

Admin dashboard:

```bash
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_APP_ENV=production
```

## Vercel Frontend

Create one Vercel project rooted at `apps/web`.

- Framework preset: Next.js.
- Build command: `cd ../.. && corepack pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build && corepack pnpm --filter @surgical/web build`.
- Output: Next.js default.
- Required env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_ENV`.
- Add the final website origin to API `CORS_ORIGINS`.

## Vercel Admin

Create a separate Vercel project rooted at `apps/admin`.

- Framework preset: Next.js.
- Build command: `cd ../.. && corepack pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build && corepack pnpm --filter @surgical/admin build`.
- Output: Next.js default.
- Required env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`.
- Add the final admin origin to API `CORS_ORIGINS`.

## API Server

Run the API as a long-lived Node service on a host that can reach PostgreSQL and Redis.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build
corepack pnpm --filter @surgical/api prisma:generate
corepack pnpm --filter @surgical/api exec prisma migrate deploy --schema ./prisma/schema.prisma
corepack pnpm --filter @surgical/api build
node apps/api/dist/main.js
```

Expose HTTPS through a reverse proxy/load balancer. Set `TRUST_PROXY=1` when the API is behind one proxy so audit logs and rate limiting use the client IP from forwarded headers.

Health check:

```bash
curl https://api.example.com/api/v1/health
```

## PostgreSQL

Use managed PostgreSQL for production. Enable automated daily backups, point-in-time recovery if available, and connection SSL. The API only needs one `DATABASE_URL`; run schema changes with `prisma migrate deploy`, not `migrate dev`.

Before every production migration:

- Take or confirm a fresh provider backup.
- Run `corepack pnpm --filter @surgical/api prisma:validate`.
- Review the generated SQL in `apps/api/prisma/migrations`.
- Apply during a quiet operational window for table/index-heavy migrations.

## Redis

Use managed Redis with persistence enabled when available. API and worker must share the same `REDIS_URL` and `REDIS_QUEUE_PREFIX`. Redis is used for queues, OTP state, sessions/caches, and API rate limiting.

## Worker

Run the worker as a separate long-lived Node process after the same build step as the API.

```bash
corepack pnpm --filter @surgical/worker build
node apps/worker/dist/main.js
```

The worker should run at least one instance in production. Scale horizontally only after confirming job idempotency for the affected queue.

## Backups And Migration Notes

- PostgreSQL is the source of truth; keep daily automated backups and test restores periodically.
- Store backup retention and restore-owner details outside the codebase in the deployment runbook.
- Redis queue data is operational state; use Redis persistence and dead-letter/failed-job review before purging.
- Apply Prisma migrations with `prisma migrate deploy` from the release artifact.
- Never edit an applied migration. Add a new migration instead.
- Keep API and worker on compatible versions during deploys because queue names live in `packages/config` and payload versions live in `packages/types`.

## Security Checklist

- `CORS_ORIGINS` contains exact HTTPS origins only; no wildcards.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are long, random, and different.
- Razorpay secrets are production keys in production and not logged.
- `ERROR_MONITORING_DSN` is configured when a monitoring provider is selected.
- API runs behind HTTPS and sets Helmet security headers.
- `RATE_LIMIT_*` values are set and Redis is reachable before opening public traffic.
- Admin routes require JWT and permission guards.
- Warehouse and inventory routes enforce warehouse access in the backend.
- `.env` files are not committed.
- Database backups and restore testing are scheduled.

## Warehouse Operations Checklist

- Create warehouses before receiving stock.
- Assign non-super-admin warehouse staff before expecting scoped access.
- Prefer deactivate over delete; delete is blocked when inventory, batches, or movements exist.
- Use stock-in for new receipts and signed adjustment for corrections.
- Use transfer for warehouse-to-warehouse movement so paired stock movements share a reference.
- Review low-stock and near-expiry queues daily.
- Audit `AdminAuditLog` and `StockMovement` during stock discrepancy investigations.
