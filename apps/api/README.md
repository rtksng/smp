# API

NestJS backend for the Surgical Medical Equipment Platform.

## Local Setup

1. Copy environment values:

   ```bash
   cp .env.example .env
   ```

2. Start local infrastructure from the repository root:

   ```bash
   docker compose --env-file .env -f infra/docker/docker-compose.yml up -d
   ```

3. Generate Prisma client:

   ```bash
   pnpm --filter @surgical/api prisma:generate
   ```

4. Run migrations against local PostgreSQL:

   ```bash
   pnpm --filter @surgical/api exec prisma migrate dev --schema ./prisma/schema.prisma
   ```

5. Seed default admin roles, permissions, and optionally the first super admin:

   ```bash
   pnpm --filter @surgical/api seed
   ```

6. Start the API:

   ```bash
   pnpm dev:api
   ```

## Routes

- Health: `GET /api/v1/health`
- Swagger/OpenAPI: `/api/docs`
- Customer auth:
  - `POST /api/v1/auth/customer/request-otp`
  - `POST /api/v1/auth/customer/verify-otp`
  - `POST /api/v1/auth/customer/refresh`
  - `POST /api/v1/auth/customer/logout`
- Customer profile:
  - `GET /api/v1/me`
  - `PATCH /api/v1/me`
- Customer addresses:
  - `GET /api/v1/me/addresses`
  - `POST /api/v1/me/addresses`
  - `PATCH /api/v1/me/addresses/:id`
  - `DELETE /api/v1/me/addresses/:id`
  - `PATCH /api/v1/me/addresses/:id/default`
- Customer cart:
  - `GET /api/v1/cart`
  - `POST /api/v1/cart/items`
  - `PATCH /api/v1/cart/items/:id`
  - `DELETE /api/v1/cart/items/:id`
  - `DELETE /api/v1/cart`
- Customer orders:
  - `POST /api/v1/orders`
  - `GET /api/v1/orders/my`
  - `GET /api/v1/orders/:id`
  - `GET /api/v1/orders/:id/invoice`
- Customer payments:
  - `POST /api/v1/payments/razorpay/create-order`
  - `POST /api/v1/payments/razorpay/verify`
  - `POST /api/v1/payments/razorpay/webhook`
- Admin auth:
  - `POST /api/v1/auth/admin/login`
  - `POST /api/v1/auth/admin/refresh`
  - `POST /api/v1/auth/admin/logout`
- Admin access control:
  - `GET /api/v1/admin/roles`
  - `GET /api/v1/admin/roles/:code`
  - `GET /api/v1/admin/permissions`
  - `GET /api/v1/admin/admin-users`
  - `POST /api/v1/admin/admin-users`
  - `PATCH /api/v1/admin/admin-users/:id`
  - `DELETE /api/v1/admin/admin-users/:id`
- Catalog:
  - `GET /api/v1/categories`
  - `GET /api/v1/categories/:slug`
  - `GET /api/v1/brands`
  - `GET /api/v1/brands/:slug`
  - `GET /api/v1/products`
  - `GET /api/v1/products/:slug`
- Admin catalog:
  - `GET /api/v1/admin/products`
  - `GET /api/v1/admin/products/:id`
  - `POST /api/v1/admin/products`
  - `PATCH /api/v1/admin/products/:id`
  - `DELETE /api/v1/admin/products/:id`
  - `GET /api/v1/admin/categories`
  - `POST /api/v1/admin/categories`
  - `PATCH /api/v1/admin/categories/:id`
  - `DELETE /api/v1/admin/categories/:id`
  - `GET /api/v1/admin/brands`
  - `POST /api/v1/admin/brands`
  - `PATCH /api/v1/admin/brands/:id`
  - `DELETE /api/v1/admin/brands/:id`
- Admin customers:
  - `GET /api/v1/admin/customers`
- Admin warehouses:
  - `POST /api/v1/admin/warehouses`
  - `GET /api/v1/admin/warehouses`
  - `GET /api/v1/admin/warehouses/:id`
  - `PATCH /api/v1/admin/warehouses/:id`
  - `PATCH /api/v1/admin/warehouses/:id/activate`
  - `PATCH /api/v1/admin/warehouses/:id/deactivate`
  - `DELETE /api/v1/admin/warehouses/:id`
- Admin warehouse staff:
  - `POST /api/v1/admin/warehouses/:id/staff`
  - `GET /api/v1/admin/warehouses/:id/staff`
  - `DELETE /api/v1/admin/warehouses/:id/staff/:staffId`
- Admin inventory:
  - `POST /api/v1/admin/inventory/stock-in`
  - `POST /api/v1/admin/inventory/adjust`
  - `POST /api/v1/admin/inventory/transfer`
  - `GET /api/v1/admin/inventory`
  - `GET /api/v1/admin/inventory/low-stock`
  - `GET /api/v1/admin/inventory/near-expiry`
  - `GET /api/v1/admin/inventory/movements`
- Admin orders:
  - `GET /api/v1/admin/orders`
  - `GET /api/v1/admin/orders/:id`
  - `GET /api/v1/admin/orders/:id/invoice`
  - `PATCH /api/v1/admin/orders/:id/status`
  - `POST /api/v1/admin/orders/:id/cancel`
- Admin delivery partners:
  - `GET /api/v1/admin/delivery-partners`
  - `PATCH /api/v1/admin/delivery-partners/:id/approve`
- Admin delivery:
  - `POST /api/v1/admin/delivery/assign`
- Delivery partner mobile API:
  - `GET /api/v1/delivery/me`
  - `PATCH /api/v1/delivery/me/status`
  - `POST /api/v1/delivery/me/documents`
  - `GET /api/v1/delivery/assignments`
  - `PATCH /api/v1/delivery/assignments/:id/status`
- Uploads:
  - `POST /api/v1/uploads/image`
  - `POST /api/v1/uploads/document`
  - `POST /api/v1/customer/uploads/document`
  - `POST /api/v1/delivery-partner/uploads/document`
- Delivery partner auth for the future delivery mobile app:
  - `POST /api/v1/auth/delivery/request-otp`
  - `POST /api/v1/auth/delivery/verify-otp`
  - `POST /api/v1/auth/delivery/refresh`
  - `POST /api/v1/auth/delivery/logout`

## Runtime Concerns

- Global REST prefix: `/api/v1`
- CORS origins come from `CORS_ORIGINS`; production startup requires explicit origins and rejects wildcard origins
- Security headers use Helmet
- Redis-backed rate limiting uses `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX`, and `RATE_LIMIT_BLOCK_MS`
- JSON request logs include request id, method, path, status, duration, IP, and user agent
- Error monitoring is behind `ERROR_MONITORING_ENABLED` and `ERROR_MONITORING_DSN`; the placeholder logs capture intent until a vendor SDK is selected
- OTP login uses Redis-backed code storage, resend cooldown, and request rate limiting
- OTP delivery is enqueued to the `otp` BullMQ queue and mocked by the worker; no external SMS provider is wired yet
- Customer refresh sessions are stored in `UserSession`
- Customer profile routes require a customer access token and are scoped to the token subject.
- Customer profile updates support name, email, GST number, and business name.
- Customer address routes require a customer access token, use DTO validation, soft delete addresses, and maintain one default address per customer.
- Customer-created address types are `HOME`, `WORK`, `CLINIC`, `HOSPITAL`, and `OTHER`.
- Customer cart routes require a customer access token, use the database cart for logged-in customers, support product variants, validate active product/variant status and available stock on mutations, and do not reserve stock.
- Cart totals include subtotal, tax, discount placeholder, delivery charge placeholder, and grand total.
- Customer order creation requires a customer access token, selected customer-owned address, and `COD` or `ONLINE` payment method.
- Order creation runs in a Prisma transaction, selects one active warehouse that can satisfy the cart, reserves aggregate inventory, decrements selected stock batches, snapshots product name/SKU/price/tax onto order items, creates a pending payment record, writes initial `CREATED` status history, and clears the cart after success.
- Order totals include subtotal, tax, discount placeholder, delivery charge placeholder, and grand total.
- Order statuses are `CREATED`, `CONFIRMED`, `PACKED`, `ASSIGNED`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, and `RETURNED`.
- Customer order APIs are scoped to the token customer and remain website/mobile reusable REST endpoints.
- Razorpay payment APIs are customer-scoped REST endpoints reusable by the customer website and future customer mobile app.
- Razorpay order creation requires an existing customer-owned `ONLINE` order in `CREATED` state, derives the gateway amount from the database order total, stores provider order ids and provider paise amount, and never accepts frontend amounts.
- Razorpay payment verification validates the server-side payment signature, compares stored Razorpay paise amount against the database order total, prevents duplicate successful payment ids, marks the online payment `PAID`, marks `Order.paymentStatus` as `PAID`, and moves `CREATED` orders to `CONFIRMED`.
- Razorpay webhooks use Nest raw body capture and verify `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET` before persistence or processing.
- Razorpay webhook deliveries enqueue the signed payload to the `payment-webhook` queue, store parsed JSON and the raw signed payload in `PaymentWebhook`, and keep provider event ids unique when Razorpay sends them so duplicate deliveries are ignored safely.
- COD payments remain `PENDING` after checkout and are not marked paid by Razorpay flows.
- Customer return requests create `PENDING` refund records. When an admin accepts a delivered return by moving the order to `RETURNED`, paid Razorpay orders call the Razorpay refund API, store the provider refund id, and update payment/order refund status from the provider response or Razorpay refund webhooks.
- GST invoice generation is enqueued on the `invoice` queue once an online order payment is captured or a COD order is moved to `CONFIRMED`; invoice read endpoints still create missing invoice records idempotently from order item snapshot data.
- Customer invoice access uses `GET /api/v1/orders/:id/invoice`; admin invoice access uses `GET /api/v1/admin/orders/:id/invoice` and remains warehouse-scoped through `orders.read`.
- Invoice responses include persisted customer details, GSTIN when available, billing address, source/destination state, invoice items, CGST/SGST or IGST breakup, generated HTML, and on-demand PDF availability.
- Add `?format=html` to either invoice endpoint to download the generated HTML invoice; add `?format=pdf` to download the generated PDF invoice. The default response remains JSON invoice metadata.
- Order confirmation notifications are enqueued to the `notifications` queue after checkout succeeds.
- Low-stock and near-expiry inventory alerts are enqueued to `low-stock-alert` and `near-expiry-alert` when inventory mutations detect those conditions.
- Queue names live in `packages/config`; job names and payload versions live in `packages/types`.
- Admin and delivery partner refresh sessions use separate session tables
- Access and refresh JWTs use separate secrets
- Admin password verification uses bcrypt
- Admin users have one role, roles have multiple permissions, and protected admin routes use `@RequirePermission(...)` with `PermissionGuard`
- Admin user management requires `settings.manage`, hashes created or reset passwords, soft deletes admin accounts, revokes active sessions when admins are suspended/deactivated/deleted, and writes `AdminAuditLog` rows.
- Admin roles and permissions are readable through `settings.manage` for the settings screen.
- Admin customer search requires `users.read`, excludes soft-deleted customer records, supports active-state filtering, and returns order/address counts for support workflows.
- Public category and brand routes return only active, non-deleted records
- Admin category and brand list routes return active and inactive non-deleted records for management workflows.
- Public product routes return visible catalog products (`ACTIVE` and `OUT_OF_STOCK`) and support search by name, SKU, brand, category, medical specialty, and search tags
- Product list filters support category, brand, selling price range, stock availability, expiry-sensitive, sterile, disposable, and medical specialty values
- Product list sorting supports `latest`, `price_low_to_high`, `price_high_to_low`, and `name_az`; pagination uses `page` and `limit`
- Admin category and brand mutations use product catalog permissions: `products.create`, `products.update`, and `products.delete`
- Admin product reads use `products.read`; product create, update, and delete use `products.create`, `products.update`, and `products.delete`
- Admin product, category, brand, and admin-user create/update/delete actions write `AdminAuditLog` rows with before/after snapshots when an admin context is available
- Product delete is a soft delete that deactivates the product and its variants
- Category deletion is a soft delete that also deactivates and soft deletes descendants
- Brand deletion is a soft delete that also deactivates the brand
- Admin upload routes require an admin access token and accept multipart form data with a `file` field
- Admin warehouse routes require `warehouse.read`, `warehouse.manage`, or `warehouse.staff.manage` depending on the action
- Warehouse codes are unique; warehouse delete is a safe soft delete and is blocked when inventory, stock batches, or stock movements exist
- Warehouse staff assignment and removal write admin audit logs
- Admin inventory read routes require `inventory.read`
- Admin inventory stock-in, adjustment, and transfer routes require `inventory.update`
- Inventory writes run inside Prisma transactions and write aggregate stock, batch changes, movement records, and admin audit logs together
- Inventory stock cannot become negative, and batch quantity cannot become negative
- Stock transfer writes paired movement records with the same transfer reference id: source warehouse `OUT` and destination warehouse `IN`
- `StockMovementType` values are `IN`, `OUT`, `ADJUSTMENT`, `TRANSFER`, and `RETURN`
- Admin image uploads support product images, brand logos, and category images through the `purpose` field
- Admin document uploads support product documents through the `purpose=product_document` field
- Customer and delivery partner document uploads are separate routes guarded by their own JWT audiences
- Local development upload storage writes to `STORAGE_LOCAL_ROOT` and serves files from `STORAGE_PUBLIC_PATH`
- Upload responses return `{ key, url, mimeType, size }`; image and document type/size limits come from storage environment values
- `SUPER_ADMIN` receives every seeded permission and can access all warehouses
- Non-super-admin warehouse staff must be assigned in `WarehouseStaff`; use `WarehouseAccessService` before warehouse-scoped mutations
- Admin order reads require `orders.read`; status updates require `orders.update`; cancellation requires `orders.cancel`
- Admin order lists accept `status`, `paymentStatus`, `dateFrom`, `dateTo`, `customerMobile`, `orderNumber`, `warehouseId`, `page`, and `limit` query parameters. Warehouse filters are still checked against the signed-in admin's warehouse scope.
- Admin order lists and details include customer info, shipping and billing addresses, order items, linked warehouse, totals, payment details, invoice summary, and status history. Non-super-admin staff remain warehouse-scoped when an order has a warehouse link.
- Admin cancellation is allowed only before out-for-delivery and releases reserved inventory back to the selected batch and warehouse stock
- Delivered orders clear reserved inventory; returns are tracked as order status history and do not automatically place stock back into saleable inventory
- Admin delivery partner reads require `delivery.read`; approving partners and assigning orders require `delivery.assign`
- Admin delivery assignment accepts only `CONFIRMED` or `PACKED` orders and applies the same warehouse access checks as delivery operations.
- Delivery partner profiles expose approval status, document metadata, online/offline state, and wallet/earnings placeholders
- Delivery assignment writes create `DeliveryStatusHistory` records for `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`, and `CANCELLED`
- Delivery assignment pickup and delivered timestamps are stored on the assignment, proof of delivery is represented by optional URL/key placeholders, and pickup can optionally link to a warehouse
- Delivery partner status updates are scoped to the token partner and keep order status aligned for `OUT_FOR_DELIVERY` and `DELIVERED`
- Request payloads use DTO validation
- Successful responses use a consistent `{ success, data, meta }` envelope
- Errors use a consistent `{ success, data, error, meta }` envelope

Required auth environment values:

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
OTP_EXPOSE_IN_RESPONSE=false
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=storage/uploads
STORAGE_PUBLIC_PATH=uploads
STORAGE_PUBLIC_BASE_URL=http://localhost:4000/uploads
STORAGE_IMAGE_MAX_BYTES=5242880
STORAGE_DOCUMENT_MAX_BYTES=10485760
RAZORPAY_KEY_ID=replace-with-razorpay-key-id
RAZORPAY_KEY_SECRET=replace-with-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=replace-with-razorpay-webhook-secret
```

S3 configuration placeholders are reserved for the later storage provider implementation:

```bash
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

Optional seed values for creating or updating the first super admin:

```bash
SEED_SUPER_ADMIN_EMAIL=owner@example.com
SEED_SUPER_ADMIN_PASSWORD=replace-with-a-strong-password
SEED_SUPER_ADMIN_FIRST_NAME=Super
SEED_SUPER_ADMIN_LAST_NAME=Admin
SEED_SUPER_ADMIN_MOBILE_NUMBER=
```

## Prisma

- Schema: `prisma/schema.prisma`
- Initial migration: `prisma/migrations/20260525000100_initial_platform_schema/migration.sql`
- Auth sessions migration: `prisma/migrations/20260525000200_add_auth_sessions/migration.sql`
- Category image migration: `prisma/migrations/20260525000300_add_category_image_url/migration.sql`
- Product catalogue module migration: `prisma/migrations/20260525000400_product_catalogue_module/migration.sql`
- Stock movement type alignment migration: `prisma/migrations/20260525000500_align_stock_movement_types/migration.sql`
- Customer profile and address migration: `prisma/migrations/20260525000600_customer_profile_addresses/migration.sql`
- Order module migration: `prisma/migrations/20260525000700_order_module/migration.sql`
- Razorpay payment idempotency migration: `prisma/migrations/20260525000800_razorpay_payment_idempotency/migration.sql`
- GST invoice tax breakup migration: `prisma/migrations/20260525000900_gst_invoice_tax_breakup/migration.sql`
- Delivery operations migration: `prisma/migrations/20260525001000_delivery_operations/migration.sql`
- Production readiness indexes migration: `prisma/migrations/20260526000100_production_readiness_indexes/migration.sql`
- Seed script: `prisma/seed.ts`

## Testing

Backend tests use Node's built-in test runner through the package script:

```bash
pnpm --filter @surgical/api test
```

Unit examples live under `test/auth`, `test/catalog`, `test/cart`, `test/orders`, `test/warehouses`, and `test/inventory`. The API integration setup lives under `test/integration` and boots a minimal Nest application to verify the `/api/v1/health` HTTP route without requiring database or Redis services.

## Default Admin Roles

- `SUPER_ADMIN`
- `INVENTORY_MANAGER`
- `WAREHOUSE_MANAGER`
- `ORDER_MANAGER`
- `DELIVERY_MANAGER`
- `SUPPORT`

## Default Admin Permissions

- `products.create`
- `products.read`
- `products.update`
- `products.delete`
- `orders.read`
- `orders.update`
- `orders.cancel`
- `inventory.read`
- `inventory.update`
- `warehouse.read`
- `warehouse.manage`
- `warehouse.staff.manage`
- `delivery.read`
- `delivery.assign`
- `users.read`
- `reports.read`
- `settings.manage`
