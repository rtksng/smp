# Surgical Medical Equipment Platform

Production-ready pnpm monorepo for a surgical and medical equipment commerce platform.

## Current Scope

- Customer website: `apps/web`
- Admin dashboard: `apps/admin`
- Backend API: `apps/api`
- Background worker: `apps/worker`
- Delivery partner mobile app: `apps/delivery`
- Shared UI, types, and config packages

## Tech Stack

- pnpm workspaces
- Next.js and TypeScript for customer and admin frontends
- NestJS and TypeScript for the backend API
- NestJS, BullMQ, and Redis for background jobs
- Expo, React Native, and Expo Router for the delivery partner app
- PostgreSQL with Prisma ORM
- Shared packages for UI, types, and config

## Setup

Use this when setting the project up on a new local machine from Git. The
commands below assume a terminal at the repository root.

### Prerequisites

- Git
- Node.js 20 or newer
- PostgreSQL 16 or newer running locally
- Redis 7 or a Redis-compatible server running locally
- Corepack-enabled pnpm `9.15.4`

Install pnpm through Corepack if pnpm is not already available:

   ```bash
   corepack enable
   corepack prepare pnpm@9.15.4 --activate
   ```

### Fresh Local Setup

1. Install dependencies:

   ```bash
   corepack pnpm install
   ```

2. Copy environment files:

   ```bash
   cp .env.example .env
   cp apps/web/.env.example apps/web/.env.local
   cp apps/admin/.env.example apps/admin/.env.local
   cp apps/api/.env.example apps/api/.env
   cp apps/worker/.env.example apps/worker/.env
   ```

   PowerShell equivalent:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item apps/web/.env.example apps/web/.env.local
   Copy-Item apps/admin/.env.example apps/admin/.env.local
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/worker/.env.example apps/worker/.env
   ```

3. Review local database and Redis env URLs.

   By default the examples use PostgreSQL on `localhost:5432` and Redis on
   `localhost:6379`:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/surgical_platform?schema=public
   REDIS_URL=redis://localhost:6379
   ```

   If another PostgreSQL server is already using `5432`, set this project to
   your actual native PostgreSQL port in `.env`, `apps/api/.env`, and
   `apps/worker/.env`:

   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/surgical_platform?schema=public
   ```

   Keep these values aligned across the root, API, and worker env files:

   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `REDIS_QUEUE_PREFIX`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `RAZORPAY_*` values

4. Create the local PostgreSQL database and make sure Redis is running.

   PostgreSQL example:

   ```bash
   createdb -h localhost -U postgres surgical_platform
   ```

   If the database already exists, leave it in place and continue with Prisma
   migrations. The app does not start PostgreSQL or Redis for you; they must be
   running as native local services before starting the API or worker.

5. Generate the Prisma client:

   ```bash
   corepack pnpm --filter @surgical/api prisma:generate
   ```

6. Apply Prisma migrations:

   ```bash
   corepack pnpm --filter @surgical/api exec prisma migrate dev --schema ./prisma/schema.prisma
   ```

7. Seed default access control, the fixed product category tree, and fixed brands:

   ```bash
   corepack pnpm --filter @surgical/api seed
   ```

   The catalog seed creates the fixed top-level categories and their
   subcategories, including Dental, Diagnostics, Consumables, Equipment,
   Orthopedics, Ophthalmology, Nephrology, Pharma, Cardiology, Physiotherapy,
   Vaccines, and IVF/Gynae. Vaccines and Orthopedics currently have no
   required subcategories. It also creates the fixed brands Mb+, Abbott,
   Contec, Volk, Orikam, Healthium, GC, and J.Mitra.

8. Run development services:

   ```bash
   corepack pnpm dev
   ```

   The root dev command starts the API and worker first, waits for
   `http://localhost:4000/api/v1/health`, and only then starts the customer
   website and admin dashboard. This keeps the customer catalogue pages and
   admin login from rendering before the backend is ready.

   If you want the local customer and admin frontends to use the deployed
   Railway API instead of starting local API, PostgreSQL, and Redis, set
   `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` and `apps/admin/.env.local`
   to the Railway API base URL, then start only the frontends:

   ```bash
   corepack pnpm dev:frontends
   ```

   Do not use `corepack pnpm dev` for the Railway-backed frontend-only flow.
   That command intentionally starts the local API and worker, which require
   reachable `DATABASE_URL` and `REDIS_URL` values.

   Local app URLs:

   - Customer web: `http://localhost:3000`
   - Admin dashboard: `http://localhost:3001`
   - API: `http://localhost:4000/api/v1`
   - API docs: `http://localhost:4000/api/docs`

   Seeded admin login email:

   - `superadmin@admin.com`

   The password comes from `SEED_SUPER_ADMIN_PASSWORD` in `apps/api/.env`.

### Clone With Existing Database And Uploaded Images

Use this path when you want the new machine to have the same products,
customers, orders, catalog images, and uploaded documents as the old machine.
Git alone moves code; it does not move PostgreSQL rows or ignored upload files.

Copy three things to the new machine:

1. Git code from this repository.
2. A PostgreSQL dump from the old machine.
3. The runtime upload folder from the old machine:

   ```text
   apps/api/storage/uploads
   ```

On the old machine, create a database dump from native PostgreSQL:

```powershell
pg_dump -h localhost -U postgres -d surgical_platform --format=custom --file=.\surgical_platform.dump
```

Copy `surgical_platform.dump` and `apps/api/storage/uploads` to the new
machine. After cloning the code and creating the native PostgreSQL database on
the new machine, restore the database:

```powershell
createdb -h localhost -U postgres surgical_platform
pg_restore -h localhost -U postgres -d surgical_platform --clean --if-exists .\surgical_platform.dump
```

Then copy the upload folder into the same path on the new machine:

```powershell
robocopy .\uploads .\apps\api\storage\uploads /MIR
```

After a restore, run Prisma generate and start the app. Do not run the seed
script over a restored production-like database unless you intentionally want to
add or repair seed records.

## Common Commands

```bash
corepack pnpm dev
corepack pnpm dev:frontends
corepack pnpm dev:parallel
corepack pnpm dev:web
corepack pnpm dev:admin
corepack pnpm dev:api
corepack pnpm dev:worker
corepack pnpm --filter @surgical/delivery dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm -r --sort --if-present test
corepack pnpm build
corepack pnpm format
```

## Quality and Testing

- ESLint uses the root flat config in `eslint.config.mjs` across apps and packages.
- Prettier uses the root `.prettierrc.json` and `.prettierignore`.
- Backend unit examples live under `apps/api/test` for auth, products, cart, orders, warehouses, inventory, and related modules.
- API integration setup starts with `apps/api/test/integration/health.integration.test.ts`, which boots a Nest module and verifies the versioned HTTP health route without requiring PostgreSQL or Redis.
- Frontend component tests use Vitest, jsdom, and Testing Library through `apps/web/vitest.config.ts` and `apps/admin/vitest.config.ts`.
- CI is defined in `.github/workflows/ci.yml` and runs install, lint, typecheck, test, and build.

## API Rules

- REST endpoints live under `/api/v1`.
- Backend request payloads use DTO validation.
- Customer auth, admin auth, and delivery partner auth are separate modules.
- Admin features use role-based permissions.
- Inventory and warehouse staff flows must enforce warehouse-level access control.

## API Local Setup

The NestJS API lives in `apps/api` and uses `apps/api/.env` first, with the root `.env` as a fallback.

Required local API values:

```bash
NODE_ENV=development
API_PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/surgical_platform?schema=public
REDIS_URL=redis://localhost:6379
REDIS_QUEUE_PREFIX=surgical-platform
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
TRUST_PROXY=false
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_BLOCK_MS=60000
ERROR_MONITORING_ENABLED=false
ERROR_MONITORING_DSN=
JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-long-random-refresh-secret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
BCRYPT_SALT_ROUNDS=12
OTP_TTL_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_RATE_LIMIT=5
OTP_RATE_WINDOW_SECONDS=3600
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=storage/uploads
STORAGE_PUBLIC_PATH=uploads
STORAGE_PUBLIC_BASE_URL=http://localhost:4000/uploads
STORAGE_IMAGE_MAX_BYTES=5242880
STORAGE_DOCUMENT_MAX_BYTES=10485760
```

If your local PostgreSQL server uses a non-default port, update `DATABASE_URL`
here and in `apps/worker/.env` to use that port.

Useful API routes:

- Health: `GET http://localhost:4000/api/v1/health`
- Swagger/OpenAPI: `http://localhost:4000/api/docs`
- Customer auth: `POST http://localhost:4000/api/v1/auth/customer/request-otp`
- Customer profile:
  - `GET http://localhost:4000/api/v1/me`
  - `PATCH http://localhost:4000/api/v1/me`
- Customer addresses:
  - `GET http://localhost:4000/api/v1/me/addresses`
  - `POST http://localhost:4000/api/v1/me/addresses`
  - `PATCH http://localhost:4000/api/v1/me/addresses/:id`
  - `DELETE http://localhost:4000/api/v1/me/addresses/:id`
  - `PATCH http://localhost:4000/api/v1/me/addresses/:id/default`
- Customer cart:
  - `GET http://localhost:4000/api/v1/cart`
  - `POST http://localhost:4000/api/v1/cart/items`
  - `PATCH http://localhost:4000/api/v1/cart/items/:id`
  - `DELETE http://localhost:4000/api/v1/cart/items/:id`
  - `DELETE http://localhost:4000/api/v1/cart`
- Customer invoices:
  - `GET http://localhost:4000/api/v1/orders/:id/invoice`
  - `GET http://localhost:4000/api/v1/orders/:id/invoice?format=html`
- Admin auth: `POST http://localhost:4000/api/v1/auth/admin/login`
- Admin auth refresh/logout:
  - `POST http://localhost:4000/api/v1/auth/admin/refresh`
  - `POST http://localhost:4000/api/v1/auth/admin/logout`
- Admin access control:
  - `GET http://localhost:4000/api/v1/admin/roles`
  - `GET http://localhost:4000/api/v1/admin/roles/:code`
  - `GET http://localhost:4000/api/v1/admin/permissions`
  - `GET http://localhost:4000/api/v1/admin/admin-users`
  - `POST http://localhost:4000/api/v1/admin/admin-users`
  - `PATCH http://localhost:4000/api/v1/admin/admin-users/:id`
  - `DELETE http://localhost:4000/api/v1/admin/admin-users/:id`
- Admin catalog:
  - `GET http://localhost:4000/api/v1/admin/products`
  - `GET http://localhost:4000/api/v1/admin/products/:id`
  - `POST http://localhost:4000/api/v1/admin/products`
  - `PATCH http://localhost:4000/api/v1/admin/products/:id`
  - `DELETE http://localhost:4000/api/v1/admin/products/:id`
  - `GET http://localhost:4000/api/v1/admin/categories`
  - `POST http://localhost:4000/api/v1/admin/categories`
  - `PATCH http://localhost:4000/api/v1/admin/categories/:id`
  - `DELETE http://localhost:4000/api/v1/admin/categories/:id`
  - `GET http://localhost:4000/api/v1/admin/brands`
  - `POST http://localhost:4000/api/v1/admin/brands`
  - `PATCH http://localhost:4000/api/v1/admin/brands/:id`
  - `DELETE http://localhost:4000/api/v1/admin/brands/:id`
- Admin customers:
  - `GET http://localhost:4000/api/v1/admin/customers`
- Admin warehouses:
  - `POST http://localhost:4000/api/v1/admin/warehouses`
  - `GET http://localhost:4000/api/v1/admin/warehouses`
  - `GET http://localhost:4000/api/v1/admin/warehouses/:id`
  - `PATCH http://localhost:4000/api/v1/admin/warehouses/:id`
  - `PATCH http://localhost:4000/api/v1/admin/warehouses/:id/activate`
  - `PATCH http://localhost:4000/api/v1/admin/warehouses/:id/deactivate`
  - `DELETE http://localhost:4000/api/v1/admin/warehouses/:id`
- Admin warehouse staff:
  - `POST http://localhost:4000/api/v1/admin/warehouses/:id/staff`
  - `GET http://localhost:4000/api/v1/admin/warehouses/:id/staff`
  - `DELETE http://localhost:4000/api/v1/admin/warehouses/:id/staff/:staffId`
- Admin inventory:
  - `POST http://localhost:4000/api/v1/admin/inventory/stock-in`
  - `POST http://localhost:4000/api/v1/admin/inventory/adjust`
  - `POST http://localhost:4000/api/v1/admin/inventory/transfer`
  - `GET http://localhost:4000/api/v1/admin/inventory`
  - `GET http://localhost:4000/api/v1/admin/inventory/low-stock`
  - `GET http://localhost:4000/api/v1/admin/inventory/near-expiry`
  - `GET http://localhost:4000/api/v1/admin/inventory/movements`
- Admin orders:
  - `GET http://localhost:4000/api/v1/admin/orders`
  - `GET http://localhost:4000/api/v1/admin/orders/:id`
  - `PATCH http://localhost:4000/api/v1/admin/orders/:id/status`
  - `POST http://localhost:4000/api/v1/admin/orders/:id/cancel`
- Admin invoices:
  - `GET http://localhost:4000/api/v1/admin/orders/:id/invoice`
  - `GET http://localhost:4000/api/v1/admin/orders/:id/invoice?format=html`
- Admin delivery partners:
  - `GET http://localhost:4000/api/v1/admin/delivery-partners`
  - `GET http://localhost:4000/api/v1/admin/delivery-partners/:id`
  - `PATCH http://localhost:4000/api/v1/admin/delivery-partners/:id/approve`
  - `PATCH http://localhost:4000/api/v1/admin/delivery-partners/:id/reject`
- Admin delivery assignment:
  - `GET http://localhost:4000/api/v1/admin/delivery/assignments`
  - `POST http://localhost:4000/api/v1/admin/delivery/assign`
- Admin reports:
  - `GET http://localhost:4000/api/v1/admin/reports/dashboard?dateFrom=2026-05-01&dateTo=2026-05-26&warehouseId=<warehouse-id>`
- Delivery partner mobile API:
  - `GET http://localhost:4000/api/v1/delivery/me`
  - `PATCH http://localhost:4000/api/v1/delivery/me/status`
  - `POST http://localhost:4000/api/v1/delivery/me/documents`
  - `GET http://localhost:4000/api/v1/delivery/assignments`
  - `PATCH http://localhost:4000/api/v1/delivery/assignments/:id/status`
- Admin image upload: `POST http://localhost:4000/api/v1/uploads/image`
- Admin product document upload: `POST http://localhost:4000/api/v1/uploads/document`
- Customer document upload: `POST http://localhost:4000/api/v1/customer/uploads/document`
- Delivery partner document upload: `POST http://localhost:4000/api/v1/delivery-partner/uploads/document`
- Delivery mobile auth placeholder: `POST http://localhost:4000/api/v1/auth/delivery/request-otp`

Run only the API:

```bash
corepack pnpm dev:api
```

## Worker Local Setup

The NestJS worker in `apps/worker` consumes BullMQ jobs from Redis. Use the same `REDIS_URL` and `REDIS_QUEUE_PREFIX` values for the API and worker so producers and processors use the same queue namespace.

Run only the worker:

```bash
corepack pnpm dev:worker
```

Queues currently registered in `packages/config`:

- `otp`
- `notifications`
- `invoice`
- `payment-webhook`
- `low-stock-alert`
- `near-expiry-alert`

Current processors log mock side effects for OTP delivery, order confirmation notifications, invoice generation, low-stock alerts, and near-expiry alerts. Razorpay webhook requests still perform the critical payment/order state transition in the API after signature verification, and also enqueue the signed payload for worker-side webhook follow-up.

## Documentation

- Architecture overview: `docs/architecture.md`
- Deployment and operations runbook: `docs/deployment.md`
- Update the relevant README or docs after each major feature.

## Production Readiness

- API CORS is allowlisted through `CORS_ORIGINS`; production startup requires explicit origins and rejects wildcards.
- API security headers use Helmet, with cross-origin resource policy set for API-hosted upload assets.
- API rate limiting uses Redis-backed Nest throttling with `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX`, and `RATE_LIMIT_BLOCK_MS`.
- API and worker logs are emitted as JSON records. API request logs include method, path, status, duration, request id, IP, and user agent.
- Error monitoring is represented by `ERROR_MONITORING_ENABLED` and `ERROR_MONITORING_DSN`; the current placeholder logs capture events when enabled and can be replaced with a vendor SDK.
- Admin catalog create/update/delete actions, admin-user changes, warehouse/staff changes, delivery admin actions, and inventory stock changes write `AdminAuditLog` rows.
- Inventory operations also write `StockMovement` rows for warehouse-facing audit trails.
- Important query paths have Prisma indexes for orders, sessions, stock batches, stock movements, delivery assignments, notifications, carts, webhooks, and admin audit logs.
- Deployment, backup, migration, security, and warehouse operations checklists live in `docs/deployment.md`.

## Admin Dashboard Auth And Inventory

The admin dashboard uses real admin authentication from the API. `apps/admin` reads `NEXT_PUBLIC_API_URL` from `apps/admin/.env.local`, stores the admin session client-side with Zustand, injects the JWT access token into API requests, rotates refresh tokens through `/api/v1/auth/admin/refresh`, and calls `/api/v1/auth/admin/logout` when logging out. TanStack Query is configured at the app root for admin data loading.

Admin panel routes:

- `/login`
- `/dashboard`
- `/products`
- `/categories`
- `/brands`
- `/inventory`
- `/inventory/actions`
- `/inventory/movements`
- `/orders`
- `/orders/[id]`
- `/customers`
- `/warehouses`
- `/warehouses/[id]`
- `/warehouses/create`
- `/warehouses/staff`
- `/delivery`
- `/reports`
- `/settings`

The `/products` admin route is a full product management workspace. It uses the guarded admin product APIs to search by name or SKU, filter by fixed category, subcategory, brand, status, sterile, disposable, expiry-sensitive, and medical specialty, create and edit products with React Hook Form and Zod validation, upload product images and product documents through the admin upload endpoints, manage variants, activate or deactivate products, and soft delete products behind confirmation dialogs. Product create/edit uses separate category and subcategory selectors, with subcategory options loaded from the selected parent category, and the product description field is a Lexical-backed rich text editor for headings, emphasis, lists, links, paragraph formatting, and alignment.

Customer catalog pages render the seeded category tree with subcategories under their parent categories. Product listing filters support `subcategory`, category pages expose subcategory navigation chips, and product detail pages render sanitized rich product descriptions from the API.

The `/categories` and `/brands` admin routes use guarded admin catalog APIs, including inactive records, for create/edit/upload/visibility/soft-delete workflows. Category images and brand images are uploaded through the shared admin image upload endpoint with catalog-specific upload purposes.

The `/customers` admin route uses `GET /api/v1/admin/customers` for support-facing account search. It filters by active state, searches customer name, mobile, email, business name, and GSTIN, and displays order/address counts from the backend list response.

The `/settings` admin route uses `settings.manage` to show role and permission catalogs and manage admin users. It can create admin users with roles, edit profile/status/password fields, soft delete admins, and revoke sessions when admin users are suspended, deactivated, or deleted.

Warehouse and inventory admin screens are permission-aware in the UI, but backend guards remain authoritative. Warehouse CRUD requires warehouse permissions, inventory mutations require inventory permissions, and non-`SUPER_ADMIN` users are scoped to warehouses assigned through `WarehouseStaff`.

The `/warehouses` admin route shows warehouse KPIs above a paged warehouse table with edit, activate/deactivate, and delete actions. Its filter drawer (search, state, status, and a `warehouseId` passed in the URL by search results, notifications, and reports) drives both the KPIs and the table; the old `/warehouses/list` URL redirects there with its query string. The warehouse sidebar also opens `/warehouses/staff` for filtered staff assignments (`?warehouseId=` preselects one warehouse), and button-driven `/warehouses/create` flows return to `/warehouses` after save, so list edits open the create/edit page before returning to the table. Each warehouse name and View action opens `/warehouses/[id]`, which shows the warehouse's details, stock KPIs, shortcuts into its inventory, movements, orders, deliveries and staff, a searchable paged product table, its staff with roles, and the delivery partners who have handled its deliveries. Each section loads only with its own permission (`inventory.read`, `warehouse.staff.manage`, `delivery.read`), admins not assigned to the warehouse see a single access message, and edits started there return to the detail page. Global search, new-warehouse notifications, and report rows open this page. Warehouse create/edit/activate/deactivate actions require `warehouse.manage`; staff assignment and removal are shown only to admins with `warehouse.staff.manage`.

The inventory admin route group is split into `/inventory` for aggregate stock, low-stock, and near-expiry overview tables, `/inventory/actions` for stock-in, signed adjustments, and warehouse transfers, and `/inventory/movements` for the movement audit trail. It uses the warehouse and inventory APIs, validates warehouse/product IDs, batch numbers, quantities, prices, expiry dates, and reasons before submit, and keeps stock-changing actions behind confirmation dialogs. Stock rows show low-stock and near-expiry warnings, and batch views show batch number plus expiry date.

The `/orders` admin route uses the guarded admin order APIs for warehouse-scoped order search by order status, payment status, date range, customer mobile, order number, and warehouse. `/orders/[id]` shows customer info, delivery address, linked warehouse, order items, totals, payment attempts, invoice summary, and status timeline. Status updates, cancellation, and delivery assignment are permission-aware in the UI and still enforced by backend order, delivery, and warehouse-access guards; destructive or operational actions use confirmation dialogs.

The `/dashboard` and `/reports` admin routes use the guarded reports API for dashboard cards, daily order and revenue charts, top-selling products, stock alerts, and warehouse-wise stock summaries. Report filters support date range, expiry window, and warehouse selection. The backend applies `reports.read` and warehouse assignment checks, so non-super-admin users only receive assigned-warehouse data where warehouse scope applies. Stock alert and warehouse summary SQL pre-aggregates inventory and batch data before joining warehouses to avoid inflated counts from row multiplication.

Stock movements use these primary movement types:

- `IN`
- `OUT`
- `ADJUSTMENT`
- `TRANSFER`
- `RETURN`

Stock transfer writes paired movement records: source warehouse `OUT` and destination warehouse `IN`, with shared transfer reference metadata.

## Customer Profile And Addresses

Authenticated customer profile routes use customer JWT access tokens. `GET /api/v1/me` returns the token customer's profile, and `PATCH /api/v1/me` updates name, email, GST number, and business name.

Customer address routes are scoped to the token customer. Addresses support `HOME`, `WORK`, `CLINIC`, `HOSPITAL`, and `OTHER` types, optional latitude/longitude, soft delete, and a single default address per customer.

## GST Invoices

GST invoice generation is queued after Razorpay payment capture or after a COD order is confirmed by an admin. Invoice read endpoints still create missing invoice records idempotently from persisted order item snapshots. Same-state orders split tax into CGST and SGST; cross-state orders use IGST. Both customer and admin invoice endpoints return JSON by default, include generated invoice HTML, and support `?format=html` for HTML download. PDF generation is represented by a placeholder status until the invoice worker owns rendering.

## Delivery Operations

Delivery management lives inside the admin dashboard at `apps/admin/app/delivery`; there is no separate delivery partner web app. The admin route uses guarded backend APIs to list delivery partners, open partner detail, view uploaded delivery documents, approve or reject partner applications, list assignments with status/warehouse/partner filters, and assign eligible confirmed or packed orders to active partners.

Delivery partner profiles include document metadata, approval status, online/offline availability, last-seen time, and wallet/earnings placeholders. Delivery assignments track `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, and `CANCELLED` history, pickup and delivered timestamps, proof-of-delivery placeholders, failure reasons, and an optional pickup warehouse location.
