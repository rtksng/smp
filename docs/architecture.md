# Architecture Overview

## Scope

The platform currently contains a customer website, admin dashboard, backend API, database, and background worker.

This phase intentionally excludes:

- Delivery partner web app
- Customer mobile app
- Delivery mobile app

The future customer mobile app will reuse customer APIs. The future delivery partner mobile app will use delivery partner APIs. Delivery management belongs in the admin dashboard, not in a separate delivery web app.

## Workspace Layout

- `apps/web`: Next.js customer website
- `apps/admin`: Next.js admin dashboard
- `apps/api`: NestJS REST API under `/api/v1`
- `apps/worker`: NestJS/BullMQ worker
- `packages/ui`: shared React UI components
- `packages/types`: shared TypeScript interfaces
- `packages/config`: shared constants
- `infra/docker`: local infrastructure definitions

## Backend Boundaries

Authentication is separated by audience:

- Customer auth
- Admin auth
- Delivery partner auth

Admin authorization should use role-based permissions. Warehouse staff and inventory operations must enforce warehouse-level access control.

## Data and Infrastructure

- PostgreSQL is the primary database.
- Prisma owns schema and migrations.
- Redis supports cache, queues, OTP, sessions, and rate limiting.
- BullMQ handles background jobs through `apps/worker`.

## Verification

Every implementation should finish with:

```bash
pnpm lint
pnpm typecheck
pnpm build
```
