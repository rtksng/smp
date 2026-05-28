# Worker

NestJS BullMQ worker for background jobs.

## Local Setup

1. Copy environment values:

   ```bash
   cp .env.example .env
   ```

2. Start Redis from the repository root:

   ```bash
   docker compose --env-file .env -f infra/docker/docker-compose.yml up -d redis
   ```

3. Build shared packages and start the worker:

   ```bash
   pnpm --filter @surgical/config --filter @surgical/types build
   pnpm dev:worker
   ```

The API and worker must use the same Redis namespace:

```bash
NODE_ENV=development
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_PREFIX=surgical-platform
ERROR_MONITORING_ENABLED=false
ERROR_MONITORING_DSN=
```

Worker logs are emitted as JSON through the shared Nest logger surface. Keep the worker deployed separately from the API so queue processing can be restarted or scaled without interrupting HTTP traffic.

## Queues

- `otp`: mock OTP delivery
- `notifications`: mock order confirmation delivery
- `invoice`: mock invoice generation
- `payment-webhook`: Razorpay webhook follow-up processing
- `low-stock-alert`: mock low-stock alert delivery
- `near-expiry-alert`: mock near-expiry alert delivery
