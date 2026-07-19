# SMP Provider-Neutral Free Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package and deploy the SMP customer web, admin web, API, worker, PostgreSQL, Redis, and uploads without AWS, with a fresh database and GitHub-gated CI/CD.

**Architecture:** GitHub Actions remains the quality and release controller. Cloudflare Workers hosts the two OpenNext applications, Northflank hosts the API and worker plus the Redis addon, Neon hosts PostgreSQL 18, and Cloudflare R2 stores new uploads through the existing S3-compatible provider. Normal releases migrate but never seed; a protected manual workflow performs the one-time fresh bootstrap.

**Tech Stack:** Node.js 22, pnpm 9.15.4, Next.js 16.2, OpenNext Cloudflare adapter, Wrangler 4, NestJS 10, Prisma 7.8, BullMQ 5, Docker, GitHub Actions, Northflank API, Neon PostgreSQL 18, Cloudflare R2.

## Global Constraints

- Do not create, read, update, migrate, or delete AWS resources.
- Do not migrate the existing AWS PostgreSQL database or catalog objects.
- Start with zero products, warehouses, inventory, orders, customers, and queue jobs.
- Preserve the existing fixed roles, permissions, categories, brands, and optional super-admin seed.
- Never run the seed from the normal production release.
- Never commit or print a provider token, database URL, password, API key, or application secret.
- Preserve the root untracked `AGENTS.md`; do not stage or modify it.
- Use Node.js 22 and pnpm 9.15.4 in CI and containers.
- Keep Northflank native CI disabled and CD enabled; GitHub Actions starts builds only after quality and migration gates pass.
- Treat Cloudflare's 3 MiB compressed Worker limit as a hard build gate. Treat
  its 10 ms CPU limit as a live-runtime risk that requires repeated dynamic
  route smoke tests and observability review.
- Treat Northflank Free as a developer sandbox with no production suitability
  claim or SLA. The `production` names identify the single release environment,
  not a provider guarantee; do not onboard real customers without an approved
  paid or production-grade backend host.
- Stop on migration, build, deployment, health, readiness, or smoke-test failure.

---

## File Map

### Runtime and fresh bootstrap

- Modify `apps/api/package.json`: add production start, migration, fresh-bootstrap verification scripts, and pin TypeScript 5.9.3 for reproducible builds.
- Create `apps/api/scripts/verify-fresh-bootstrap.ts`: enforce both the empty pre-seed state and the expected post-seed state.
- Create `apps/api/test/database/fresh-bootstrap.test.ts`: unit-test fresh-state assertions.

### Northflank release control

- Create `scripts/deploy-northflank.mjs`: start a combined-service build for an exact Git SHA and poll build/deployment state.
- Create `scripts/deploy-northflank.test.mjs`: test success, terminal failure, timeout, worker command execution, and secret-safe errors with fake provider clients.
- Modify `package.json` and `pnpm-lock.yaml`: add the root deploy command and pinned Northflank JavaScript client.

### Containers

- Create `.dockerignore`: exclude local dependencies, build output, environments, Git metadata, generated mobile output, and local artifacts.
- Create `infra/docker/api.Dockerfile`: build and run the API as a non-root Node.js 22 image.
- Create `infra/docker/worker.Dockerfile`: build and run the worker with startup preflight as a non-root Node.js 22 image.
- Create `scripts/container-contract.test.mjs`: enforce runtime user, commands, health behavior, and secret exclusions.

### Cloudflare applications

- Modify `apps/web/package.json` and `apps/admin/package.json`: add pinned OpenNext scripts and build required workspace packages first.
- Modify `apps/web/next.config.mjs` and `apps/admin/next.config.mjs`: initialize OpenNext development support and disable paid image transformation in Cloudflare builds.
- Modify `apps/web/lib/api/client.ts`, `apps/web/lib/media/upload-url.ts`, and `apps/admin/lib/admin-api.ts`: recognize Northflank's `.code.run` origin and keep browser traffic on the existing same-origin proxy.
- Modify `apps/web/lib/api/client.test.ts` and
  `apps/admin/lib/admin-api.test.ts`; create
  `apps/web/lib/media/upload-url.test.ts` for Northflank host routing.
- Create `apps/web/open-next.config.ts` and `apps/admin/open-next.config.ts`.
- Create `apps/web/wrangler.jsonc` and `apps/admin/wrangler.jsonc`.
- Create `apps/web/public/_headers` and `apps/admin/public/_headers`.
- Modify `apps/web/next-config.test.mjs`; create `apps/admin/next-config.test.mjs`.
- Modify `.gitignore`: ignore OpenNext and Wrangler build output.
- Modify `pnpm-lock.yaml`: lock OpenNext and Wrangler dependencies.

### CI/CD

- Modify `.github/workflows/ci.yml`: retain the named `CI` quality gate on `main`, add pnpm caching, and add deployment-contract validation.
- Create `.github/workflows/deploy-production.yml`: release the exact successful `CI` commit through migration, Northflank API, API readiness, Northflank worker, Cloudflare web/admin, and smoke tests.
- Create `.github/workflows/bootstrap-production.yml`: protected one-time migrate, seed, and empty product/warehouse verification.
- Create `scripts/workflow-contract.test.mjs`: ensure production ordering, manual-only seed, least privileges, and secret boundaries.

### Documentation

- Replace `docs/deployment.md`: provider-neutral setup, environment mapping, free-tier limits, deployment order, rollback, and verification.
- Create `infra/northflank/README.md`: exact service/addon settings and GitHub variable names.
- Modify the two 2026-07-17 AWS deployment documents: add a top-level superseded warning only.
- Modify `apps/api/.env.example`, `apps/worker/.env.example`, `apps/web/.env.example`, and `apps/admin/.env.example`: document provider-neutral variables without values.

---

### Task 1: Fresh Database Bootstrap Contract

**Files:**

- Create: `apps/api/scripts/verify-fresh-bootstrap.ts`
- Create: `apps/api/test/database/fresh-bootstrap.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**

- Consumes: generated Prisma client from `apps/api/src/generated/prisma/client`.
- Produces: `assertPreBootstrapState(state)`, `assertFreshBootstrapState(state, expectedAdminEmail)`, and CLI script `verify:fresh-bootstrap`.

- [ ] **Step 1: Write the failing fresh-state unit tests**

Create tests that import `assertFreshBootstrapState` and cover:

```ts
test("accepts fixed bootstrap data with no business data", () => {
  assert.doesNotThrow(() =>
    assertFreshBootstrapState({
      adminEmail: "admin@example.test",
      adminUsers: 1,
      brands: 1,
      categories: 1,
      inventoryStocks: 0,
      orders: 0,
      permissions: 1,
      products: 0,
      roles: 1,
      stockBatches: 0,
      stockMovements: 0,
      users: 0,
      warehouses: 0
    }, "admin@example.test")
  );
});

test("rejects inherited business data before seed", () => {
  assert.throws(
    () =>
      assertPreBootstrapState({
        adminEmail: null,
        adminUsers: 0,
        brands: 0,
        categories: 0,
        inventoryStocks: 0,
        orders: 0,
        permissions: 0,
        products: 1,
        roles: 0,
        stockBatches: 0,
        stockMovements: 0,
        users: 0,
        warehouses: 0
      }),
    /products=1/
  );
});

test("rejects an incomplete access-control bootstrap", () => {
  assert.throws(
    () =>
      assertFreshBootstrapState({
        adminEmail: null,
        adminUsers: 0,
        brands: 0,
        categories: 0,
        inventoryStocks: 0,
        orders: 0,
        permissions: 0,
        products: 0,
        roles: 0,
        stockBatches: 0,
        stockMovements: 0,
        users: 0,
        warehouses: 0
      }, "admin@example.test"),
    /access-control bootstrap/
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
corepack pnpm --filter @surgical/api test
```

Expected: FAIL because `verify-fresh-bootstrap.ts` does not exist.

- [ ] **Step 3: Implement the fresh-bootstrap verifier**

Implement this public contract:

```ts
export type FreshBootstrapState = {
  adminEmail: string | null;
  adminUsers: number;
  brands: number;
  categories: number;
  inventoryStocks: number;
  orders: number;
  permissions: number;
  products: number;
  roles: number;
  stockBatches: number;
  stockMovements: number;
  users: number;
  warehouses: number;
};

export function assertPreBootstrapState(state: FreshBootstrapState) {
  const nonEmpty = Object.entries(state).filter(
    ([name, value]) => name !== "adminEmail" && value !== 0
  );
  if (nonEmpty.length > 0) {
    throw new Error(
      `Fresh database is not empty: ${nonEmpty
        .map(([name, count]) => `${name}=${count}`)
        .join(", ")}.`
    );
  }
}

export function assertFreshBootstrapState(
  state: FreshBootstrapState,
  expectedAdminEmail: string
) {
  if (
    state.products !== 0 ||
    state.warehouses !== 0 ||
    state.users !== 0 ||
    state.orders !== 0 ||
    state.inventoryStocks !== 0 ||
    state.stockBatches !== 0 ||
    state.stockMovements !== 0
  ) {
    throw new Error("Fresh bootstrap contains inherited business data.");
  }

  if (
    state.adminUsers !== 1 ||
    state.adminEmail !== expectedAdminEmail ||
    state.permissions < 1 ||
    state.roles < 1 ||
    state.categories < 1 ||
    state.brands < 1
  ) {
    throw new Error("Fresh database access-control bootstrap is incomplete.");
  }
}
```

The post-seed assertion also queries the single admin email and requires it to
equal `SEED_SUPER_ADMIN_EMAIL`, without printing the email. The CLI accepts
`--phase=before` or `--phase=after`, creates Prisma with `PrismaPg`, queries all
counts in one `$transaction`, calls the phase assertion, prints only non-secret
JSON counts, and disconnects in `finally`.

- [ ] **Step 4: Add production database scripts**

Add exactly these package scripts:

```json
"prisma:migrate:deploy": "prisma migrate deploy --schema ./prisma/schema.prisma",
"start:prod": "node dist/main.js",
"verify:fresh-bootstrap": "tsx scripts/verify-fresh-bootstrap.ts"
```

Also add an exact `typescript: "5.9.3"` development dependency so the API
does not accidentally resolve Prisma's TypeScript 6 peer during clean builds.
Keep `seed` manual. Do not add it to `start:prod`.

- [ ] **Step 5: Run tests and API validation**

Run:

```powershell
corepack pnpm --filter @surgical/api prisma:generate
corepack pnpm --filter @surgical/api test
corepack pnpm --filter @surgical/api typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit the bootstrap contract**

```powershell
git add apps/api/package.json apps/api/scripts/verify-fresh-bootstrap.ts apps/api/test/database/fresh-bootstrap.test.ts
git commit -m "feat(api): add fresh production bootstrap verification"
```

---

### Task 2: Northflank Deployment Client

**Files:**

- Create: `scripts/deploy-northflank.mjs`
- Create: `scripts/deploy-northflank.test.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `NORTHFLANK_API_TOKEN`, `NORTHFLANK_PROJECT_ID`, a service ID, and a 40-character Git SHA.
- Produces: `deployNorthflankService(options)`,
  `execNorthflankServiceCommand(options)`, and root script
  `deploy:northflank`.

- [ ] **Step 1: Write failing client tests**

Use a fake `fetchImpl` and injected `sleep` to test:

- POST `/v1/projects/{projectId}/services/{serviceId}/build` sends only `{sha}`.
- the POST response build ID is used to poll
  `/v1/projects/{projectId}/services/{serviceId}/build/{buildId}`;
- build polling succeeds only when `concluded`, `success`, `status=SUCCESS`,
  and `data.sha` equals the requested SHA;
- service polling succeeds only when deployment is `COMPLETED` and
  `deployment.internal.deployedSHA` equals the requested SHA;
- `FAILURE`, `SUBMISSION_FAILURE`, `ABORTED`, `CRASHED`, or `UNSCHEDULABLE`
  rejects immediately;
- timeout rejects;
- worker command execution returns exit code/stdout/stderr and rejects a
  nonzero exit without leaking authentication;
- errors never contain the bearer token.

The service success fixture must include:

```js
{
  data: {
    deployment: { internal: { deployedSHA: SHA } },
    status: { deployment: { status: "COMPLETED" } }
  }
}
```

- [ ] **Step 2: Run the root test and verify RED**

```powershell
node --test scripts/deploy-northflank.test.mjs
```

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement authenticated API calls**

Implement:

```js
export async function deployNorthflankService({
  apiBase = "https://api.northflank.com/v1",
  fetchImpl = fetch,
  intervalMs = 5000,
  projectId,
  serviceId,
  sha,
  sleep = defaultSleep,
  timeoutMs = 900000,
  token
}) {
  validateInputs({ projectId, serviceId, sha, token });
  const build = await request(fetchImpl, `${apiBase}/projects/${projectId}/services/${serviceId}/build`, {
    body: JSON.stringify({ sha }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  await waitForBuild({
    apiBase,
    buildId: build.data.id,
    fetchImpl,
    intervalMs,
    projectId,
    serviceId,
    sha,
    sleep,
    timeoutMs,
    token
  });

  return waitForDeployment({
    apiBase,
    fetchImpl,
    intervalMs,
    projectId,
    serviceId,
    sha,
    sleep,
    timeoutMs,
    token
  });
}
```

The CLI accepts `--service-id` and `--sha`; project/token come only from
environment variables. Output service ID, SHA, build ID, and terminal status,
never the token or full response body. Reject a stale previously-completed
deployment whose `deployedSHA` differs from the requested SHA.

- [ ] **Step 4: Add the root command**

```json
"deploy:northflank": "node scripts/deploy-northflank.mjs"
```

Add exact dependency `@northflank/js-client: "0.9.5"` and use its
`execServiceCommand` for the worker's post-deploy
`node dist/healthcheck.js` gate. Do not use the interactive CLI because its
stdout is unreliable in non-TTY GitHub runners.

- [ ] **Step 5: Run tests**

```powershell
node --test scripts/deploy-northflank.test.mjs
corepack pnpm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml scripts/deploy-northflank.mjs scripts/deploy-northflank.test.mjs
git commit -m "feat: add gated Northflank deployment client"
```

---

### Task 3: Production API and Worker Containers

**Files:**

- Create: `.dockerignore`
- Create: `infra/docker/api.Dockerfile`
- Create: `infra/docker/worker.Dockerfile`
- Create: `scripts/container-contract.test.mjs`

**Interfaces:**

- Consumes: monorepo root as Docker build context.
- Produces: `smp-api` and `smp-worker` Linux/amd64-compatible images.

- [ ] **Step 1: Write the failing container contract test**

Read both Dockerfiles and assert:

- `FROM node:22-bookworm-slim`;
- Corepack prepares `pnpm@9.15.4`;
- install uses `--frozen-lockfile`;
- runtime has `NODE_ENV=production`;
- runtime switches to a non-root `USER`;
- API exposes port `4000` and starts `node dist/main.js`;
- worker starts `node dist/main.js`, whose existing startup preflight gates
  Nest context creation;
- neither Dockerfile copies `.env` or accepts secrets as `ARG`;
- `.dockerignore` contains `.env`, `.env.*`, `**/.env*`, `.git`, `.next`, `.open-next`,
  `node_modules`, `.p`, `apps/delivery/android`, and `tmp`.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --test scripts/container-contract.test.mjs
```

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Create a shared multi-stage structure**

Both Dockerfiles must use:

```dockerfile
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
```

Copy lock/workspace manifests and only required package manifests before the
frozen install. Copy the required source after dependency installation. Build
`@surgical/config`, `@surgical/types`, and the target application. Generate the
Prisma client before the API build using a build-only localhost URL because
`prisma.config.ts` requires `DATABASE_URL`.

Use pnpm 9's `pnpm --filter <target> deploy --prod /out` in the Linux builder
after the workspace packages are built. The runtime stage selectively copies
`/out/node_modules`, `/out/package.json`, and the target's `dist`; it must not
copy source files, `.env` examples, or the Prisma CLI.

- [ ] **Step 4: Add non-root runtime stages**

Use a runtime pattern equivalent to:

```dockerfile
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/<target>/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Add `ENV API_PORT=4000`, `EXPOSE 4000`, and a Node-fetch health check for
`/api/v1/health/ready` to the API. Add
`HEALTHCHECK CMD ["node", "dist/healthcheck.js"]` to the worker.

- [ ] **Step 5: Run contract and Docker builds**

```powershell
node --test scripts/container-contract.test.mjs
docker build --file infra/docker/api.Dockerfile --tag smp-api:local .
docker build --file infra/docker/worker.Dockerfile --tag smp-worker:local .
docker inspect smp-api:local --format '{{.Config.User}}'
docker inspect smp-worker:local --format '{{.Config.User}}'
```

Expected: builds succeed and both users equal `node`.

- [ ] **Step 6: Verify secret-free failure behavior**

Run the API and worker without production secrets. Expected: both fail closed
with missing-variable errors and no credentials in output. Do not inject local
`.env` into either test.

- [ ] **Step 7: Commit**

```powershell
git add .dockerignore infra/docker/api.Dockerfile infra/docker/worker.Dockerfile scripts/container-contract.test.mjs
git commit -m "build: package API and worker for Northflank"
```

---

### Task 4: Cloudflare OpenNext Packaging

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/admin/next.config.mjs`
- Modify: `apps/web/next-config.test.mjs`
- Create: `apps/admin/next-config.test.mjs`
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/web/lib/api/client.test.ts`
- Modify: `apps/web/lib/media/upload-url.ts`
- Create: `apps/web/lib/media/upload-url.test.ts`
- Modify: `apps/admin/lib/admin-api.ts`
- Modify: `apps/admin/lib/admin-api.test.ts`
- Create: `apps/web/open-next.config.ts`
- Create: `apps/admin/open-next.config.ts`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/admin/wrangler.jsonc`
- Create: `apps/web/public/_headers`
- Create: `apps/admin/public/_headers`
- Modify: `.gitignore`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: public API/storage/site variables at build time and provider runtime variables preserved with `--keep-vars`.
- Produces: Cloudflare Workers `smp-customer-web` and `smp-admin-web`.

- [ ] **Step 1: Extend failing Next config tests**

For both applications, set `CLOUDFLARE_DEPLOYMENT=true`, import the config, and
assert:

```js
expect(nextConfig.images?.unoptimized).toBe(true);
```

Keep the existing API proxy ownership assertion. Run both focused tests and
confirm failure.

- [ ] **Step 2: Install locked OpenNext tooling**

```powershell
corepack pnpm --filter @surgical/web add @opennextjs/cloudflare@1.20.1
corepack pnpm --filter @surgical/web add --save-dev wrangler@4.112.0
corepack pnpm --filter @surgical/admin add @opennextjs/cloudflare@1.20.1
corepack pnpm --filter @surgical/admin add --save-dev wrangler@4.112.0
```

- [ ] **Step 3: Add package scripts**

Add to both applications:

```json
"prebuild": "corepack pnpm --dir ../.. --filter @surgical/config --filter @surgical/types --filter @surgical/ui build",
"cf:build": "opennextjs-cloudflare build",
"cf:deploy": "opennextjs-cloudflare deploy -- --keep-vars",
"cf:preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"cf:typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```

- [ ] **Step 4: Update Next configuration**

Import and invoke:

```js
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
```

Set:

```js
images: {
  ...existingImageConfiguration,
  unoptimized: process.env.CLOUDFLARE_DEPLOYMENT === "true"
}
```

Do not use the Cloudflare Images binding on the Free plan.

Extend the existing managed backend host suffixes from Railway-only to include
Northflank's official `.code.run` suffix. Add tests proving browser API calls
for a `.code.run` origin use `/api/v1`, while server-side proxy calls still use
the configured HTTPS upstream. Configure API CORS for both Cloudflare frontend
origins as defense in depth.

- [ ] **Step 5: Add OpenNext and Wrangler configuration**

Each OpenNext file contains:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

Customer Wrangler configuration:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "smp-customer-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-07-19",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "binding": "ASSETS",
    "directory": ".open-next/assets"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "smp-customer-web"
    }
  ],
  "observability": { "enabled": true }
}
```

Admin uses the same shape with `smp-admin-web` as its name and self-reference
service. Do not add Images, R2 cache, D1, or Durable Object bindings to the
initial free deployment.

- [ ] **Step 6: Add immutable static-asset headers and ignores**

Each `_headers` file contains:

```text
/_next/static/*
  Cache-Control: public,max-age=31536000,immutable
```

Ignore `**/.open-next/`, `**/.wrangler/`, and generated
`**/cloudflare-env.d.ts`.

- [ ] **Step 7: Run tests and OpenNext builds**

```powershell
corepack pnpm --filter @surgical/web test
corepack pnpm --filter @surgical/admin test
$env:CLOUDFLARE_DEPLOYMENT='true'
$env:NEXT_PUBLIC_API_URL='https://api.example.com/api/v1'
$env:NEXT_PUBLIC_STORAGE_PUBLIC_URL='https://uploads.example.com'
$env:NEXT_PUBLIC_SITE_URL='https://shop.example.com'
corepack pnpm --filter @surgical/web cf:build
corepack pnpm --filter @surgical/admin cf:build
```

- [ ] **Step 8: Enforce Cloudflare Free-plan bundle limits**

Run Wrangler dry runs against the generated outputs and record compressed
sizes. Each compressed Worker must be below 3 MiB. If either exceeds the limit,
stop Cloudflare deployment, identify the largest bundled modules, and optimize
first. If it cannot fit, present the free Netlify fallback for explicit user
approval before changing providers. Do not enable a paid Workers plan.

- [ ] **Step 9: Commit**

```powershell
git add .gitignore pnpm-lock.yaml apps/web apps/admin
git commit -m "build: package Next.js apps for Cloudflare Workers"
```

---

### Task 5: Production CI/CD Workflows

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-production.yml`
- Create: `.github/workflows/bootstrap-production.yml`
- Create: `scripts/workflow-contract.test.mjs`

**Interfaces:**

- Consumes GitHub production secrets:
  `CLOUDFLARE_API_TOKEN`, `NEON_DIRECT_DATABASE_URL`,
  `NORTHFLANK_API_TOKEN`, and `SEED_SUPER_ADMIN_PASSWORD`.
- Consumes GitHub production variables:
  `NORTHFLANK_PROJECT_ID`, `NORTHFLANK_API_SERVICE_ID`,
  `NORTHFLANK_WORKER_SERVICE_ID`, `CLOUDFLARE_ACCOUNT_ID`, `API_BASE_URL`,
  `CUSTOMER_WEB_URL`, `ADMIN_WEB_URL`, `NEXT_PUBLIC_SITE_URL`,
  `STORAGE_PUBLIC_BASE_URL`, and the non-secret super-admin identity fields.
- Produces named CI, exact-SHA automatic deployment after successful main CI,
  and manual bootstrap.

- [ ] **Step 1: Write failing workflow contract tests**

The test reads YAML as text and asserts:

- CI runs on pushes to `main`;
- production deploy triggers only from completed workflow `CI`;
- production job rejects failed CI, non-push events, and non-main branches;
- checkout uses `github.event.workflow_run.head_sha`;
- API deploy needs migration;
- worker deploy needs API and API readiness;
- frontend deploys need worker;
- smoke tests need both frontends;
- the normal deploy never contains `pnpm seed`;
- bootstrap uses only `workflow_dispatch`, requires a confirmation input, runs
  migrate then seed then `verify:fresh-bootstrap`;
- workflows use `permissions: contents: read`;
- no workflow uses `pull_request_target` or prints environment values.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --test scripts/workflow-contract.test.mjs
```

- [ ] **Step 3: Keep CI authoritative and cached**

Keep `name: CI` and its `push` trigger for `main`, `staging`, and `develop`.
Configure `actions/setup-node@v4`:

```yaml
with:
  node-version: 22
  cache: pnpm
  cache-dependency-path: pnpm-lock.yaml
```

Set `permissions: contents: read`. Keep install, lint, typecheck, test, and
build. Add container-contract and OpenNext/Wrangler dry-run validation so a
successful `CI` conclusion means the exact commit is deployable on free plans.

- [ ] **Step 4: Add the ordered production workflow**

Use:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

concurrency:
  group: production
  cancel-in-progress: false

permissions:
  contents: read
```

The release job guard must require successful `push` CI on `main`. Checkout
`github.event.workflow_run.head_sha`, never `main`, `latest`, or `github.sha`.

Jobs:

1. `migrate` uses the production environment and runs Prisma generate,
   validate, and migrate deploy with `DATABASE_URL` mapped from the Neon
   direct secret.
2. `deploy_api` invokes `deploy:northflank` for the API service and the exact
   successful CI SHA.
3. `api_readiness` performs a retrying HTTPS GET to
   `${{ vars.API_BASE_URL }}/health/ready` and requires `status=ready`.
4. `deploy_worker` invokes the same client for the worker, then runs
   `node dist/healthcheck.js` inside that service through Northflank's
   JavaScript client and requires exit code zero.
5. `deploy_web` and `deploy_admin` install once per job and run their
   `cf:deploy` scripts with Cloudflare authentication plus public build
   variables.
6. `smoke` checks API readiness, customer/admin roots, and each frontend's
   `/api/v1/health/ready` path or documented direct-API behavior.

Every provider job uses `environment: production`.

- [ ] **Step 5: Add manual fresh bootstrap**

Use a `workflow_dispatch` input:

```yaml
inputs:
  confirmation:
    description: Type BOOTSTRAP_FRESH_PRODUCTION
    required: true
    type: string
```

Fail unless the input matches exactly. Then generate Prisma, validate, migrate,
run `verify:fresh-bootstrap -- --phase=before`, run the API seed, and run
`verify:fresh-bootstrap -- --phase=after`. Map the password as a secret and the
super-admin identity as environment variables without echoing them. Normal
production deployment must not reference the seed command.

- [ ] **Step 6: Run workflow contract and repository tests**

```powershell
node --test scripts/workflow-contract.test.mjs
corepack pnpm test
```

- [ ] **Step 7: Commit**

```powershell
git add .github/workflows scripts/workflow-contract.test.mjs
git commit -m "ci: deploy provider-neutral production stack"
```

---

### Task 6: Provider-Neutral Runbook and Environment Contracts

**Files:**

- Modify: `docs/deployment.md`
- Create: `infra/northflank/README.md`
- Modify: `apps/api/.env.example`
- Modify: `apps/worker/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `apps/admin/.env.example`
- Modify: `docs/superpowers/specs/2026-07-17-smp-aws-initial-production-deployment-design.md`
- Modify: `docs/superpowers/plans/2026-07-17-smp-aws-initial-production-deployment.md`
- Create: `scripts/provider-docs-contract.test.mjs`

**Interfaces:**

- Consumes: final repository and workflow names.
- Produces: reproducible dashboard setup and a clearly retired AWS path.

- [ ] **Step 1: Write failing documentation contract tests**

Assert that:

- `docs/deployment.md` names Cloudflare, Northflank, Neon, and R2;
- it contains no active Vercel or AWS deployment instruction;
- `STORAGE_PROVIDER=s3`, `S3_REGION=auto`, and an R2 endpoint are documented;
- Northflank API/worker Dockerfile paths match real files;
- normal release says migrate but never seed;
- both AWS documents begin with a superseded warning linking the new design;
- examples contain placeholders only and no account IDs, tokens, passwords, or
  live URLs.

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
node --test scripts/provider-docs-contract.test.mjs
```

- [ ] **Step 3: Rewrite the deployment runbook**

Document:

- account/project/resource creation order;
- fresh Neon creation and direct versus pooled URLs;
- Northflank Redis addon and shared API/worker secret group;
- R2 bucket, S3 API credentials, public URL, and CORS;
- Cloudflare Worker variables;
- GitHub production secrets and variables;
- branch protection;
- one-time bootstrap;
- normal release and rollback;
- free-tier quotas;
- Northflank's explicit developer-sandbox/non-production limitation;
- verification and troubleshooting.

- [ ] **Step 4: Add exact Northflank dashboard settings**

Record:

```text
smp-api
  type: combined service
  branch: main
  docker context: /
  dockerfile: /infra/docker/api.Dockerfile
  CI: disabled
  CD: enabled
  public port: 4000 HTTP
  readiness: GET /api/v1/health/ready

smp-worker
  type: combined service
  branch: main
  docker context: /
  dockerfile: /infra/docker/worker.Dockerfile
  CI: disabled
  CD: enabled
  public ports: none
  readiness: CMD node dist/healthcheck.js

smp-redis
  type: Redis addon
  linked to the shared runtime secret group
```

- [ ] **Step 5: Mark AWS documents superseded**

Add only:

```markdown
> **Superseded on 2026-07-19.** Do not execute this AWS deployment. Use
> [SMP Provider-Neutral Free Deployment Design](../specs/2026-07-19-smp-provider-neutral-free-deployment-design.md).
```

Use the correct relative link from each document.

- [ ] **Step 6: Run tests and commit**

```powershell
node --test scripts/provider-docs-contract.test.mjs
corepack pnpm test
git add docs infra/northflank apps/api/.env.example apps/worker/.env.example apps/web/.env.example apps/admin/.env.example scripts/provider-docs-contract.test.mjs
git commit -m "docs: add provider-neutral deployment runbook"
```

---

### Task 7: Complete Local Verification Gate

**Files:**

- Modify only files required to fix verified failures from Tasks 1-6.

- [ ] **Step 1: Run formatting checks**

```powershell
git diff --check
corepack pnpm exec prettier --check .
```

- [ ] **Step 2: Run repository quality**

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

- [ ] **Step 3: Run deployment-specific validation**

```powershell
node --test scripts/deploy-northflank.test.mjs scripts/container-contract.test.mjs scripts/workflow-contract.test.mjs scripts/provider-docs-contract.test.mjs
docker build --file infra/docker/api.Dockerfile --tag smp-api:verify .
docker build --file infra/docker/worker.Dockerfile --tag smp-worker:verify .
```

- [ ] **Step 4: Build both Cloudflare Workers and verify limits**

Build with non-secret placeholder public URLs. Run Wrangler dry-run output and
record compressed sizes. Confirm each is less than 3 MiB.

- [ ] **Step 5: Review the complete diff**

Confirm:

- no credential-like value is staged;
- no AWS deployment action was added;
- normal deploy cannot seed;
- main deploy order matches the approved spec;
- `AGENTS.md` remains untracked and unchanged.

- [ ] **Step 6: Commit verified fixes**

Use a scoped commit only if verification required changes:

```powershell
git add <verified-fix-files>
git commit -m "fix: satisfy provider deployment verification"
```

---

### Task 8: Provision Free Provider Resources

**Files:**

- No repository changes unless a provider-generated opaque ID must be recorded
  in a non-secret example. Prefer GitHub variables and provider dashboards.

- [ ] **Step 1: Discover connected tools**

Use the installed Cloudflare and GitHub plugins. Use the authenticated Edge
session for Northflank and Neon. Never copy credentials into chat or terminal
output.

- [ ] **Step 2: Create fresh Neon**

Create PostgreSQL 18 project `smp-production`. Capture direct and pooled URLs
into their intended secret stores without printing them. Do not import data.

- [ ] **Step 3: Create Northflank project resources**

Create project, `smp-redis`, runtime secret group, `smp-api`, and `smp-worker`
using the exact runbook settings. Use free plans only. Do not enable automatic
Git CI.

- [ ] **Step 4: Create Cloudflare R2 and Workers**

Create empty R2 Standard bucket `smp-production-uploads`, an S3 API credential
scoped to that bucket, and Worker projects matching the Wrangler names. Keep
paid Workers disabled.

- [ ] **Step 5: Configure cross-provider variables**

Set:

- Northflank runtime secrets for Neon, Redis, R2, auth, Razorpay, CORS, and
  production validation;
- Cloudflare public/runtime variables for API, storage, site, and app
  environment;
- R2 CORS for the two frontend origins if direct browser reads require it.

- [ ] **Step 6: Verify empty state**

Confirm:

- Neon has no imported application data before bootstrap;
- Redis contains no inherited keys;
- R2 contains zero inherited objects.

---

### Task 9: Configure GitHub Release Control

**Files:**

- No local files unless live validation finds a workflow defect.

- [ ] **Step 1: Push the implementation branch**

Push only after local verification is green. Create a PR and require the CI
quality check.

- [ ] **Step 2: Create GitHub production environment**

Use the GitHub plugin to create/configure the `production` environment when
supported. Add secrets and variables through secure UI/tool inputs; never
display values.

- [ ] **Step 3: Protect main**

Require the CI quality check before merge and disallow force pushes. Preserve
the user's repository access model.

- [ ] **Step 4: Merge the verified PR**

Merge only after CI succeeds. The production workflow should then start for
the exact merge SHA.

---

### Task 10: Bootstrap, Deploy, and Live Verification

**Files:**

- Modify only files required by evidence from a failed live check.

- [ ] **Step 1: Run the protected bootstrap once**

Dispatch `bootstrap-production.yml` with exact confirmation. Verify migrations,
seed, and fresh-state assertion succeed.

- [ ] **Step 2: Verify fresh business state**

Confirm product and warehouse counts remain zero. Confirm the intended
super-admin can authenticate without logging credentials.

Remove `SEED_SUPER_ADMIN_PASSWORD` from the GitHub production environment
immediately after the one-time bootstrap succeeds. Remove or clear other
one-time bootstrap identity values that are not needed by normal releases.

- [ ] **Step 3: Run or rerun production deployment**

Ensure migration, API, health, worker, customer, admin, and smoke jobs complete
in order for the same Git SHA.

- [ ] **Step 4: Run functional smoke tests**

Verify:

- `GET /api/v1/health`;
- customer homepage;
- repeated dynamic customer catalog/detail requests while reviewing Worker CPU
  metrics and confirming no error 1102;
- admin login page;
- admin login;
- empty product management state;
- empty warehouse management state;
- API-to-Neon and API/worker-to-Redis connectivity;
- a new upload reaches the empty R2 bucket.

- [ ] **Step 5: Verify automatic update**

Make a harmless documentation-only commit that does not require a runtime
deployment, or a controlled runtime marker change when approved, and confirm
CI/CD path behavior and path gating. Do not create meaningless production code
changes solely for testing.

- [ ] **Step 6: Final evidence**

Record:

- commit SHA;
- CI run URL and status;
- provider deployment URLs;
- API health result;
- worker deployment/readiness status;
- Cloudflare compressed bundle sizes;
- zero starting product and warehouse counts;
- residual free-tier risks and any unverified custom-domain work.
- observed Cloudflare CPU behavior, explicitly recorded as residual risk when
  the dashboard cannot prove every dynamic route remains within 10 ms.
