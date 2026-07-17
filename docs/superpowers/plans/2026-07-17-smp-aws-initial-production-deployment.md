# SMP AWS Initial Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the customer web app, admin web app, API, and worker to AWS-generated HTTPS endpoints while preserving the existing RDS data and all 255 protected catalog objects.

**Architecture:** Build four immutable containers locally, store them in ECR, and run them on the two existing EC2 instances under systemd and SSM management. CloudFront terminates viewer HTTPS and routes to Nginx origins; the existing RDS, Valkey, catalog bucket, and catalog CloudFront distribution remain outside CloudFormation, while CDK owns only new deployment resources.

**Tech Stack:** Node.js 22, pnpm 9.15.4, Next.js 16, NestJS 10, Prisma 7, BullMQ, Docker, Nginx, AWS CDK 2.261.0, CloudFormation, ECR, EC2, SSM, Secrets Manager, S3, CloudFront, CloudWatch, PowerShell, Bash.

## Global Constraints

- AWS account is exactly `651863679421`; region is exactly `ap-south-1`.
- Root may create only the initial least-privilege IAM operator and bootstrap
  roles. Every later AWS command uses profile `smp-deployer`, whose source
  profile is the assume-role-only user `smp-deployment-source`, never `default`.
- Do not execute Prisma migrations, seed commands, schema-changing SQL, or data-repair scripts.
- Preserve RDS instance `smp-prod-db`; create and wait for a manual snapshot before workload changes.
- Preserve bucket `smp-prod-images-651863679421-ap-south-1-an` exactly.
- Protected S3 baseline is 255 objects, 5,298,735 bytes, SHA-256 `dfe52fa9d86c710b9fefd0511d971d5389ca677d41ac6dd387fc0f6df651da23`.
- Do not grant write, delete, tagging, ACL, retention, or bucket-configuration permissions on the protected catalog bucket.
- Existing catalog CDN is `https://d268wazo8qmwud.cloudfront.net`.
- New uploads use a separate versioned bucket and CloudFront distribution.
- API and Worker use the EC2 instance role and AWS SDK default credential chain; never deploy static AWS access keys.
- Secrets are resolved through `asm-exec`; never call `secretsmanager get-secret-value` or `batch-get-secret-value`.
- Build public Next.js URLs only after CDK outputs the AWS-generated CloudFront hostnames.
- Worker remains stopped until the read-only queue inspection reports no unsafe queued work.
- Keep both EC2 instances at `t3.micro` initially; resize only after monitored evidence and explicit approval.
- Do not add Fargate, ALB, NAT Gateway, Route 53, ACM, or a managed CI/CD pipeline in this initial phase.
- Preserve the untracked root `AGENTS.md`; do not stage it with implementation commits unless the user separately requests it.

---

## File Map

### Application runtime changes

- Modify `apps/api/src/config/api.config.ts`: permit role-based S3 authentication while rejecting partial static credentials.
- Create `apps/api/src/queues/redis-connection.ts`: shared TLS-aware BullMQ Redis option parser.
- Modify `apps/api/src/queues/api-queues.module.ts`: consume the shared parser.
- Create `apps/api/test/queues/redis-connection.test.ts`: verify `redis://` and `rediss://` behavior.
- Modify `apps/api/test/config/api.config.test.ts`: verify role-based S3 production configuration.
- Modify `apps/worker/src/config/redis.ts`: preserve TLS for `rediss://`.
- Create `apps/worker/src/queue-inspection.ts`: read BullMQ state counts without starting processors.
- Create `apps/worker/src/queue-status.ts`: safe queue-inspection CLI.
- Create `apps/worker/test/redis.test.ts`: verify TLS-aware worker Redis options.
- Create `apps/worker/test/queue-inspection.test.ts`: verify queue keys, counts, and unsafe-work result.
- Modify `apps/worker/package.json`: add `queue-status`.
- Modify `apps/web/next.config.mjs`: standalone output and correct environment-driven catalog CDN.
- Modify `apps/admin/next.config.mjs`: standalone output and correct environment-driven catalog CDN.
- Modify `apps/web/lib/api/client.ts`: proxy CloudFront API traffic through the
  customer app origin.
- Modify `apps/web/lib/api/client.test.ts`: verify CloudFront proxy selection.
- Modify `apps/admin/lib/admin-api.ts`: proxy CloudFront API traffic through the
  admin app origin.
- Modify `apps/admin/lib/admin-api.test.ts`: verify CloudFront proxy selection.
- Create `scripts/aws-next-config.test.mjs`: verify both production Next.js configurations.

### Container packaging

- Create `.dockerignore`: exclude secrets, caches, Android output, and local artifacts.
- Create `apps/api/Dockerfile`: production API image.
- Create `apps/worker/Dockerfile`: production Worker image.
- Create `apps/web/Dockerfile`: standalone customer image.
- Create `apps/admin/Dockerfile`: standalone admin image.
- Create `scripts/aws-container-contract.test.mjs`: statically enforce image safety invariants.

### AWS infrastructure

- Modify `pnpm-workspace.yaml`: include `infra/aws`.
- Modify `package.json`: add AWS plan/build/synth convenience scripts.
- Create `infra/aws/package.json`: CDK package and scripts.
- Create `infra/aws/tsconfig.json`: strict TypeScript config.
- Create `infra/aws/cdk.json`: CDK app command and context.
- Create `infra/aws/bin/smp-aws.ts`: CDK entry point with CLI credential synthesizer.
- Create `infra/aws/lib/constants.ts`: approved existing resource identifiers.
- Create `infra/aws/lib/storage.ts`: ECR, secret container, uploads bucket, OAC, and upload CDN.
- Create `infra/aws/lib/compute-edge.ts`: EIPs, runtime role/profile, security groups, and app CDNs.
- Create `infra/aws/lib/observability.ts`: log groups, dashboard, and alarms.
- Create `infra/aws/lib/smp-platform-stack.ts`: compose constructs and emit deployment outputs.
- Create `infra/aws/test/smp-platform-stack.test.ts`: CDK assertions and protected-resource negative checks.

### IAM, safety, deployment, and runtime automation

- Create `infra/aws/iam/deployment-role-trust.json`.
- Create `infra/aws/iam/deployment-role-policy.json`.
- Create `infra/aws/iam/deployment-operator-policy.json`.
- Create `infra/aws/scripts/bootstrap-deployment-role.ps1`.
- Create `infra/aws/scripts/configure-deployment-profile.ps1`.
- Create `infra/aws/scripts/import-secrets.ps1`.
- Create `infra/aws/scripts/build-and-push.ps1`.
- Create `infra/aws/scripts/bootstrap-instances.ps1`.
- Create `infra/aws/scripts/deploy-services.ps1`.
- Create `infra/aws/scripts/rollback-services.ps1`.
- Create `infra/aws/scripts/verify-deployment.ps1`.
- Create `infra/aws/runtime/nginx/smp.conf`.
- Create `infra/aws/runtime/systemd/smp-api.service`.
- Create `infra/aws/runtime/systemd/smp-worker.service`.
- Create `infra/aws/runtime/systemd/smp-web.service`.
- Create `infra/aws/runtime/systemd/smp-admin.service`.
- Create `infra/aws/runtime/cloudwatch-agent.json`.
- Create `infra/aws/runtime/configure-host.sh`.
- Create `scripts/aws-protected-assets.mjs`.
- Create `scripts/aws-protected-assets.test.mjs`.
- Create `scripts/aws-deployment-contract.test.mjs`.
- Create `docs/deployment-aws.md`.
- Modify `docs/deployment.md`: link the AWS runbook and explicitly prohibit deployment migrations.

---

### Task 1: Make API S3 Authentication Compatible with EC2 Roles

**Files:**
- Modify: `apps/api/src/config/api.config.ts`
- Modify: `apps/api/test/config/api.config.test.ts`

**Interfaces:**
- Consumes: Existing `S3StorageProvider` behavior, which already omits explicit credentials when both credential fields are absent.
- Produces: `loadApiEnvironment()` accepts either no static S3 credentials or a complete access-key pair; partial pairs fail.

- [ ] **Step 1: Add a failing role-credentials production test**

Add this test to `apps/api/test/config/api.config.test.ts`:

```ts
test("loadApiEnvironment allows the AWS default credential chain in production", () => {
  setProductionApiEnv({
    S3_ACCESS_KEY_ID: undefined,
    S3_SECRET_ACCESS_KEY: undefined
  });

  const environment = loadApiEnvironment();

  assert.equal(environment.s3AccessKeyId, undefined);
  assert.equal(environment.s3SecretAccessKey, undefined);
});

test("loadApiEnvironment rejects a partial static S3 credential pair", () => {
  setProductionApiEnv({
    S3_ACCESS_KEY_ID: "only-access-key",
    S3_SECRET_ACCESS_KEY: undefined
  });

  assert.throws(
    () => loadApiEnvironment(),
    /S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be provided together/
  );
});
```

- [ ] **Step 2: Run the focused API configuration tests**

Run:

```powershell
corepack pnpm --filter @surgical/api test -- test/config/api.config.test.ts
```

Expected: the default-credential-chain test fails because production currently requires `S3_ACCESS_KEY_ID`.

- [ ] **Step 3: Replace static-key requirements with pair validation**

In `validateS3Environment`, replace the two independent key requirements with:

```ts
const hasAccessKey = Boolean(environment.s3AccessKeyId);
const hasSecretKey = Boolean(environment.s3SecretAccessKey);

if (hasAccessKey !== hasSecretKey) {
  throw new Error(
    "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be provided together."
  );
}
```

Keep bucket and region validation unchanged.

- [ ] **Step 4: Run the focused and full API tests**

Run:

```powershell
corepack pnpm --filter @surgical/api test
```

Expected: all API tests pass.

- [ ] **Step 5: Commit the role-based S3 authentication change**

```powershell
git add apps/api/src/config/api.config.ts apps/api/test/config/api.config.test.ts
git commit -m "fix(api): support instance role S3 credentials"
```

---

### Task 2: Preserve TLS in API and Worker Valkey Connections

**Files:**
- Create: `apps/api/src/queues/redis-connection.ts`
- Modify: `apps/api/src/queues/api-queues.module.ts`
- Create: `apps/api/test/queues/redis-connection.test.ts`
- Modify: `apps/worker/src/config/redis.ts`
- Create: `apps/worker/test/redis.test.ts`

**Interfaces:**
- Produces: `createApiRedisConnection(redisUrl, fallbackEnv): RedisOptions`.
- Produces: `createRedisConnectionOptions(env): RedisOptions` with `tls: {}` for `rediss://`.
- Consumes: `ApiQueuesModule` and Worker readiness/Worker module Redis configuration.

- [ ] **Step 1: Write failing API and Worker TLS tests**

Create `apps/api/test/queues/redis-connection.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiRedisConnection } from "../../src/queues/redis-connection";

test("createApiRedisConnection enables TLS for rediss URLs", () => {
  const options = createApiRedisConnection(
    "rediss://default:secret@cache.example.com:6379/2",
    {}
  );

  assert.equal(options.host, "cache.example.com");
  assert.equal(options.port, 6379);
  assert.equal(options.db, 2);
  assert.deepEqual(options.tls, {});
});

test("createApiRedisConnection does not enable TLS for redis URLs", () => {
  const options = createApiRedisConnection(
    "redis://cache.example.com:6379",
    {}
  );

  assert.equal(options.tls, undefined);
});
```

Create `apps/worker/test/redis.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRedisConnectionOptions } from "../src/config/redis";

test("worker Redis options preserve rediss TLS", () => {
  const options = createRedisConnectionOptions({
    REDIS_URL: "rediss://default:secret@cache.example.com:6379/0"
  });

  assert.equal(options.host, "cache.example.com");
  assert.deepEqual(options.tls, {});
});
```

- [ ] **Step 2: Run the two focused test files**

Run:

```powershell
corepack pnpm --filter @surgical/api test
corepack pnpm --filter @surgical/worker test
```

Expected: API import fails because `redis-connection.ts` does not exist; Worker TLS assertion fails.

- [ ] **Step 3: Create the shared API parser**

Create `apps/api/src/queues/redis-connection.ts`:

```ts
import type { RedisOptions } from "ioredis";

export function createApiRedisConnection(
  redisUrl: string | undefined,
  env: Record<string, string | undefined> = process.env
): RedisOptions {
  if (redisUrl) {
    const parsedUrl = new URL(redisUrl);
    const database = parsedUrl.pathname.replace("/", "");

    return {
      db: database ? Number(database) : undefined,
      host: parsedUrl.hostname,
      maxRetriesPerRequest: null,
      password: parsedUrl.password
        ? decodeURIComponent(parsedUrl.password)
        : undefined,
      port: Number(parsedUrl.port || 6379),
      tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
      username: parsedUrl.username
        ? decodeURIComponent(parsedUrl.username)
        : undefined
    };
  }

  const redisPassword = env.REDIS_PASSWORD;

  return {
    host: env.REDIS_HOST ?? "localhost",
    maxRetriesPerRequest: null,
    password:
      redisPassword && redisPassword.length > 0 ? redisPassword : undefined,
    port: Number(env.REDIS_PORT ?? 6379)
  };
}
```

In `apps/api/src/queues/api-queues.module.ts`, delete the local parser, import
`createApiRedisConnection`, and call:

```ts
connection: createApiRedisConnection(
  configService.get<string>("redisUrl") ?? process.env.REDIS_URL
)
```

- [ ] **Step 4: Add Worker TLS preservation**

In `apps/worker/src/config/redis.ts`, add this property to the URL-derived return value:

```ts
tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
```

- [ ] **Step 5: Run API and Worker tests**

```powershell
corepack pnpm --filter @surgical/api test
corepack pnpm --filter @surgical/worker test
```

Expected: all API and Worker tests pass.

- [ ] **Step 6: Commit the Valkey TLS fix**

```powershell
git add apps/api/src/queues apps/api/test/queues apps/worker/src/config/redis.ts apps/worker/test/redis.test.ts
git commit -m "fix: preserve TLS for managed Valkey connections"
```

---

### Task 3: Add a Read-Only Worker Queue Safety Command

**Files:**
- Create: `apps/worker/src/queue-inspection.ts`
- Create: `apps/worker/src/queue-status.ts`
- Create: `apps/worker/test/queue-inspection.test.ts`
- Modify: `apps/worker/package.json`

**Interfaces:**
- Produces: `inspectQueueState(redis, prefix): Promise<QueueInspectionResult>`.
- Produces: `queue-status --require-empty`, exit `0` when safe and `2` when queued work exists.
- Consumes: `QUEUE_NAMES`, `REDIS_QUEUE_PREFIX`, and TLS-aware Worker Redis options.

- [ ] **Step 1: Write a failing queue-inspection unit test**

Create `apps/worker/test/queue-inspection.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectQueueState } from "../src/queue-inspection";

test("inspectQueueState reports read-only BullMQ state counts", async () => {
  const values = new Map([
    ["surgical-platform:otp:wait", 2],
    ["surgical-platform:otp:active", 1],
    ["surgical-platform:otp:paused", 0],
    ["surgical-platform:otp:delayed", 3],
    ["surgical-platform:otp:failed", 4],
    ["surgical-platform:otp:prioritized", 0]
  ]);
  const redis = {
    llen: async (key: string) => values.get(key) ?? 0,
    zcard: async (key: string) => values.get(key) ?? 0
  };

  const result = await inspectQueueState(redis, "surgical-platform");

  assert.equal(result.safeToStart, false);
  assert.equal(result.totals.actionable, 6);
  assert.equal(result.totals.failed, 4);
});
```

- [ ] **Step 2: Run Worker tests and confirm the import failure**

```powershell
corepack pnpm --filter @surgical/worker test
```

Expected: FAIL because `queue-inspection.ts` does not exist.

- [ ] **Step 3: Implement the pure read-only inspector**

Create `apps/worker/src/queue-inspection.ts`:

```ts
import { QUEUE_NAMES } from "@surgical/config";

type RedisCounter = {
  llen(key: string): Promise<number>;
  zcard(key: string): Promise<number>;
};

export type QueueInspectionResult = {
  queues: Record<string, Record<string, number>>;
  safeToStart: boolean;
  totals: {
    actionable: number;
    failed: number;
  };
};

export async function inspectQueueState(
  redis: RedisCounter,
  prefix: string
): Promise<QueueInspectionResult> {
  const queues: Record<string, Record<string, number>> = {};
  let actionable = 0;
  let failed = 0;

  for (const queueName of Object.values(QUEUE_NAMES)) {
    const base = `${prefix}:${queueName}`;
    const counts = {
      active: await redis.llen(`${base}:active`),
      delayed: await redis.zcard(`${base}:delayed`),
      failed: await redis.zcard(`${base}:failed`),
      paused: await redis.llen(`${base}:paused`),
      prioritized: await redis.zcard(`${base}:prioritized`),
      waiting: await redis.llen(`${base}:wait`)
    };

    queues[queueName] = counts;
    actionable +=
      counts.active +
      counts.delayed +
      counts.paused +
      counts.prioritized +
      counts.waiting;
    failed += counts.failed;
  }

  return {
    queues,
    safeToStart: actionable === 0,
    totals: { actionable, failed }
  };
}
```

- [ ] **Step 4: Implement the CLI without starting BullMQ processors**

Create `apps/worker/src/queue-status.ts`:

```ts
import Redis from "ioredis";
import { createRedisConnectionOptions } from "./config/redis";
import { inspectQueueState } from "./queue-inspection";

async function main() {
  const redis = new Redis({
    ...createRedisConnectionOptions(),
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });

  try {
    await redis.connect();
    const result = await inspectQueueState(
      redis,
      process.env.REDIS_QUEUE_PREFIX ?? "surgical-platform"
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);

    if (process.argv.includes("--require-empty") && !result.safeToStart) {
      process.exitCode = 2;
    }
  } finally {
    redis.disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      status: "error"
    })}\n`
  );
  process.exitCode = 1;
});
```

Add to `apps/worker/package.json`:

```json
"queue-status": "node dist/queue-status.js"
```

- [ ] **Step 5: Run Worker test, typecheck, and build**

```powershell
corepack pnpm --filter @surgical/worker test
corepack pnpm --filter @surgical/worker typecheck
corepack pnpm --filter @surgical/worker build
```

Expected: all commands pass and `apps/worker/dist/queue-status.js` exists.

- [ ] **Step 6: Commit the Worker safety command**

```powershell
git add apps/worker/src/queue-inspection.ts apps/worker/src/queue-status.ts apps/worker/test/queue-inspection.test.ts apps/worker/package.json
git commit -m "feat(worker): add read-only queue safety check"
```

---

### Task 4: Configure Next.js Standalone Production Output

**Files:**
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/admin/next.config.mjs`
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/web/lib/api/client.test.ts`
- Modify: `apps/admin/lib/admin-api.ts`
- Modify: `apps/admin/lib/admin-api.test.ts`
- Create: `scripts/aws-next-config.test.mjs`

**Interfaces:**
- Produces standalone Next.js output rooted at the monorepo.
- Consumes `NEXT_PUBLIC_CATALOG_PUBLIC_URL`, `NEXT_PUBLIC_STORAGE_PUBLIC_URL`, and `NEXT_PUBLIC_API_URL`.
- Produces same-origin browser API calls for AWS CloudFront API hostnames so
  secure customer refresh cookies remain first-party.

- [ ] **Step 1: Write a failing production-config test**

Create `scripts/aws-next-config.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

async function loadConfig(path) {
  process.env.NEXT_PUBLIC_CATALOG_PUBLIC_URL =
    "https://d268wazo8qmwud.cloudfront.net";
  process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL =
    "https://uploads.example.cloudfront.net";
  return (await import(`${pathToFileURL(path)}?test=${Date.now()}`)).default;
}

for (const app of ["web", "admin"]) {
  test(`${app} uses standalone output and configured catalog CDN`, async () => {
    const config = await loadConfig(`apps/${app}/next.config.mjs`);
    const hosts = config.images.remotePatterns.map((pattern) => pattern.hostname);

    assert.equal(config.output, "standalone");
    assert.match(config.outputFileTracingRoot, /smp$/i);
    assert.ok(hosts.includes("d268wazo8qmwud.cloudfront.net"));
    assert.ok(!hosts.includes("d268wazo8qmwd.cloudfront.net"));
  });
}
```

- [ ] **Step 2: Run the root script tests**

```powershell
node --test scripts/aws-next-config.test.mjs
```

Expected: FAIL because `output` is undefined and the incorrect catalog hostname is present.

- [ ] **Step 3: Update both Next.js configs**

At the top of both files add:

```js
import { fileURLToPath } from "node:url";
```

Create the catalog pattern:

```js
const catalogRemotePattern = remotePatternFromUrl(
  process.env.NEXT_PUBLIC_CATALOG_PUBLIC_URL ??
    "https://d268wazo8qmwud.cloudfront.net"
);
```

Replace the hard-coded catalog object with `catalogRemotePattern`, and add:

```js
output: "standalone",
outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
```

- [ ] **Step 4: Add CloudFront to the explicit browser-proxy allowlist**

In both `apps/web/lib/api/client.ts` and `apps/admin/lib/admin-api.ts`, change:

```ts
const BROWSER_PROXY_HOST_SUFFIXES = [".up.railway.app"];
```

to:

```ts
const BROWSER_PROXY_HOST_SUFFIXES = [".cloudfront.net", ".up.railway.app"];
```

Add this assertion to the existing API client test in each app, using that
app's URL builder:

```ts
it("routes browser calls for CloudFront API hosts through the same-origin proxy", () => {
  process.env.NEXT_PUBLIC_API_URL =
    "https://d111111abcdef8.cloudfront.net/api/v1";

  const url = buildApiUrl("/health/live");

  expect(url.toString()).toBe(
    `${window.location.origin}/api/v1/health/live`
  );
});
```

Use `buildAdminApiUrl` in the Admin test. This is intentionally limited to API
URLs and does not rewrite catalog or upload CDN URLs.

- [ ] **Step 5: Run config tests and both application builds**

```powershell
node --test scripts/aws-next-config.test.mjs
corepack pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build
corepack pnpm --filter @surgical/web test
corepack pnpm --filter @surgical/admin test
corepack pnpm --filter @surgical/web build
corepack pnpm --filter @surgical/admin build
```

Expected: test and both builds pass; each app produces `.next/standalone`.

- [ ] **Step 6: Commit standalone configuration and CloudFront proxy support**

```powershell
git add apps/web/next.config.mjs apps/admin/next.config.mjs apps/web/lib/api/client.ts apps/web/lib/api/client.test.ts apps/admin/lib/admin-api.ts apps/admin/lib/admin-api.test.ts scripts/aws-next-config.test.mjs
git commit -m "build: prepare Next.js apps for AWS origins"
```

---

### Task 5: Add Production Container Packaging

**Files:**
- Create: `.dockerignore`
- Create: `apps/api/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/admin/Dockerfile`
- Create: `scripts/aws-container-contract.test.mjs`

**Interfaces:**
- Produces four Linux/amd64 images that run ports 4000, 3000, 3001, and a non-listening worker.
- Consumes the pnpm lockfile and standalone Next.js output.

- [ ] **Step 1: Write the container safety contract test**

Create `scripts/aws-container-contract.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const dockerfiles = [
  "apps/api/Dockerfile",
  "apps/worker/Dockerfile",
  "apps/web/Dockerfile",
  "apps/admin/Dockerfile"
];

test("production images are Node 22 multi-stage builds without migration commands", async () => {
  for (const path of dockerfiles) {
    const content = await readFile(path, "utf8");
    assert.match(content, /FROM node:22-bookworm-slim AS builder/);
    assert.match(content, /USER node/);
    assert.doesNotMatch(content, /migrate|seed:aws|prisma\/seed/i);
    assert.doesNotMatch(content, /COPY .*\.env/i);
  }
});

test("docker context excludes all runtime secrets", async () => {
  const content = await readFile(".dockerignore", "utf8");
  assert.match(content, /^\*\*\/\.env\*$/m);
  assert.match(content, /^\.env\*$/m);
});
```

- [ ] **Step 2: Run the contract and confirm files are missing**

```powershell
node --test scripts/aws-container-contract.test.mjs
```

Expected: FAIL with an `ENOENT` for the first Dockerfile.

- [ ] **Step 3: Create the shared Docker ignore policy**

Create `.dockerignore`:

```dockerignore
.git
.github
.codex
.vercel
.env*
**/.env*
**/node_modules
**/.next
**/dist
**/coverage
**/*.log
apps/delivery/android
apps/delivery/.gradle
apps/delivery/**/build
storage/uploads
tmp
```

- [ ] **Step 4: Create API and Worker Dockerfiles**

Use this structure in `apps/api/Dockerfile`, with the final command shown:

```dockerfile
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build
RUN pnpm --filter @surgical/api prisma:generate
RUN pnpm --filter @surgical/api build
RUN pnpm --filter @surgical/api deploy --prod /out

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out/ ./
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

Use the same structure in `apps/worker/Dockerfile`, replacing API commands with:

```dockerfile
RUN pnpm --filter @surgical/worker build
RUN pnpm --filter @surgical/worker deploy --prod /out
```

and use:

```dockerfile
HEALTHCHECK --interval=60s --timeout=10s --retries=3 CMD ["node", "dist/healthcheck.js"]
CMD ["node", "dist/main.js"]
```

- [ ] **Step 5: Create customer and admin standalone Dockerfiles**

Use this complete pattern for `apps/web/Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_ENV=production
ARG NEXT_PUBLIC_CATALOG_PUBLIC_URL
ARG NEXT_PUBLIC_STORAGE_PUBLIC_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_CATALOG_PUBLIC_URL=$NEXT_PUBLIC_CATALOG_PUBLIC_URL
ENV NEXT_PUBLIC_STORAGE_PUBLIC_URL=$NEXT_PUBLIC_STORAGE_PUBLIC_URL
RUN pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build
RUN pnpm --filter @surgical/web build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /workspace/apps/web/.next/standalone/ ./
COPY --from=builder --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /workspace/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

Create `apps/admin/Dockerfile` with the same pattern, replacing `web` with
`admin`, using `PORT=3001`, and omitting `NEXT_PUBLIC_SITE_URL`. Do not add the
`public` copy line because `apps/admin/public` does not exist; copy only the
Admin standalone tree and `.next/static`.

- [ ] **Step 6: Run container contract and build all images**

```powershell
node --test scripts/aws-container-contract.test.mjs
docker build -f apps/api/Dockerfile -t smp-api:plan .
docker build -f apps/worker/Dockerfile -t smp-worker:plan .
docker build -f apps/web/Dockerfile -t smp-web:plan --build-arg NEXT_PUBLIC_API_URL=https://api.invalid/api/v1 --build-arg NEXT_PUBLIC_SITE_URL=https://customer.invalid --build-arg NEXT_PUBLIC_CATALOG_PUBLIC_URL=https://d268wazo8qmwud.cloudfront.net --build-arg NEXT_PUBLIC_STORAGE_PUBLIC_URL=https://uploads.invalid .
docker build -f apps/admin/Dockerfile -t smp-admin:plan --build-arg NEXT_PUBLIC_API_URL=https://api.invalid/api/v1 --build-arg NEXT_PUBLIC_CATALOG_PUBLIC_URL=https://d268wazo8qmwud.cloudfront.net --build-arg NEXT_PUBLIC_STORAGE_PUBLIC_URL=https://uploads.invalid .
```

Expected: all four builds complete successfully.

- [ ] **Step 7: Smoke-test image entry points locally**

```powershell
docker run --rm --entrypoint node smp-worker:plan --check dist/queue-status.js
docker image inspect smp-api:plan smp-worker:plan smp-web:plan smp-admin:plan --format '{{.RepoTags}}'
```

Expected: the Worker CLI passes syntax validation without connecting to Redis;
all four tags are listed.

- [ ] **Step 8: Commit container packaging**

```powershell
git add .dockerignore apps/*/Dockerfile scripts/aws-container-contract.test.mjs
git commit -m "build: add AWS production containers"
```

---

### Task 6: Create the CDK Infrastructure Package

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `infra/aws/package.json`
- Create: `infra/aws/tsconfig.json`
- Create: `infra/aws/cdk.json`
- Create: `infra/aws/bin/smp-aws.ts`
- Create: `infra/aws/lib/constants.ts`
- Create: `infra/aws/lib/storage.ts`
- Create: `infra/aws/lib/compute-edge.ts`
- Create: `infra/aws/lib/observability.ts`
- Create: `infra/aws/lib/smp-platform-stack.ts`
- Create: `infra/aws/test/smp-platform-stack.test.ts`

**Interfaces:**
- Produces stack `SmpInitialPlatform`.
- Produces CloudFormation outputs consumed by build/deployment scripts.
- References existing resources by approved physical identifiers without importing ownership.

- [ ] **Step 1: Add the workspace package and failing CDK test**

Append `infra/aws` to `pnpm-workspace.yaml`.

Create `infra/aws/package.json`:

```json
{
  "name": "@surgical/aws-infra",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "cdk": "cdk",
    "lint": "eslint .",
    "synth": "cdk synth --strict",
    "test": "tsx --test test/*.test.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "aws-cdk-lib": "2.261.0",
    "constructs": "10.7.0"
  },
  "devDependencies": {
    "aws-cdk": "2.1132.0",
    "tsx": "4.22.3",
    "typescript": "^5.6.0"
  }
}
```

Create a CDK assertion test that expects:

```ts
template.resourceCountIs("AWS::ECR::Repository", 4);
template.resourceCountIs("AWS::S3::Bucket", 1);
template.resourceCountIs("AWS::CloudFront::Distribution", 4);
template.resourceCountIs("AWS::SecretsManager::Secret", 1);
template.resourceCountIs("AWS::EC2::EIP", 2);
```

Also assert the synthesized template does not contain
`smp-prod-images-651863679421-ap-south-1-an` in an `AWS::S3::Bucket` resource
and does not contain an `AWS::RDS::DBInstance`.

- [ ] **Step 2: Install and run the failing infrastructure test**

```powershell
corepack pnpm install --frozen-lockfile=false
corepack pnpm --filter @surgical/aws-infra test
```

Expected: FAIL because the CDK entry point and stack do not exist.

- [ ] **Step 3: Add fixed existing-resource constants**

Create `infra/aws/lib/constants.ts`:

```ts
export const EXISTING = {
  account: "651863679421",
  apiInstanceId: "i-05f03e840bc11f2bc",
  appInstanceId: "i-063654e8ed1eaeeff",
  catalogBucket: "smp-prod-images-651863679421-ap-south-1-an",
  catalogDistributionDomain: "d268wazo8qmwud.cloudfront.net",
  catalogDistributionId: "E22GF2CVEGEXOJ",
  databaseId: "smp-prod-db",
  databaseAndCacheSecurityGroupId: "sg-046aebfbed5a94a7c",
  region: "ap-south-1",
  redisClusterId: "smp-redis-001",
  vpcId: "vpc-06a5a2bb440afcbc2"
} as const;

export const APP_NAMES = ["api", "worker", "web", "admin"] as const;
export type AppName = (typeof APP_NAMES)[number];
```

- [ ] **Step 4: Implement storage and registry resources**

In `infra/aws/lib/storage.ts`, export:

```ts
export type StorageResources = {
  appSecret: secretsmanager.Secret;
  repositories: Record<AppName, ecr.Repository>;
  uploadsBucket: s3.Bucket;
  uploadsDistribution: cloudfront.Distribution;
};
```

Create:

- Four `smp-api`, `smp-worker`, `smp-web`, and `smp-admin` ECR repositories.
- `imageScanOnPush: true`, immutable tags, retained repositories, and a
  lifecycle rule retaining the newest ten images.
- One retained, encrypted, versioned uploads bucket with Block Public Access.
- One OAC-backed CloudFront distribution for uploads.
- One retained secret named `smp/production/application`.

Grant no permissions on the protected catalog bucket.

- [ ] **Step 5: Implement compute-edge resources**

In `infra/aws/lib/compute-edge.ts`, create:

- Two VPC Elastic IPs and `CfnEIPAssociation` resources for the two existing
  instance IDs.
- Runtime role and instance profile.
- Two `CfnInstanceProfileAssociation` resources.
- An origin security group in the existing VPC.
- Database port 5432 and Valkey port 6379 ingress from the runtime/origin
  security group to `sg-046aebfbed5a94a7c`.
- Customer, admin, and API CloudFront distributions.
- Viewer HTTPS redirect, HTTP-only port 80 custom origins, and disabled caching
  for the three dynamic application distributions.
- The managed `AllViewerExceptHostHeader` origin request policy for the API
  distribution so query strings, cookies, and authorization headers reach the
  API while the CloudFront hostname is not forwarded as the origin host.
- Port 80 ingress on the origin security group only from the AWS-managed
  `com.amazonaws.global.cloudfront.origin-facing` prefix list.

Derive each EIP public hostname through CloudFormation expressions:

```ts
const publicDns = cdk.Fn.join("", [
  "ec2-",
  cdk.Fn.join("-", cdk.Fn.split(".", elasticIp.ref)),
  ".ap-south-1.compute.amazonaws.com"
]);
```

Set fixed custom origin headers:

```ts
customHeaders: {
  "X-SMP-Origin-App": "customer"
}
```

Use `admin` and `api` for the other distributions. Do not place secret values
in custom headers.

- [ ] **Step 6: Implement runtime permissions and observability**

Grant the runtime role:

- ECR pull access.
- Read access to `smp/production/application`.
- `s3:PutObject` only on the new upload bucket objects.
- CloudWatch agent and SSM managed-instance permissions.

Do not grant `s3:DeleteObject`.

In `observability.ts`, create retained log groups with 14-day retention, a
dashboard, EC2 status/CPU alarms, and custom memory/disk alarms keyed by
instance ID.

- [ ] **Step 7: Compose the stack and exact outputs**

`SmpPlatformStack` must output:

```ts
ApiDistributionDomainName
ApiDistributionId
CustomerDistributionDomainName
CustomerDistributionId
AdminDistributionDomainName
AdminDistributionId
UploadsDistributionDomainName
UploadsDistributionId
UploadsBucketName
ApplicationSecretArn
ApiElasticIp
AppElasticIp
RuntimeInstanceProfileName
OriginSecurityGroupId
```

Use `CliCredentialsStackSynthesizer` in `bin/smp-aws.ts` so this no-asset stack
does not require broad CDK bootstrap roles.

- [ ] **Step 8: Run CDK tests, typecheck, and synth**

```powershell
corepack pnpm --filter @surgical/aws-infra test
corepack pnpm --filter @surgical/aws-infra typecheck
corepack pnpm --filter @surgical/aws-infra synth
```

Expected: tests and typecheck pass; credential-free synth emits
`SmpInitialPlatform.template.json`.

- [ ] **Step 9: Commit the CDK package**

```powershell
git add pnpm-workspace.yaml pnpm-lock.yaml package.json infra/aws/package.json infra/aws/tsconfig.json infra/aws/cdk.json infra/aws/bin infra/aws/lib infra/aws/test
git commit -m "infra: define cost-optimized AWS platform"
```

---

### Task 7: Add Least-Privilege IAM Bootstrap

**Files:**
- Create: `infra/aws/iam/deployment-role-trust.json`
- Create: `infra/aws/iam/deployment-role-policy.json`
- Create: `infra/aws/iam/deployment-operator-policy.json`
- Create: `infra/aws/scripts/bootstrap-deployment-role.ps1`
- Create: `infra/aws/scripts/configure-deployment-profile.ps1`
- Create: `scripts/aws-deployment-contract.test.mjs`

**Interfaces:**
- Produces AWS profile `smp-deployer`.
- Produces source profile `smp-deployment-source` backed by IAM user
  `smp-deployment-operator`, which can only assume the deployment role.
- Produces role `arn:aws:iam::651863679421:role/smp-deployment-role`.
- Consumes the current root-backed default profile only during bootstrap.

- [ ] **Step 1: Add a failing root-exit contract test**

Create `scripts/aws-deployment-contract.test.mjs` with these imports and file
loads before the assertions:

```js
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

async function read(path) {
  return readFile(path, "utf8");
}

test("deployment automation exits root after bootstrap", async () => {
  const bootstrap = await read(
    "infra/aws/scripts/bootstrap-deployment-role.ps1"
  );
  const profile = await read(
    "infra/aws/scripts/configure-deployment-profile.ps1"
  );
  const policy = await read("infra/aws/iam/deployment-role-policy.json");
  const scriptNames = (await readdir("infra/aws/scripts"))
    .filter((name) => name.endsWith(".ps1"))
    .filter((name) => ![
      "bootstrap-deployment-role.ps1",
      "configure-deployment-profile.ps1"
    ].includes(name));
  const deploymentScripts = (
    await Promise.all(
      scriptNames.map((name) => read(`infra/aws/scripts/${name}`))
    )
  ).join("\n");

assert.match(bootstrap, /create-role/);
assert.match(profile, /role_arn=arn:aws:iam::651863679421:role\/smp-deployment-role/);
assert.match(profile, /source_profile=smp-deployment-source/);
assert.doesNotMatch(profile, /source_profile=default/);
assert.doesNotMatch(deploymentScripts, /--profile\s+default/);
assert.doesNotMatch(deploymentScripts, /get-secret-value|batch-get-secret-value/);
assert.doesNotMatch(deploymentScripts, /migrate|seed:aws|prisma\s+db/i);
assert.doesNotMatch(policy, /s3:DeleteObject/);
});
```

- [ ] **Step 2: Create trust and deployment policy documents**

Trust only the least-privilege operator created during bootstrap:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::651863679421:user/smp-deployment-operator"
    },
    "Action": "sts:AssumeRole"
  }]
}
```

`deployment-operator-policy.json` must contain only:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AssumeSmpDeploymentRole",
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::651863679421:role/smp-deployment-role"
  }]
}
```

The deployment policy must separate:

- Read-only list/describe actions on `"Resource": "*"`.
- CloudFormation actions scoped to
  `arn:aws:cloudformation:ap-south-1:651863679421:stack/SmpInitialPlatform/*`.
- IAM create/update/pass actions scoped to
  `arn:aws:iam::651863679421:role/smp-*` and
  `arn:aws:iam::651863679421:instance-profile/smp-*`.
- ECR actions scoped to `arn:aws:ecr:ap-south-1:651863679421:repository/smp-*`.
- RDS snapshot/modify actions scoped to `smp-prod-db` and snapshots prefixed
  `smp-prod-db-predeploy-`.
- EC2 mutation actions constrained by the two approved instance IDs or
  `aws:RequestTag/Project = SMP` where the API supports conditions.
- S3 mutation actions scoped only to newly created SMP upload resources.
- Secrets Manager mutation actions scoped to `smp/production/*`.
- CloudFront, logs, CloudWatch, SSM, and tagging actions needed by the CDK
  template and deployment scripts.

- [ ] **Step 3: Implement idempotent root bootstrap**

`bootstrap-deployment-role.ps1` must:

1. Require current ARN to equal `arn:aws:iam::651863679421:root`.
2. Create IAM user `smp-deployment-operator` only if it does not exist.
3. Put its only inline policy, `smp-assume-deployment-role`.
4. Create the role only if it does not exist.
5. Put the named inline role policy `smp-deployment-policy`.
6. Set maximum session duration to four hours.
7. Create one access key only when `smp-deployment-source` is not already
   usable, capture the response in memory, configure that source profile
   without echoing either key, and clear the in-memory values.
8. If the user already has keys but the source profile is unusable, fail closed
   instead of deleting or rotating a key.
9. Print only the user ARN and role ARN, never credential material.

Use:

```powershell
& $Aws iam get-role --role-name smp-deployment-role
& $Aws iam create-role --role-name smp-deployment-role --assume-role-policy-document file://$TrustPath
& $Aws iam put-role-policy --role-name smp-deployment-role --policy-name smp-deployment-policy --policy-document file://$PolicyPath
```

- [ ] **Step 4: Configure the automatic role profile**

`configure-deployment-profile.ps1` must execute:

```powershell
& $Aws configure set role_arn arn:aws:iam::651863679421:role/smp-deployment-role --profile smp-deployer
& $Aws configure set source_profile smp-deployment-source --profile smp-deployer
& $Aws configure set region ap-south-1 --profile smp-deployer
& $Aws configure set role_session_name smp-codex-deployment --profile smp-deployer
```

Then verify the returned ARN ends with
`assumed-role/smp-deployment-role/smp-codex-deployment`.

- [ ] **Step 5: Run contract tests**

```powershell
node --test scripts/aws-deployment-contract.test.mjs
```

Expected: PASS; no default-profile, secret-read, migration, seed, or protected
S3 delete pattern appears in routine deployment scripts.

- [ ] **Step 6: Commit IAM bootstrap code**

```powershell
git add infra/aws/iam infra/aws/scripts/bootstrap-deployment-role.ps1 infra/aws/scripts/configure-deployment-profile.ps1 scripts/aws-deployment-contract.test.mjs
git commit -m "infra: add least-privilege AWS deployment bootstrap"
```

---

### Task 8: Implement Reproducible Protected-Asset Audits

**Files:**
- Create: `scripts/aws-protected-assets.mjs`
- Create: `scripts/aws-protected-assets.test.mjs`
- Create: `infra/aws/scripts/protect-existing-data.ps1`

**Interfaces:**
- Produces JSON S3 count, bytes, and aggregate SHA-256.
- Produces JSON RDS configuration fingerprint and snapshot status.
- Creates a manual RDS snapshot only after the read-only baselines match.

- [ ] **Step 1: Write aggregate-hash unit tests**

Test the exact accumulator with two in-memory objects and assert that sorting
input order does not change the hash. Export:

```js
import { createHash } from "node:crypto";

export function aggregateObjects(objects) {
  const hash = createHash("sha256");
  const ordered = [...objects].sort((left, right) =>
    Buffer.from(left.key, "utf8").compare(Buffer.from(right.key, "utf8"))
  );

  for (const object of ordered) {
    const key = Buffer.from(object.key, "utf8");
    const keyLength = Buffer.alloc(8);
    const size = Buffer.alloc(8);

    keyLength.writeBigUInt64BE(BigInt(key.length));
    size.writeBigUInt64BE(BigInt(object.size));
    hash.update(keyLength);
    hash.update(key);
    hash.update(size);
    hash.update(object.digest);
  }

  return hash.digest("hex");
}
```

The implementation must append key length, UTF-8 key, size, and content digest
exactly as specified in the approved design.

- [ ] **Step 2: Implement the read-only audit CLI**

`scripts/aws-protected-assets.mjs` must:

- Require `AWS_PROFILE=smp-deployer`.
- Use AWS CLI subprocesses, not SDK plaintext credential export.
- List the protected bucket before and after a temporary read-only sync.
- Hash downloaded bytes inside a temporary directory.
- Query RDS metadata, snapshots, and deletion-protection state.
- Assert the recorded full RDS configuration hash before the protection change.
- After deletion protection is enabled, compare the stable RDS identity fields
  from the approved design rather than requiring the original full
  configuration hash, because the approved protection flag intentionally
  changes that hash.
- Emit one JSON object and no object contents.
- Support `--assert-baseline` and exit nonzero on any mismatch.

- [ ] **Step 3: Test the pure hash logic**

```powershell
node --test scripts/aws-protected-assets.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Implement the snapshot safety wrapper**

`protect-existing-data.ps1` must:

1. Set `AWS_PROFILE=smp-deployer`.
2. Run `node scripts/aws-protected-assets.mjs --assert-baseline`.
3. Stop if the S3 baseline differs.
4. Generate snapshot identifier `smp-prod-db-predeploy-YYYYMMDD-HHmmss`.
5. Call `rds create-db-snapshot`.
6. Wait with `rds wait db-snapshot-available`.
7. Enable deletion protection with `rds modify-db-instance --deletion-protection`.
8. Re-run read-only RDS metadata checks.
9. Print the snapshot identifier and status only.

Do not include any migration, seed, SQL, or object-write command.

- [ ] **Step 5: Run deployment contracts**

```powershell
node --test scripts/aws-protected-assets.test.mjs scripts/aws-deployment-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit protected-asset automation**

```powershell
git add scripts/aws-protected-assets.mjs scripts/aws-protected-assets.test.mjs infra/aws/scripts/protect-existing-data.ps1
git commit -m "infra: automate protected AWS asset checks"
```

---

### Task 9: Implement Secret Import Without Secret Disclosure

**Files:**
- Create: `infra/aws/scripts/import-secrets.ps1`
- Modify: `scripts/aws-deployment-contract.test.mjs`

**Interfaces:**
- Consumes local root/API/Worker environment files without printing values.
- Produces one current version for secret `smp/production/application`.
- Never retrieves a secret version.

- [ ] **Step 1: Extend static safety tests**

Assert that `import-secrets.ps1`:

- Contains `put-secret-value`.
- Does not contain `get-secret-value` or `batch-get-secret-value`.
- Does not use `Write-Output` on parsed environment values.
- Rejects `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ACCESS_KEY_ID`, and
  `S3_SECRET_ACCESS_KEY` from the payload.

- [ ] **Step 2: Implement an allowlisted environment importer**

The script must allow only:

```powershell
$AllowedKeys = @(
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'ERROR_MONITORING_DSN'
)
```

It must parse local env files in memory, require the first seven values, create
a restricted temporary JSON file, call:

```powershell
aws secretsmanager put-secret-value `
  --profile smp-deployer `
  --secret-id smp/production/application `
  --secret-string file://$TemporarySecretFile `
  --output json | Out-Null
```

Remove the verified temporary file in `finally`. Print only the secret ARN/name
and the imported key names.

- [ ] **Step 3: Run static contract tests**

```powershell
node --test scripts/aws-deployment-contract.test.mjs
```

Expected: PASS without reading any secret values.

- [ ] **Step 4: Commit secret-import automation**

```powershell
git add infra/aws/scripts/import-secrets.ps1 scripts/aws-deployment-contract.test.mjs
git commit -m "infra: add non-disclosing secret import"
```

---

### Task 10: Add EC2 Runtime Configuration

**Files:**
- Create: `infra/aws/runtime/nginx/smp.conf`
- Create: `infra/aws/runtime/systemd/smp-api.service`
- Create: `infra/aws/runtime/systemd/smp-worker.service`
- Create: `infra/aws/runtime/systemd/smp-web.service`
- Create: `infra/aws/runtime/systemd/smp-admin.service`
- Create: `infra/aws/runtime/cloudwatch-agent.json`
- Create: `infra/aws/runtime/configure-host.sh`
- Create: `infra/aws/scripts/bootstrap-instances.ps1`
- Modify: `scripts/aws-deployment-contract.test.mjs`

**Interfaces:**
- Consumes ECR image URIs/digests, CloudFront outputs, and dynamic secret references.
- Produces four systemd units, Nginx routing, Docker, SSM, and CloudWatch runtime.

- [ ] **Step 1: Add failing runtime-contract assertions**

Assert:

- Nginx listens only on port 80 and routes only known `X-SMP-Origin-App` values.
- API and Worker unit files invoke `/usr/local/bin/asm-exec`.
- Unit files contain `{{resolve:secretsmanager:smp/production/application`.
- Worker unit is disabled by default.
- No unit contains a plaintext URL credential pattern.
- `configure-host.sh` verifies the pinned `asm-exec` SHA-256.

- [ ] **Step 2: Create the Nginx routing configuration**

Create `infra/aws/runtime/nginx/smp.conf`:

```nginx
map $http_x_smp_origin_app $smp_upstream {
  default  http://127.0.0.1:9;
  customer http://127.0.0.1:3000;
  admin    http://127.0.0.1:3001;
  api      http://127.0.0.1:4000;
}

map $http_upgrade $connection_upgrade {
  default upgrade;
  ""      close;
}

server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 12m;

  location / {
    proxy_pass $smp_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Request-Id $request_id;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

Both `map` blocks remain in this one `conf.d` file, which Nginx loads in the
top-level HTTP context.

- [ ] **Step 3: Create systemd units with dynamic references**

API unit `ExecStart` must use:

```ini
EnvironmentFile=/etc/smp/images.env
ExecStart=/usr/local/bin/asm-exec -- /usr/bin/docker run --rm --name smp-api --network host --memory 430m --memory-swap 700m \
  -e NODE_ENV=production -e API_PORT=4000 -e TRUST_PROXY=1 \
  -e DATABASE_URL={{resolve:secretsmanager:smp/production/application:SecretString:DATABASE_URL}} \
  -e REDIS_URL={{resolve:secretsmanager:smp/production/application:SecretString:REDIS_URL}} \
  -e JWT_ACCESS_SECRET={{resolve:secretsmanager:smp/production/application:SecretString:JWT_ACCESS_SECRET}} \
  -e JWT_REFRESH_SECRET={{resolve:secretsmanager:smp/production/application:SecretString:JWT_REFRESH_SECRET}} \
  -e RAZORPAY_KEY_ID={{resolve:secretsmanager:smp/production/application:SecretString:RAZORPAY_KEY_ID}} \
  -e RAZORPAY_KEY_SECRET={{resolve:secretsmanager:smp/production/application:SecretString:RAZORPAY_KEY_SECRET}} \
  -e RAZORPAY_WEBHOOK_SECRET={{resolve:secretsmanager:smp/production/application:SecretString:RAZORPAY_WEBHOOK_SECRET}} \
  --env-file /etc/smp/api-public.env ${SMP_API_IMAGE}
```

Worker uses the database, Redis, webhook secret, queue prefix, and
`WORKER_PREFLIGHT_ON_STARTUP=true`. Web/Admin units use versioned image values
without secrets.

All four units load `/etc/smp/images.env`; deployment automation writes only
digest-qualified variables `SMP_API_IMAGE`, `SMP_WORKER_IMAGE`,
`SMP_WEB_IMAGE`, and `SMP_ADMIN_IMAGE` before starting a service.

Use `Restart=on-failure`, `RestartSec=5`, `TimeoutStopSec=30`, and
`After=docker.service network-online.target`.

- [ ] **Step 4: Implement pinned runtime bootstrap**

`configure-host.sh` must:

- Install Docker Engine, Nginx, AWS CLI v2, and CloudWatch Agent.
- Download `asm-exec` from commit
  `7b94d0075db9e89db624e4e3be446ab8cde4a076`.
- Require SHA-256
  `d55eb38ad33a5b76f584ca180f633ecc120cf39b8fd29427ffbe11a8fbf19556`.
- Install it as `/usr/local/bin/asm-exec` mode `0755`.
- Create `/etc/smp` mode `0750`.
- Create a 2 GiB swap file only if no swap is active.
- Install Nginx, systemd, and CloudWatch configurations.
- Run `nginx -t` and `systemctl daemon-reload`.
- Never start `smp-worker`.

- [ ] **Step 5: Implement SSM bootstrap orchestration**

`bootstrap-instances.ps1` must:

1. Verify profile `smp-deployer`.
2. Wait for both instance IDs to be SSM online after the CDK instance-profile
   association.
3. If either is not online after ten minutes, stop and report that temporary
   EC2 Instance Connect bootstrap is required; do not open SSH automatically.
4. Send the pinned runtime bundle through an SSM command document.
5. Wait for command success on both instances.
6. Attach the new origin security group.
7. Remove the old launch-wizard security groups only after SSM and Nginx checks pass.
8. Verify port 22 has no public ingress.

- [ ] **Step 6: Run runtime contract tests**

```powershell
node --test scripts/aws-deployment-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit EC2 runtime configuration**

```powershell
git add infra/aws/runtime infra/aws/scripts/bootstrap-instances.ps1 scripts/aws-deployment-contract.test.mjs
git commit -m "infra: configure hardened EC2 application runtime"
```

---

### Task 11: Add Build, Release, Rollback, and Verification Scripts

**Files:**
- Create: `infra/aws/scripts/build-and-push.ps1`
- Create: `infra/aws/scripts/deploy-services.ps1`
- Create: `infra/aws/scripts/rollback-services.ps1`
- Create: `infra/aws/scripts/verify-deployment.ps1`
- Modify: `scripts/aws-deployment-contract.test.mjs`

**Interfaces:**
- Consumes CDK outputs and current Git commit.
- Produces immutable ECR digests and SSM service activation.
- Produces a sanitized JSON verification report.

- [ ] **Step 1: Extend deployment-script contracts**

Assert every routine script contains `--profile smp-deployer`, contains no
forbidden migration/seed/secret-read command, and references images by digest
after push.

- [ ] **Step 2: Implement build-and-push**

The script must:

1. Require a clean tracked worktree.
2. Use the current full Git SHA as the image tag.
3. Read CloudFormation outputs.
4. Log in to ECR using `get-login-password` piped directly to Docker.
5. Build API and Worker.
6. Build Web/Admin with the final CloudFront build arguments.
7. Push four immutable tags.
8. Resolve four image digests through `ecr describe-images`.
9. Write only image names, tags, and digests to a sanitized release JSON file
   under `tmp/aws-release/`.

- [ ] **Step 3: Implement staged service deployment**

`deploy-services.ps1` must:

- Update `/etc/smp/api-public.env` through SSM with non-secret values.
- Set image digest environment values in systemd drop-ins.
- Start API first.
- Poll local `/api/v1/health/live`, then `/api/v1/health/ready`.
- Run Worker `queue-status --require-empty` through an `asm-exec`-wrapped
  one-shot container.
- Leave Worker disabled when exit code is `2`.
- Start Worker only on explicit `-StartWorker` and safe queue result.
- Start Web and Admin after their images are present.
- Restart Nginx only after `nginx -t`.
- Store previous image digests before any unit restart.

- [ ] **Step 4: Implement digest rollback**

`rollback-services.ps1` must:

- Require a service name from `api`, `worker`, `web`, or `admin`.
- Read the previous digest recorded on the relevant host.
- Restore the systemd drop-in.
- Run `systemctl daemon-reload` and restart only the selected service.
- Never call RDS, S3 protected-bucket mutation, migrations, or seeds.

- [ ] **Step 5: Implement end-to-end verification**

`verify-deployment.ps1` must verify:

- Assumed-role ARN.
- CloudFormation stack status and outputs.
- ECR digest availability and scan status.
- Both SSM instances online.
- API CloudFront live and ready endpoints.
- Customer CloudFront root response.
- Admin CloudFront login response.
- One existing catalog object through the existing catalog CDN using HEAD only.
- Worker service state and queue inspection result.
- RDS status, identifier, resource ID, engine, storage, deletion protection,
  and manual snapshot availability.
- S3 protected baseline after deployment.
- CloudWatch alarm states.

The script must fail if protected object count, bytes, or SHA-256 differs.

- [ ] **Step 6: Run contract tests**

```powershell
node --test scripts/aws-deployment-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit release automation**

```powershell
git add infra/aws/scripts/build-and-push.ps1 infra/aws/scripts/deploy-services.ps1 infra/aws/scripts/rollback-services.ps1 infra/aws/scripts/verify-deployment.ps1 scripts/aws-deployment-contract.test.mjs
git commit -m "infra: add AWS release and rollback automation"
```

---

### Task 12: Write the AWS Deployment Runbook

**Files:**
- Create: `docs/deployment-aws.md`
- Modify: `docs/deployment.md`

**Interfaces:**
- Produces one operator sequence matching Tasks 13-20.

- [ ] **Step 1: Write the exact runbook**

Document:

- Prerequisites and account/region assertions.
- Root IAM bootstrap and immediate root exit.
- Baseline, snapshot, and deletion-protection gate.
- CDK test, synth, diff, and deploy commands.
- Secret import without secret reads.
- Image build/push.
- SSM bootstrap.
- API-first release.
- Worker queue gate.
- Frontend release.
- Verification and rollback commands.
- AWS-generated URL outputs.
- Explicit forbidden operations.

- [ ] **Step 2: Link the runbook from the existing deployment guide**

At the top of `docs/deployment.md`, link `docs/deployment-aws.md` as the
account-specific AWS procedure and state that its no-migration rule overrides
the generic migration instruction for this protected deployment.

- [ ] **Step 3: Validate documentation invariants**

```powershell
rg -n "prisma migrate deploy" docs/deployment-aws.md
rg -n "smp-deployer|255|dfe52fa9|queue-status|CloudFront" docs/deployment-aws.md
```

Expected: the first command returns only a line explicitly forbidding the
command; the second finds all required safety anchors.

- [ ] **Step 4: Commit the runbook**

```powershell
git add docs/deployment-aws.md docs/deployment.md
git commit -m "docs: add protected AWS deployment runbook"
```

---

### Task 13: Run the Complete Local Verification Gate

**Files:**
- Modify only files needed to correct failures discovered by these commands.

**Interfaces:**
- Produces a commit that is safe to deploy.

- [ ] **Step 1: Install locked dependencies**

```powershell
corepack pnpm install --frozen-lockfile
```

Expected: exit code 0.

- [ ] **Step 2: Run repository quality gates**

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Expected: all four commands exit 0.

- [ ] **Step 3: Run CDK gates**

```powershell
corepack pnpm --filter @surgical/aws-infra test
corepack pnpm --filter @surgical/aws-infra typecheck
corepack pnpm --filter @surgical/aws-infra synth
```

Expected: tests/typecheck pass and synth produces one stack without RDS or the
protected catalog bucket as owned resources.

- [ ] **Step 4: Build all four production images**

Use the four commands from Task 5 with invalid nonproduction URL build args.

Expected: all four image builds pass.

- [ ] **Step 5: Scan the final diff and tracked files for secrets**

```powershell
git diff --check
git grep -n -I -E "AKIA[0-9A-Z]{16}|postgresql://[^[]|redis(s)?://[^[]+@" -- ':!*.example' ':!docs/superpowers/**'
git status --short
```

Expected: no credential match; only intended tracked implementation files and
the pre-existing untracked `AGENTS.md` appear.

- [ ] **Step 6: Commit any verification-only correction**

If corrections were required:

review `git diff --name-only`, stage each correction by its explicit repository
path, and commit it with message
`fix: satisfy AWS deployment verification`.

If no correction was required, do not create an empty commit.

---

### Task 14: Bootstrap and Verify the Least-Privilege Deployment Role

**Files:**
- No repository file changes.

**Interfaces:**
- Produces active AWS CLI profile `smp-deployer`.

- [ ] **Step 1: Confirm root only for bootstrap**

```powershell
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output json
```

Expected: account `651863679421`, ARN
`arn:aws:iam::651863679421:root`.

- [ ] **Step 2: Run IAM bootstrap once**

```powershell
& .\infra\aws\scripts\bootstrap-deployment-role.ps1
& .\infra\aws\scripts\configure-deployment-profile.ps1
```

Expected: role and profile created without credential output.

- [ ] **Step 3: Prove root exit**

```powershell
aws sts get-caller-identity --profile smp-deployer --query '{Account:Account,Arn:Arn}' --output json
```

Expected: assumed-role ARN for `smp-deployment-role`. Also run:

```powershell
aws sts get-caller-identity --profile smp-deployment-source --query '{Account:Account,Arn:Arn}' --output json
```

Expected: IAM user ARN
`arn:aws:iam::651863679421:user/smp-deployment-operator`, proving routine role
assumption no longer uses root credentials.

- [ ] **Step 4: Use only the deployment profile**

Set:

```powershell
$env:AWS_PROFILE='smp-deployer'
$env:AWS_REGION='ap-south-1'
$env:AWS_DEFAULT_REGION='ap-south-1'
```

All remaining tasks must fail closed if the identity is not the deployment
role.

---

### Task 15: Establish the Live Data-Protection Gate

**Files:**
- No repository file changes.

**Interfaces:**
- Produces an available manual RDS snapshot and matched S3 baseline.

- [ ] **Step 1: Re-run the read-only protected baseline**

```powershell
node scripts/aws-protected-assets.mjs --assert-baseline
```

Expected: 255 objects, 5,298,735 bytes, exact approved SHA-256, stable listing,
RDS available.

- [ ] **Step 2: Create the manual snapshot and enable deletion protection**

```powershell
& .\infra\aws\scripts\protect-existing-data.ps1
```

Expected: timestamped manual snapshot reaches `available`; deletion protection
is true.

- [ ] **Step 3: Re-run the read-only baseline**

```powershell
node scripts/aws-protected-assets.mjs --assert-baseline
```

Expected: protected S3 fingerprint unchanged and RDS available.

---

### Task 16: Deploy Only the New CDK Infrastructure

**Files:**
- No repository file changes.

**Interfaces:**
- Produces ECR, upload storage/CDN, app CDNs, IAM runtime profile, EIPs, logs, and alarms.

- [ ] **Step 1: Review CDK diff**

```powershell
corepack pnpm --filter @surgical/aws-infra cdk -- diff SmpInitialPlatform
```

Expected:

- No `AWS::RDS::DBInstance`.
- No owned resource for the protected catalog bucket.
- No delete policy on existing resources.
- Only approved new resources and ingress references.

- [ ] **Step 2: Deploy with termination protection**

```powershell
New-Item -ItemType Directory -Force tmp/aws-release | Out-Null
corepack pnpm --filter @surgical/aws-infra cdk -- deploy SmpInitialPlatform --require-approval never --outputs-file tmp/aws-release/cdk-outputs.json
aws cloudformation update-termination-protection --stack-name SmpInitialPlatform --enable-termination-protection --profile smp-deployer --region ap-south-1
```

Expected: stack reaches `CREATE_COMPLETE`.

- [ ] **Step 3: Verify protected resources again**

```powershell
node scripts/aws-protected-assets.mjs --assert-baseline
```

Expected: exact S3 baseline and RDS status remain valid.

---

### Task 17: Import Secrets and Build Immutable ECR Images

**Files:**
- Runtime evidence only under ignored `tmp/aws-release/`.

**Interfaces:**
- Produces a current application secret and four image digests.

- [ ] **Step 1: Import allowlisted secrets**

```powershell
& .\infra\aws\scripts\import-secrets.ps1
```

Expected: secret version created; output contains key names but no values.

- [ ] **Step 2: Build and push the final images**

```powershell
& .\infra\aws\scripts\build-and-push.ps1
```

Expected: four ECR digests recorded in ignored release JSON.

- [ ] **Step 3: Verify scans**

```powershell
aws ecr describe-image-scan-findings --profile smp-deployer --region ap-south-1 --repository-name smp-api --image-id imageTag=$(git rev-parse HEAD)
```

Repeat for Worker, Web, and Admin.

Expected: scan completes; no unreviewed critical finding.

---

### Task 18: Bootstrap and Harden Both EC2 Instances

**Files:**
- No repository file changes.

**Interfaces:**
- Produces two SSM-managed hosts with Docker, Nginx, CloudWatch, and systemd units.

- [ ] **Step 1: Wait for instance-profile propagation**

```powershell
aws ssm describe-instance-information --profile smp-deployer --region ap-south-1 --filters Key=InstanceIds,Values=i-05f03e840bc11f2bc,i-063654e8ed1eaeeff
```

Expected: both instances report `Online`.

- [ ] **Step 2: Run idempotent bootstrap**

```powershell
& .\infra\aws\scripts\bootstrap-instances.ps1
```

Expected: Docker, Nginx, CloudWatch agent, and `asm-exec` verified; Worker not
started.

- [ ] **Step 3: Confirm public SSH removal**

```powershell
aws ec2 describe-security-groups --profile smp-deployer --region ap-south-1 --group-ids $(Get-Content tmp/aws-release/cdk-outputs.json | ConvertFrom-Json | Select-Object -ExpandProperty SmpInitialPlatform | Select-Object -ExpandProperty OriginSecurityGroupId)
```

Expected: no port 22 public ingress; port 80 is limited to CloudFront origin-facing ranges.

---

### Task 19: Deploy API and Evaluate Worker Safety

**Files:**
- Runtime evidence only.

**Interfaces:**
- Produces healthy API; Worker either safely active or explicitly stopped.

- [ ] **Step 1: Deploy API without migrations**

```powershell
& .\infra\aws\scripts\deploy-services.ps1 -Services api
```

Expected: API live and ready checks pass; no migration or seed command appears
in SSM command history.

- [ ] **Step 2: Run read-only queue inspection**

```powershell
& .\infra\aws\scripts\deploy-services.ps1 -InspectWorkerQueues
```

Expected: JSON counts for six queues.

- [ ] **Step 3: Start or hold Worker**

If `safeToStart` is true:

```powershell
& .\infra\aws\scripts\deploy-services.ps1 -Services worker -StartWorker
```

If false, leave Worker stopped and record the queue counts. Do not purge,
retry, drain, or delete jobs.

---

### Task 20: Deploy Customer and Admin, Then Complete Verification

**Files:**
- Create after success: `docs/deployment-records/2026-07-17-aws-initial-deployment.md`

**Interfaces:**
- Produces customer/admin/API AWS URLs and final protected-asset evidence.

- [ ] **Step 1: Deploy Web and Admin**

```powershell
& .\infra\aws\scripts\deploy-services.ps1 -Services web,admin
```

Expected: both local origins are healthy before CloudFront verification.

- [ ] **Step 2: Run the complete verification script**

```powershell
& .\infra\aws\scripts\verify-deployment.ps1
```

Expected: all applicable gates pass; protected S3 fingerprint is unchanged;
RDS and manual snapshot are available.

- [ ] **Step 3: Capture a sanitized deployment record**

Create `docs/deployment-records/2026-07-17-aws-initial-deployment.md` containing:

- Assumed deployment-role ARN.
- Commit SHA and four ECR digests.
- Customer, Admin, API, Upload, and existing Catalog CloudFront URLs.
- RDS snapshot identifier/status.
- Before/after S3 count, bytes, and aggregate SHA-256.
- SSM online status.
- Worker queue result and running/stopped decision.
- CloudWatch alarm status.
- Deferred limitations.

Do not include secret values, database/Redis URLs, access keys, session tokens,
private object contents, or user data.

- [ ] **Step 4: Commit deployment evidence**

```powershell
git add docs/deployment-records/2026-07-17-aws-initial-deployment.md
git commit -m "docs: record initial AWS deployment"
```

- [ ] **Step 5: Report completion**

Report the generated CloudFront URLs, verification gates, protected-asset
fingerprints, Worker decision, and remaining cost/availability limitations.
Do not claim completion if a required gate is unverified.
