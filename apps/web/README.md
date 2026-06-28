# Customer Website

`apps/web` is the Next.js App Router customer website for surgical and medical equipment purchasing.

## Environment

Create `apps/web/.env.local` from `apps/web/.env.example` and set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=local
```

The value must point at the customer API version prefix. Catalog sections call:

- `GET /products`
- `GET /products/:slug`
- `GET /categories`
- `GET /categories/:slug`
- `GET /brands`
- `GET /brands/:slug`

`NEXT_PUBLIC_SITE_URL` is used for canonical URLs, Open Graph URLs, `robots.txt`,
and `sitemap.xml`. Set it to the public production origin before deployment.

Customer authentication uses mobile OTP endpoints:

- `POST /auth/customer/request-otp`
- `POST /auth/customer/verify-otp`
- `POST /auth/customer/refresh`
- `POST /auth/customer/logout`

Customer account management uses protected customer endpoints:

- `GET /me`
- `PATCH /me`
- `GET /me/addresses`
- `POST /me/addresses`
- `PATCH /me/addresses/:id`
- `DELETE /me/addresses/:id`
- `PATCH /me/addresses/:id/default`
- `GET /orders/my`
- `GET /orders/:id`
- `GET /orders/:id/invoice?format=html`
- `GET /orders/:id/invoice?format=pdf`
- `POST /orders/:id/cancel`
- `POST /orders/:id/return-request`
- `GET /wishlist`
- `POST /wishlist`
- `DELETE /wishlist/:productId`

## Product Browsing

Customer product browsing lives only in `apps/web` and uses the public customer catalog APIs.

Routes:

- `/products`
- `/products/[slug]`
- `/categories/[slug]`
- `/categories/[slug]/[subcategory]`
- `/brands`
- `/brands/[slug]`

The listing pages keep filters in URL query params so searches are shareable and refresh-safe. Supported params:

- `q`
- `category`
- `brand`
- `minPrice`
- `maxPrice`
- `stock`
- `availability`
- `expirySensitive`
- `sterile`
- `disposable`
- `medicalSpecialty`
- `sort`
- `page`

Sorting values:

- `latest`
- `price_low_to_high`
- `price_high_to_low`
- `name_az`

The detail page uses `/products/:slug` and shows image gallery, pricing, GST/tax rate, stock availability, quantity actions, wishlist save/remove, medical details, documents, customer reviews, product questions, related products, and similar category products.

## Storefront UX Direction

The customer storefront uses a procurement-first layout for hospitals and clinics:

- Search is the primary entry point and supports quick-search shortcuts for common purchase terms.
- Search also provides live product suggestions and recent customer searches.
- The header keeps product search, product browsing, categories, brands, cart, and login visible on desktop, with a mobile drawer for smaller screens.
- Home sections prioritize department browsing, procurement-ready product cards, verified brands, workflow clarity, and a live bulk quote request form.
- Product cards show hospital price, MRP savings, SKU, GST rate, GST invoice readiness, stock state, delivery-at-checkout context, and full-width add-to-cart actions.
- Product detail pages use a clean image area, structured product signals, medical details, and a sticky purchase panel on large screens for price, quantity, add-to-cart, buy-now, payment, and bulk-support context.

## SEO and Performance

Public catalog routes expose Next.js metadata with canonical URLs and Open Graph
data:

- `/`
- `/products`
- `/products/[slug]`
- `/categories/[slug]`
- `/categories/[slug]/[subcategory]`
- `/brands`
- `/brands/[slug]`

Product detail metadata uses the product API `metaTitle` and `metaDescription`
when present, then falls back to product name and short description. Category
and brand metadata is generated from their public catalog records.

Private customer routes use `noindex, nofollow` metadata:

- `/login`
- `/cart`
- `/checkout`
- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/orders/[id]`
- `/account/quotes`
- `/account/wishlist`
- `/order-success/[orderId]`
- `/payment-failed`

The app exposes native Next.js `/robots.txt` and `/sitemap.xml` routes. The
sitemap includes static public pages and, when the catalog API is reachable,
current product, category, and brand URLs.

The home page renders catalog data as a server component. Product listing routes
also fetch initial catalog data on the server and hydrate the existing client
filters with `initialData`, avoiding an empty client-only first render while
keeping URL-backed filtering interactive.

## Customer Authentication

The customer website supports Indian mobile-number OTP login through a reusable login form, a `/login` page, and a global login modal. Mobile numbers are normalized to E.164 India format before API calls.

Protected routes:

- `/cart`
- `/checkout`
- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/orders/[id]`
- `/account/quotes`
- `/account/wishlist`
- `/order-success/[orderId]`

Unauthenticated protected-route visits redirect to `/login?next=<previous-path>`. Add-to-cart actions prompt the login modal when the customer is not signed in. After successful login, the customer returns to the prior page.

Access tokens are kept in the customer auth store, while refresh is backed by the API's secure HTTP-only customer refresh cookie. Zustand persistence strips the refresh token before writing browser storage, and logout clears both the API cookie and the local customer session.

## Customer Account

The protected customer account section includes:

- `/account` account overview and navigation
- `/account/profile` editable profile details for name, email, business name, and GST number, with mobile shown as read-only
- `/account/addresses` saved address management with add, edit, delete, set default, and HOME, WORK, CLINIC, HOSPITAL, OTHER address types
- `/account/orders` order history with order number, date, order status, payment status, and total
- `/account/orders/[id]` order detail with items, delivery address, payment details, refund status, delivery tracking, status timeline, invoice HTML/PDF downloads, reorder-to-cart, payment retry, cancel, and return-request actions
- `/account/quotes` quote request history with product and request context
- `/account/wishlist` saved products with direct product navigation

Account routes use the shared protected customer route, loading skeletons, empty states, and retryable error states. Invoice download is shown only for orders that can produce a customer invoice under the backend order and payment status rules. Cancel and return actions are conditionally shown from the backend order status.

## Cart and Checkout

The customer cart and checkout flow uses protected customer APIs:

- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:id`
- `DELETE /cart/items/:id`
- `DELETE /cart`
- `GET /me/addresses`
- `POST /me/addresses`
- `POST /coupons/validate`
- `POST /orders`
- `GET /orders/my`
- `GET /orders/:id`
- `POST /orders/:id/reorder`
- `GET /orders/:id/invoice?format=html`
- `GET /orders/:id/invoice?format=pdf`
- `POST /payments/razorpay/create-order`
- `POST /payments/razorpay/verify`
- `POST /quote-requests`
- `GET /products/:slug/feedback`
- `POST /products/:slug/feedback/reviews`
- `POST /products/:slug/feedback/questions`

Routes:

- `/cart` fetches the backend cart, supports quantity update, item removal, cart clearing, stock warnings, and a full price summary.
- `/checkout` requires login, supports saved address selection, inline address creation, coupon validation, COD or online payment selection, and a final confirmation summary before submission.
- `/order-success/[orderId]` fetches the placed order and shows status, payment, delivery address, items, and totals.
- `/payment-failed` shows online payment retry actions when Razorpay checkout is cancelled or verification fails.

Online payments first create the order from the cart, then call the backend Razorpay create-order endpoint, open Razorpay Checkout in the browser, verify the payment with the backend, and redirect to success or failure.

## Responsive UI

The customer website is built for 360px mobile, 768px tablet, 1024px desktop, and 1440px large desktop layouts.

- The header uses the desktop navigation on large screens and a fixed mobile drawer below the large breakpoint.
- Product listing filters stay sticky in the desktop sidebar and move into a mobile bottom sheet on smaller screens.
- Cart and checkout actions use full-width mobile controls, larger tap targets, and responsive summary panels.
- Account navigation becomes horizontally scrollable tabs on mobile and a side navigation on desktop.
- Product detail thumbnails are horizontally scrollable and touch-friendly on mobile.
- Order history renders as mobile cards and switches to the table layout from the tablet breakpoint.

## Loading, Empty, Error, and Not Found States

Shared customer-facing feedback components live in `components/ui`:

- `PageLoader`
- `SectionLoader`
- `ProductGridSkeleton`
- `TableSkeleton`
- `EmptyState`
- `ErrorState`
- `RetryButton`

Catalog, cart, checkout, account, order success, and payment failure routes use route-level `error.tsx` boundaries or query-level retry states so failed API calls do not leave blank screens. Product, category, brand, order, and global invalid routes render friendly `not-found.tsx` pages with navigation back to useful customer flows.

API errors should be displayed through `getFriendlyApiErrorMessage` from `lib/api/error-messages.ts`. Product availability messaging should use `stockErrorMessage` so product detail, product cards, cart, and checkout use the same out-of-stock copy.

## API Client and Query Defaults

Customer API calls go through the centralized client in `lib/api/client.ts`. The client builds URLs from `NEXT_PUBLIC_API_URL`, parses typed success/error envelopes, injects customer bearer tokens through `requestCustomerApi`, retries one `401` after refreshing the access token, clears the customer session when refresh fails, and normalizes network and backend validation failures into typed API errors.

TanStack Query setup lives in `lib/api/query-client.ts`. It applies the shared retry strategy, stale time, and development-only query/mutation error logging used by `app/providers.tsx`. Customer query keys and mutation option helpers live in `lib/api/query-keys.ts` and `lib/api/mutation-helpers.ts`; cart, checkout, auth, and profile mutations should use these helpers so cache updates and invalidation stay consistent.

## Local Development

From the monorepo root:

```bash
pnpm dev:web
```

## Verification

```bash
pnpm --filter @surgical/web test
pnpm --filter @surgical/web lint
pnpm --filter @surgical/web typecheck
pnpm --filter @surgical/web build
pnpm --filter @surgical/web start
```

The page uses TanStack Query for client-side catalog fetching, Zod for API response validation and search validation, Zustand for search/cart UI state, and Tailwind CSS for responsive styling.
