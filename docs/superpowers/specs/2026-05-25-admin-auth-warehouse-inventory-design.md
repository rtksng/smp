# Admin Auth, Warehouse, and Inventory Design

## Goal

Build a real admin authentication shell before adding warehouse and inventory operations, then wire warehouse and inventory management through permission-aware and warehouse-scoped backend APIs.

## Scope

Included:

- Admin login, persistent client session, protected admin routes, token refresh rotation, automatic bearer token injection, permission-aware UI, and logout.
- Admin warehouse CRUD, activation, deactivation, safe soft delete, warehouse staff assignments, and staff assignment audit logs.
- Admin inventory stock-in, adjustment, transfer, listing, low-stock query, near-expiry query, stock movement audit trail, and admin audit logs.

Excluded:

- Delivery partner web app.
- Customer mobile app.
- Delivery mobile app.
- Temporary token-based admin clients.

## Architecture

The admin app uses the existing backend admin auth endpoints under `/api/v1/auth/admin`. A client-side session provider persists the admin profile, JWT access token, refresh token, and token expiry data. All admin API calls go through one API client that injects the access token, refreshes once on expiry or unauthorized responses, rotates the refresh token, and clears the session on refresh failure.

Backend authorization remains authoritative. Admin endpoints use `AdminJwtGuard`, `PermissionGuard`, and `@RequirePermission(...)`. Warehouse-scoped inventory operations additionally use `WarehouseAccessService`: `SUPER_ADMIN` can access all warehouses, while non-super-admin admins can only mutate or view inventory for assigned warehouses.

Warehouse and inventory changes are handled in focused Nest modules backed by Prisma transactions. Stock changes update aggregate `InventoryStock`, optional `StockBatch` rows, and immutable `StockMovement` records in the same transaction. Transfers create paired movement records: an `OUT` movement for the source warehouse and an `IN` movement for the destination warehouse. Reference fields preserve transfer context.

## Data Model

Existing warehouse and inventory tables are reused:

- `Warehouse`: name, unique code, address, city, state, pincode, latitude, longitude, contact person, contact number, status, soft-delete timestamp.
- `WarehouseStaff`: admin-to-warehouse assignments with soft-delete support.
- `InventoryStock`: per product, optional variant, and warehouse aggregate stock with reorder level.
- `StockBatch`: per product, optional variant, warehouse, batch number, expiry date, pricing, and batch quantity.
- `StockMovement`: stock audit trail with product, variant, warehouse, batch, movement type, quantity, reference type, reference id, notes, actor, and timestamps.
- `AdminAuditLog`: admin-facing audit records for warehouse, warehouse staff, and inventory changes.

`StockMovementType` is aligned to the required API language:

- `IN`
- `OUT`
- `ADJUSTMENT`
- `TRANSFER`
- `RETURN`

## Backend API

Warehouse endpoints:

- `POST /api/v1/admin/warehouses`
- `GET /api/v1/admin/warehouses`
- `GET /api/v1/admin/warehouses/:id`
- `PATCH /api/v1/admin/warehouses/:id`
- `PATCH /api/v1/admin/warehouses/:id/activate`
- `PATCH /api/v1/admin/warehouses/:id/deactivate`
- `DELETE /api/v1/admin/warehouses/:id`

Warehouse staff endpoints:

- `POST /api/v1/admin/warehouses/:id/staff`
- `GET /api/v1/admin/warehouses/:id/staff`
- `DELETE /api/v1/admin/warehouses/:id/staff/:staffId`

Inventory endpoints:

- `POST /api/v1/admin/inventory/stock-in`
- `POST /api/v1/admin/inventory/adjust`
- `POST /api/v1/admin/inventory/transfer`
- `GET /api/v1/admin/inventory`
- `GET /api/v1/admin/inventory/low-stock`
- `GET /api/v1/admin/inventory/near-expiry`
- `GET /api/v1/admin/inventory/movements`

## Permission Rules

- Warehouse create, update, activate, deactivate, and delete require `warehouse.manage`.
- Warehouse read endpoints require `warehouse.read`.
- Warehouse staff assignment endpoints require `warehouse.staff.manage`.
- Inventory list, low-stock, near-expiry, and movements require `inventory.read`.
- Inventory stock-in, adjustment, and transfer require `inventory.update`.
- UI hides unavailable actions and blocks protected pages for missing permissions, but backend guards are the source of truth.
- Non-super-admin inventory access is restricted to assigned warehouses.

## Stock Rules

- Stock changes run inside Prisma transactions.
- Aggregate stock cannot become negative.
- Batch quantity cannot become negative.
- Stock-in creates or updates a batch and increases aggregate stock.
- Adjustment applies a signed quantity delta and writes an `ADJUSTMENT` movement.
- Transfer validates source stock and optional source batch, decreases source stock, increases destination stock, and writes paired source `OUT` and destination `IN` movement records with the same transfer reference id.
- Low-stock returns aggregate stock at or below reorder level.
- Near-expiry returns non-deleted batch records with positive quantity and expiry dates within the query window.

## Admin UI

The admin app adds:

- `/login`: real admin login page using `/auth/admin/login`.
- Protected root dashboard shell with sidebar navigation, admin identity, permission-aware navigation, and logout.
- Session provider and API client in the admin app.
- Warehouses screen with list, detail/edit controls, status actions, and staff assignment controls when permitted.
- Inventory screen with stock list, low-stock, near-expiry, movements, stock-in, adjustment, and transfer controls when permitted.

## Testing And Verification

Backend service tests cover:

- Warehouse permission metadata and safe deletion.
- Warehouse code uniqueness handling.
- Warehouse staff assignment and audit logging.
- Non-super-admin warehouse scoping.
- Stock-in transaction writes aggregate stock, batch, movement, and audit log.
- Negative-stock prevention.
- Transfer paired movement records and source/destination stock updates.
- Low-stock and near-expiry filters.

Frontend tests are not currently configured for Next UI. Typecheck and build verify the admin auth shell and UI wiring. Manual runtime testing can be done through the admin app once local seed credentials and API are running.

Required final verification:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

## Constraints

- No hardcoded secrets or environment-specific credentials.
- No temporary token client.
- No new delivery partner web app or mobile app surfaces.
- README files must be updated for the major feature.
- Because the current workspace has no `.git` directory, the spec and implementation cannot be committed from this environment.
