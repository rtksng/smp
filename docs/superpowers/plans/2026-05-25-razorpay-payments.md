# Razorpay Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-focused Razorpay payments module with customer-scoped online payment creation, verification, webhook processing, raw webhook storage, idempotent state transitions, and refund placeholder support.

**Architecture:** Add `PaymentsModule` under `apps/api/src/modules/payments` and wire it into `AppModule`. Keep gateway logic out of `OrdersService`; use the existing order/payment rows created during checkout and transactionally update payment/order state inside `PaymentsService`.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Node `crypto`, Node `fetch`, class-validator, Swagger, node:test.

---

### Task 1: Schema and Environment

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260525000800_razorpay_payment_idempotency/migration.sql`
- Modify: `apps/api/src/config/api.config.ts`
- Modify: `.env.example`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add schema fields and uniqueness**

Add nullable unique provider ids and `providerAmountPaise` to `Payment`, plus raw/event fields to `PaymentWebhook`.

- [ ] **Step 2: Add SQL migration**

Add the `Payment.providerAmountPaise` column, unique indexes for `Payment.providerOrderId`, `Payment.providerPaymentId`, and `PaymentWebhook.providerEventId`, plus `providerEventId` and `rawPayload` columns.

- [ ] **Step 3: Add environment config**

Expose `razorpayKeyId`, `razorpayKeySecret`, and `razorpayWebhookSecret` through `loadApiEnvironment()` with required env validation.

### Task 2: Write Payment Tests First

**Files:**
- Create: `apps/api/test/payments/payments.service.test.ts`

- [ ] **Step 1: Write failing tests**

Write node:test cases for create-order ownership, invalid order state, verify success/failure, duplicate payment prevention, webhook invalid signature, and webhook duplicate event idempotency.

- [ ] **Step 2: Run tests and confirm RED**

Run: `corepack pnpm --filter @surgical/api test -- test/payments/payments.service.test.ts`

Expected: tests fail because `PaymentsService` does not exist.

### Task 3: Payment Module Implementation

**Files:**
- Create: `apps/api/src/modules/payments/payments.module.ts`
- Create: `apps/api/src/modules/payments/payments.controller.ts`
- Create: `apps/api/src/modules/payments/payments.service.ts`
- Create: `apps/api/src/modules/payments/razorpay.client.ts`
- Create: `apps/api/src/modules/payments/dto/payment.dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Add DTOs**

Define `CreateRazorpayOrderDto`, `VerifyRazorpayPaymentDto`, response DTOs, and webhook response DTOs with class-validator and Swagger decorators.

- [ ] **Step 2: Add Razorpay client**

Create orders with `fetch("https://api.razorpay.com/v1/orders")`, JSON payload, and Basic Auth from env config.

- [ ] **Step 3: Add PaymentsService**

Implement customer ownership checks, valid state checks, paise conversion, signature verification, transactions, webhook storage, idempotency, and refund placeholder creation.

- [ ] **Step 4: Add PaymentsController**

Expose the three required routes. Use `CustomerJwtGuard` on create-order and verify only. Use `@RawBody()` for webhook signature verification.

- [ ] **Step 5: Enable raw body capture**

Set `rawBody: true` in `NestFactory.create()` so the webhook can verify the exact signed request body.

- [ ] **Step 6: Wire module into app**

Import `PaymentsModule` in `AppModule`.

### Task 4: Generate Prisma and Make Tests Green

**Files:**
- Generated: `apps/api/src/generated/prisma/**`

- [ ] **Step 1: Generate Prisma client**

Run: `corepack pnpm --filter @surgical/api prisma:generate`

- [ ] **Step 2: Run payment tests and fix failures**

Run: `corepack pnpm --filter @surgical/api test -- test/payments/payments.service.test.ts`

Expected: all payment tests pass.

### Task 5: Documentation and Full Verification

**Files:**
- Modify: `apps/api/README.md`

- [ ] **Step 1: Document payment routes and env**

Add the three payment routes, Razorpay env vars, and runtime notes for COD separation, raw webhook storage, and idempotency.

- [ ] **Step 2: Run full API tests**

Run: `corepack pnpm --filter @surgical/api test`

- [ ] **Step 3: Run repository lint**

Run: `corepack pnpm lint`

- [ ] **Step 4: Run repository typecheck**

Run: `corepack pnpm typecheck`

- [ ] **Step 5: Run repository build**

Run: `corepack pnpm build`

Expected: lint, typecheck, and build complete successfully.

## Self-Review

The plan covers every approved requirement: controller routes, service-owned state transitions, env-only Razorpay client, stored paise amount handling, ownership/security checks, raw webhook storage, signature verification, idempotency constraints, DTO/Swagger docs, tests, README, and final verification. The repo has no git metadata, so commit steps are intentionally omitted.
