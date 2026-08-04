# Worker

NestJS BullMQ worker for background jobs.

## Local Setup

1. Copy environment values:

   ```bash
   cp .env.example .env
   ```

2. Make sure native Redis is running and reachable at the configured
   `REDIS_URL`.

   If you run the worker locally against Railway-managed PostgreSQL or Redis,
   use Railway's public connection URLs in `.env`. Railway internal hostnames
   such as `*.railway.internal` are only reachable from Railway services, not
   from a local laptop.

3. Build shared packages and start the worker:

   ```bash
   pnpm --filter @surgical/config --filter @surgical/types build
   pnpm dev:worker
   ```

The API and worker must use the same Redis namespace:

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/surgical_platform?schema=public
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_PREFIX=surgical-platform
RAZORPAY_WEBHOOK_SECRET=
WORKER_PREFLIGHT_ON_STARTUP=true
WORKER_PREFLIGHT_TIMEOUT_MS=5000
ERROR_MONITORING_ENABLED=false
ERROR_MONITORING_DSN=
```

Worker logs are emitted as JSON through the shared Nest logger surface. Keep the worker deployed separately from the API so queue processing can be restarted or scaled without interrupting HTTP traffic.

Before production startup, the worker runs a Redis and PostgreSQL preflight by default. The same readiness probe is available after build:

```bash
pnpm --filter @surgical/worker build
pnpm --filter @surgical/worker healthcheck
```

Set `WORKER_PREFLIGHT_ON_STARTUP=false` only for local debugging when Redis/PostgreSQL are intentionally unavailable.

## Queues

- `otp`: mock OTP delivery
- `notifications`: persists customer order confirmation records to `NotificationLog`
- `invoice`: mock invoice generation
- `payment-webhook`: verifies Razorpay webhook jobs and applies recorded payment/refund updates
- `low-stock-alert`: persists admin low-stock alert records to `NotificationLog`
- `near-expiry-alert`: persists admin near-expiry alert records to `NotificationLog`
