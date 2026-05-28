# Admin Auth, Warehouse, and Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full admin session handling, protected admin UI, and permission-aware warehouse and inventory management.

**Architecture:** Reuse existing Nest admin auth endpoints for login, refresh, and logout. Add Nest warehouse and inventory controllers/services with Prisma transactions, admin permissions, warehouse-level access control, DTO validation, Swagger documentation, and audit logs. Add a client-side Next admin session provider and authenticated API client used by warehouse and inventory pages.

**Tech Stack:** TypeScript, pnpm workspaces, Next.js, NestJS, Prisma, PostgreSQL, class-validator, Swagger.

---

### Task 1: Backend Warehouse API

**Files:**

- Create: `apps/api/src/modules/warehouses/dto/warehouse.dto.ts`
- Create: `apps/api/src/modules/warehouses/warehouses.service.ts`
- Create: `apps/api/src/modules/warehouses/admin-warehouses.controller.ts`
- Modify: `apps/api/src/modules/warehouses/warehouses.module.ts`
- Test: `apps/api/test/warehouses/warehouses.service.test.ts`

- [ ] Write failing tests for warehouse create/update/list/detail/status/safe-delete, permission metadata, staff assignment, and audit logs.
- [ ] Run `pnpm --filter @surgical/api test` and verify the new tests fail because the service/controller files do not exist.
- [ ] Implement DTOs, service, controller, module exports, and audit-log helper.
- [ ] Run `pnpm --filter @surgical/api test` and verify the warehouse tests pass.

### Task 2: Backend Inventory API

**Files:**

- Create: `apps/api/src/modules/inventory/dto/inventory.dto.ts`
- Create: `apps/api/src/modules/inventory/inventory.service.ts`
- Create: `apps/api/src/modules/inventory/admin-inventory.controller.ts`
- Create: `apps/api/src/modules/inventory/inventory.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260525000500_align_stock_movement_types/migration.sql`
- Test: `apps/api/test/inventory/inventory.service.test.ts`

- [ ] Write failing tests for stock-in, adjustment negative-stock rejection, transfer paired movements, low-stock, near-expiry, movement listing, and warehouse scoping.
- [ ] Run `pnpm --filter @surgical/api test` and verify the new tests fail because the inventory module does not exist and enum values are not aligned.
- [ ] Update Prisma enum to `IN`, `OUT`, `ADJUSTMENT`, `TRANSFER`, `RETURN` and add migration SQL.
- [ ] Implement DTOs, service, controller, module import, transactional stock mutations, and audit logs.
- [ ] Run `pnpm --filter @surgical/api prisma:generate`.
- [ ] Run `pnpm --filter @surgical/api test` and verify inventory tests pass.

### Task 3: Admin Auth Shell

**Files:**

- Create: `apps/admin/lib/admin-api.ts`
- Create: `apps/admin/lib/admin-session.tsx`
- Create: `apps/admin/lib/permissions.ts`
- Create: `apps/admin/app/login/page.tsx`
- Create: `apps/admin/app/admin-shell.tsx`
- Modify: `apps/admin/app/layout.tsx`
- Modify: `apps/admin/app/page.tsx`
- Modify: `apps/admin/app/globals.css`

- [ ] Implement typed API envelope handling for existing backend response format.
- [ ] Implement client-side session persistence with access token, refresh token, expiry data, admin profile, automatic bearer injection, refresh rotation, and logout.
- [ ] Add `/login` page that calls `/auth/admin/login`.
- [ ] Add protected dashboard shell that redirects unauthenticated admins to `/login`.
- [ ] Add permission helpers and permission-aware navigation/action visibility.
- [ ] Run `pnpm --filter @surgical/admin typecheck` and fix errors.

### Task 4: Admin Warehouse And Inventory UI

**Files:**

- Create: `apps/admin/app/warehouses/page.tsx`
- Create: `apps/admin/app/inventory/page.tsx`
- Modify: `apps/admin/app/globals.css`

- [ ] Add warehouse list/create/edit/status/staff assignment UI using the authenticated API client.
- [ ] Hide or block warehouse management actions unless the admin has the required permission.
- [ ] Add inventory tabs for stock, low-stock, near-expiry, and movements.
- [ ] Add stock-in, adjustment, and transfer forms gated by `inventory.update`.
- [ ] Run `pnpm --filter @surgical/admin typecheck` and fix errors.

### Task 5: Documentation And Final Verification

**Files:**

- Modify: `README.md`
- Modify: `apps/api/README.md`

- [ ] Update setup and route documentation for admin auth shell, warehouse endpoints, and inventory endpoints.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Fix every error and rerun failed verification commands.
