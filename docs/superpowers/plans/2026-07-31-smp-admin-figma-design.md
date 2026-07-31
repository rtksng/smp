# SMP Admin Figma Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the complete light-theme SMP admin experience in the existing Figma file, covering all 52 route entry points at desktop, tablet, and mobile sizes with accurate states, overlays, prototype flows, variables, and reusable primitives.

**Architecture:** The Figma file is organized into ten domain pages. `00 - Foundations and Components` owns the variable system and controlled reusable component library; domain pages combine component instances with purpose-built tables, filters, forms, and workflows. Work proceeds page by page, returns every created or mutated node ID, validates component integrity and visual output after each domain, and finishes with a programmatic parity and coverage audit.

**Tech Stack:** Figma Design, Figma Plugin API through `use_figma`, `get_metadata`, `get_design_context`, and `get_screenshot`, Plus Jakarta Sans, Geist Mono, Lucide SVG icons, and Next.js/React source under `apps/admin` as read-only functional reference.

## Global Constraints

- Target file key: `cQswQB7IOSTQwgqvKeojzv`.
- Source specification: `docs/superpowers/specs/2026-07-31-smp-admin-figma-design.md`.
- Light theme only.
- Dark forest-green sidebar and pale cool-gray workspace.
- Preserve and refine the existing variables and reusable component library.
- Create components only for primitives reused across multiple routes.
- Keep module-specific tables, filters, forms, and workflows as explicit
  compositions built from those primitives.
- Create no local paint, text, grid, or effect styles.
- Variables remain the source of truth for reusable design values.
- Use auto-layout for every structurally related group.
- Bind every eligible color, spacing, radius, typography, opacity, and effect field to variables.
- Use Plus Jakarta Sans for interface text and Geist Mono only for IDs, SKUs, order numbers, warehouse codes, and technical values.
- Import Lucide icons from SVG source; never reconstruct icons from rotated primitives.
- Load each required font with `figma.loadFontAsync` before creating or editing
  text that uses it.
- Use realistic SMP medical-commerce content.
- Represent all 52 route entry points at desktop, tablet, and mobile sizes,
  including `/` as a documented redirect state.
- Cover loading, empty, no-results, partial failure, full error, permission, form, upload, overlay, destructive, success, and responsive behavior.
- Expose export only in Reports, sorting only where supported, and selection,
  bulk, import, archive, restore, column, or density controls only where the
  code implements them.
- Do not change application or backend source code.
- Preserve unrelated user-owned worktree changes.
- Every `use_figma` mutation returns all created and mutated node IDs.
- Every `use_figma` call passes
  `skillNames: "figma-use,figma-generate-design"`.
- Never call `figma.notify`.
- Use `get_metadata` for page structure and `get_design_context`
  section-by-section; do not request an entire large page as one context dump.
- Switch Figma pages at most once per `use_figma` call.
- Stop and inspect on any `use_figma` error before issuing a corrected call.

Although the design spans multiple admin domains, it remains one implementation
plan because every domain depends on the same Figma file, variable IDs,
component IDs, shell, and coverage matrix. Tasks 3-9 are independently
reviewable domain checkpoints after Tasks 1-2 establish those shared
interfaces.

---

## File and Page Map

**Create or modify only:**

- Figma file `cQswQB7IOSTQwgqvKeojzv`
  - Rename `00 - Foundations` to `00 - Foundations and Components`
  - Create `01 - Global Shell and Authentication`
  - Create `02 - Dashboard and Reports`
  - Create `03 - Catalog`
  - Create `04 - Inventory and Warehouses`
  - Create `05 - Orders Returns and Customers`
  - Create `06 - Delivery`
  - Create `07 - Commercial`
  - Create `08 - Settings and RBAC`
  - Create `09 - States Overlays and Flow Reference`
- Update this plan's checkboxes only if execution tracking is needed:
  `docs/superpowers/plans/2026-07-31-smp-admin-figma-design.md`

**Read-only functional references:**

- `apps/admin/app/admin-shell.tsx`
- `apps/admin/app/globals.css`
- `apps/admin/app/login/page.tsx`
- `apps/admin/app/_components/reports-dashboard.tsx`
- `apps/admin/app/products/product-management.tsx`
- `apps/admin/app/brands/_components/brand-management.tsx`
- `apps/admin/app/categories/_components/category-management.tsx`
- `apps/admin/app/inventory/inventory-management.tsx`
- `apps/admin/app/warehouses/_components/warehouse-management.tsx`
- `apps/admin/app/orders/_components/order-sections.tsx`
- `apps/admin/app/orders/[id]/page.tsx`
- `apps/admin/app/returns-refunds/_components/returns-refunds-sections.tsx`
- `apps/admin/app/customers/_components/customer-sections.tsx`
- `apps/admin/app/customers/[id]/page.tsx`
- `apps/admin/app/delivery/_components/delivery-sections.tsx`
- `apps/admin/app/product-feedback/_components/product-feedback-sections.tsx`
- `apps/admin/app/quote-requests/_components/quote-request-sections.tsx`
- `apps/admin/app/coupons/_components/coupon-sections.tsx`
- `apps/admin/app/delivery-charges/_components/delivery-charge-sections.tsx`
- `apps/admin/app/settings/_components/settings-sections.tsx`
- `apps/admin/lib/navigation.ts`
- `apps/admin/lib/permissions.ts`

**Read-only API contract references:**

- `apps/api/src/modules/products/admin-products.controller.ts`
- `apps/api/src/modules/products/dto/product-query.dto.ts`
- `apps/api/src/modules/inventory/admin-inventory.controller.ts`
- `apps/api/src/modules/inventory/dto/inventory.dto.ts`
- `apps/api/src/modules/warehouses/admin-warehouses.controller.ts`
- `apps/api/src/modules/warehouses/dto/warehouse.dto.ts`
- `apps/api/src/modules/orders/admin-orders.controller.ts`
- `apps/api/src/modules/orders/dto/order.dto.ts`
- `apps/api/src/modules/customers/admin-customers.controller.ts`
- `apps/api/src/modules/customers/dto/admin-customer.dto.ts`
- `apps/api/src/modules/delivery/admin-delivery.controller.ts`
- `apps/api/src/modules/delivery/admin-delivery-partners.controller.ts`
- `apps/api/src/modules/delivery/dto/delivery.dto.ts`
- `apps/api/src/modules/product-feedback/dto/product-feedback.dto.ts`
- `apps/api/src/modules/quote-requests/dto/quote-request.dto.ts`
- `apps/api/src/modules/coupons/dto/coupon.dto.ts`
- `apps/api/src/modules/delivery-charges/dto/delivery-charge.dto.ts`
- `apps/api/src/modules/reports/dto/reports.dto.ts`
- `apps/api/src/modules/roles/roles.constants.ts`
- `apps/api/src/modules/roles/dto/role-response.dto.ts`

## Shared Figma Naming and Interfaces

All tasks consume these naming contracts:

- Page names exactly match the File and Page Map.
- Route frame: `Desktop / <Domain> / <Route> / <State>`.
- Tablet frame: `Tablet / <Domain> / <Route> / <State>`.
- Mobile frame: `Mobile / <Domain> / <Route> / <State>`.
- Overlay frame: `Overlay / <Type> / <State>`.
- Flow section: `Flow / <Number> / <Name>`.
- Root frame width: 1440 desktop, 834 tablet, 390 mobile.
- Desktop sidebar width: 272.
- Desktop workspace padding: 32.
- Screen frames are page-level nodes positioned in a grid with 160-pixel
  horizontal and 200-pixel vertical gaps.

Task 1 produces:

```ts
type FigmaFoundationIds = {
  pageIds: Record<string, string>;
  collectionIds: {
    color: string;
    spacingAndSize: string;
    radius: string;
    typography: string;
    elevation: string;
    motion: string;
  };
  variableIds: Record<string, string>;
  componentIds: Record<string, string>;
};
```

`componentIds` uses these stable semantic keys:

```ts
type ComponentKey =
  | "shell/desktop-sidebar"
  | "shell/top-bar"
  | "shell/navigation-drawer"
  | "navigation/item"
  | "page/breadcrumb"
  | "page/header"
  | "page/tabs"
  | "card/metric"
  | "card/detail-summary"
  | "card/form-section"
  | "card/chart"
  | "action/button"
  | "action/icon-button"
  | "input/text"
  | "input/textarea"
  | "input/search"
  | "input/select"
  | "input/checkbox"
  | "input/radio"
  | "input/switch"
  | "input/date"
  | "input/date-range"
  | "input/rich-text"
  | "input/json"
  | "input/upload"
  | "data/table-header"
  | "data/table-row"
  | "data/row-action"
  | "data/pagination"
  | "data/badge"
  | "data/chip"
  | "feedback/alert"
  | "feedback/toast"
  | "feedback/empty"
  | "feedback/no-results"
  | "feedback/error"
  | "feedback/loading"
  | "feedback/skeleton"
  | "feedback/permission-denied"
  | "overlay/confirmation"
  | "overlay/destructive-confirmation"
  | "overlay/side-panel"
  | "overlay/bottom-sheet"
  | "overlay/filter-drawer"
  | "overlay/date-picker"
  | "overlay/select-popover"
  | "overlay/image-preview"
  | "overlay/account-menu"
  | "content/timeline";
```

Every later task consumes the returned `pageIds` and `variableIds` as literal
IDs in its `use_figma` calls and produces:

```ts
type Breakpoint = "desktop" | "tablet" | "mobile";

type FigmaPageBuildResult = {
  pageId: string;
  routeFrameIds: Record<string, Partial<Record<Breakpoint, string>>>;
  stateFrameIds: Record<string, string>;
  overlayFrameIds: Record<string, string>;
  componentInstanceIds: string[];
  createdNodeIds: string[];
  mutatedNodeIds: string[];
};
```

### Task 1: Refine foundations, components, and page architecture

**Files:**

- Modify: Figma file `cQswQB7IOSTQwgqvKeojzv`
- Read: `docs/superpowers/specs/2026-07-31-smp-admin-figma-design.md`

**Interfaces:**

- Consumes: current page ID `0:1`, foundations board `4:175`, reusable UI board
  `21:2`, desktop-sidebar component set `27:802`, active-orders sidebar variant
  `21:83`, generic-table component set `25:612`, default table variant `22:259`,
  and the existing local variables/components discovered in the audit
- Produces: `FigmaFoundationIds`

- [ ] **Step 1: Re-inspect the target file**

  Call `get_metadata` without a node ID, capture screenshots of `4:175` and
  `21:2`, then run a read-only `use_figma` inspection. Record page IDs,
  collection IDs, variable IDs, component/component-set IDs, instance counts,
  local styles, and available fonts. Confirm the audited starting point rather
  than assuming the file is blank.

- [ ] **Step 2: Confirm exact font names**

  Run `figma.listAvailableFontsAsync()` and assert:

  - `{ family: "Plus Jakarta Sans", style: "Regular" }`
  - the exact Plus Jakarta Sans medium, semi-bold, and bold style strings
  - `{ family: "Geist Mono", style: "Regular" }`

  Use only returned style strings in later calls.

- [ ] **Step 3: Create the ten-page architecture**

  Rename `0:1` to `00 - Foundations and Components`. Create the remaining nine
  pages in the exact File and Page Map order. Return every created and mutated
  page ID.

- [ ] **Step 4: Create `Admin / Color` variables**

  Reconcile the current Color collection with the approved single `Light`
  mode, primitives, and semantic aliases. Preserve matching variable IDs,
  correct wrong values/scopes, and create only missing variables. Set explicit
  scopes:

  - Background variables: `FRAME_FILL`, `SHAPE_FILL`
  - Text variables: `TEXT_FILL`
  - Border variables: `STROKE_COLOR`
  - Hidden primitives: empty scope

  Set CSS code syntax by converting the Figma path to a lowercase
  slash-to-hyphen custom property, for example
  `bg/canvas` -> `var(--admin-bg-canvas)`.

- [ ] **Step 5: Create dimension, radius, typography, elevation, and motion variables**

  Reconcile the five remaining single-mode collections against the
  specification. Preserve matching IDs, correct drift, and create only missing
  values. Assign scopes for gap, padding, width/height, corner radius, font
  family, font size, font weight, line height, letter spacing, opacity, and
  effect fields. Do not leave any variable at `ALL_SCOPES`.

- [ ] **Step 6: Refine the foundations reference board**

  On `00 - Foundations and Components`, retain and refine variable-bound
  reference groups for:

  - Brand, neutral, semantic, and status colors
  - Type roles
  - Spacing and control sizes
  - Radii
  - Elevation
  - Motion notes
  - Accessibility contrast pairings
  - Explicit banner: `Variables and reusable interface primitives`

- [ ] **Step 7: Refine and validate reusable components**

  Audit the existing component board by name and behavior. Keep or create
  reusable families for shell/navigation, headers, tabs, buttons, form
  controls, badges, cards, table primitives, pagination, states, dialogs,
  drawers, menus, tooltips, uploads, timelines, and charts. Correct the sidebar
  labels/icons, replace the mobile bottom bar with the code-accurate top bar and
  left drawer, and remove misleading generic table controls for bulk selection,
  export, density, columns, and sorting. Preserve those capabilities only in
  module-specific contexts where code supports them. Return every component and
  component-set ID that later tasks may instantiate.

- [ ] **Step 8: Validate foundations and components**

  Programmatically assert:

  - 10 pages with exact names
  - 6 variable collections with one descriptive mode each
  - zero variables with `ALL_SCOPES`
  - zero local styles
  - no detached or broken instances
  - every approved reusable family is present
  - every component uses approved variables and fonts
  - no generic circle navigation icon
  - no obsolete mobile bottom navigation
  - no generic table capability that implies unsupported behavior

  Screenshot the foundations and component boards at overview and high-detail
  resolutions.

- [ ] **Step 9: Save a version-history checkpoint**

  Call `figma.saveVersionHistoryAsync` with title
  `SMP Admin - foundations and reusable components`.

### Task 2: Build authentication and global shell states

**Files:**

- Modify: Figma page `01 - Global Shell and Authentication`
- Read: `apps/admin/app/admin-shell.tsx`
- Read: `apps/admin/app/login/page.tsx`
- Read: `apps/admin/lib/navigation.ts`
- Read: `apps/admin/lib/permissions.ts`

**Interfaces:**

- Consumes: `FigmaFoundationIds`, including shell/navigation, button, field,
  alert, and state component IDs
- Produces: route frames for `/`, `/login`, and global shell states

- [ ] **Step 1: Create wrapper sections and route shells**

  Create sections for `Entry and Login`, `Desktop Shell`, `Permission States`,
  and `Mobile Navigation`. Add correctly positioned route-shell frames for `/`,
  `/login`, full-permission shell, restricted shell, navigation scroll, mobile
  drawer, and operator/logout states.

- [ ] **Step 2: Build `/` redirect state**

  Design the auth-aware handoff with SMP mark, concise `Checking admin
  session` copy, progress treatment, and redirect destinations documented as
  `/dashboard` and `/login`.

- [ ] **Step 3: Build `/login` states**

  Create default, focused email, submitting, invalid credentials,
  session-expired, and redirect-in-progress screens. Include email, password,
  password visibility, validation, submit state, and admin-access context.

- [ ] **Step 4: Build desktop shell**

  Instantiate the 272-pixel sidebar with the exact navigation order:
  Dashboard, Products, Categories, Brands, Product Feedback, Inventory,
  Orders, Returns & Refunds, Customers, Warehouses, Delivery, Quote Requests,
  Coupons, Delivery Charges, Reports, and Settings. Show Inventory children
  Overview/Stock actions/Movements and Warehouses children Warehouse
  staff/Warehouse list. Use matching Lucide icons, active-route treatment,
  scrollable navigation, operator identity, role, email, and logout. Populate a
  sample Products workspace header to prove shell/content balance.

- [ ] **Step 5: Build restricted and transitional shell states**

  Show hidden unauthorized navigation, disabled local action with explanation,
  background refresh, session-expired banner, logout pending, and the
  dashboard access-restricted state for an operator without `reports.read`.

- [ ] **Step 6: Build tablet/mobile navigation examples**

  Create 834- and 390-pixel shell frames with top bar, menu trigger, left
  navigation drawer, operator footer, active route, and close/back behavior.

- [ ] **Step 7: Validate Task 2**

  Screenshot every route and state section. Assert font family, variable
  bindings, no clipped nav labels, semantic icons, minimum target sizes, and
  intact component instances with no detached overrides.

- [ ] **Step 8: Save a version-history checkpoint**

  Title: `SMP Admin - authentication and shell`.

### Task 3: Build dashboard and report routes

**Files:**

- Modify: Figma page `02 - Dashboard and Reports`
- Read: `apps/admin/app/_components/reports-dashboard.tsx`
- Read: `apps/admin/lib/reports-management.ts`

**Interfaces:**

- Consumes: foundations and desktop shell anatomy
- Produces: route frames for `/dashboard`, `/reports`,
  `/reports/sales`, `/reports/orders`, `/reports/products`,
  `/reports/inventory`, and `/reports/warehouses`

- [ ] **Step 1: Create route wrappers**

  Create seven populated route frames plus report loading, no-data, request
  error, export pending, export success, and export failure frames.

- [ ] **Step 2: Build `/dashboard`**

  Use current report metrics and summaries, a compact date/warehouse filter
  context, operational alerts, readable charts, top products, low stock,
  near-expiry, orders, and warehouse summaries. Preserve the shell and avoid
  unsupported metrics.

- [ ] **Step 3: Build `/reports`**

  Create the report hub with route cards for Sales, Orders, Products,
  Inventory, and Warehouses plus overview metrics and a clear data timestamp.

- [ ] **Step 4: Build sales and order reports**

  Sales: date filters, revenue metrics, trend chart, revenue-by-day table, and
  CSV/PDF export. Use Date/Revenue/Drilldown columns.

  Orders: date, warehouse, order-status, and payment-status filters; order
  metrics, trend chart, Date/Orders/Drilldown table, and CSV/PDF export.

- [ ] **Step 5: Build product, inventory, and warehouse reports**

  Products: top-selling-product analysis with Product/SKU/Quantity/Revenue/
  Drilldown columns.

  Inventory: stock alerts, low-stock and near-expiry visualization, and
  Warehouse/Low stock/Near expiry/Drilldowns columns.

  Warehouses: warehouse stock summary, comparative bars, and Warehouse/
  Available/Reserved/Batches/Alerts/Drilldown columns.

- [ ] **Step 6: Build report states**

  Design filter-applied summary, reset, chart skeletons, table skeletons,
  no-data explanation, retryable request error, and export toast progression.

- [ ] **Step 7: Validate Task 3**

  Assert seven route frames, table alternatives for every chart, accessible
  labels, no color-only data encoding, no unsupported metrics, report-only
  CSV/PDF export, and intact reusable instances. Screenshot route frames and
  state frames.

- [ ] **Step 8: Save a version-history checkpoint**

  Title: `SMP Admin - dashboard and reports`.

### Task 4: Build catalog and feedback routes

**Files:**

- Modify: Figma page `03 - Catalog`
- Read: `apps/admin/app/products/product-management.tsx`
- Read: `apps/admin/app/brands/_components/brand-management.tsx`
- Read: `apps/admin/app/categories/_components/category-management.tsx`
- Read: `apps/admin/app/product-feedback/_components/product-feedback-sections.tsx`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/products`, `/products/create`,
  `/products/[id]/edit`, `/brands`, `/brands/create`,
  `/brands/[id]/edit`, `/categories`, `/categories/create`,
  `/categories/[id]/edit`, `/product-feedback`,
  `/product-feedback/reviews`, and `/product-feedback/questions`

- [ ] **Step 1: Create catalog route wrappers**

  Create 12 populated route frames and separate sections for product states,
  catalog-master states, feedback states, child-category modal, row menus,
  activate/deactivate confirmations, and delete confirmations.

- [ ] **Step 2: Build product list**

  Add product metrics; search; category, subcategory, brand, status, specialty,
  sterile, disposable, expiry-sensitive, in-stock, minimum-price, and
  maximum-price filters; supported sort order; and applied-filter summary.
  Build the exact columns: Product with specialty, SKU, Category with
  subcategory, Brand, Price, Status, Flags, and Actions. Add row menu,
  pagination, loading, first-use empty, no results, error,
  activate/deactivate confirmation, and delete confirmation. Do not add bulk,
  import, export, density, or column controls.

- [ ] **Step 3: Build product create**

  Include core details, dependent catalog selects, short description, rich
  description editor, pricing/classification, expiry-sensitive/sterile/
  disposable controls, SEO/search, images, variants, documents, sticky actions,
  and realistic validation.

- [ ] **Step 4: Build product edit states**

  Create loaded edit, loading, unavailable, permission denied, invalid nested
  data, upload progress/failure, save pending, save success, server failure,
  and unsaved-changes confirmation.

- [ ] **Step 5: Build brand routes**

  List: metrics, search, exact Brand/Slug/Brand image/Status/Actions columns,
  logo/no-logo rows, status, row menu, loading, empty, error, and delete
  confirmation.

  Create/edit: name, slug, description, image, active status, validation,
  upload failure, permission, unavailable, pending, and success.

- [ ] **Step 6: Build category routes**

  List: hierarchy metrics, exact Category/Slug/Child categories/Sort/Status/
  Actions columns, root rows, child count/summary, search, row menu,
  child-category populated/empty modal with Name/Slug/Status/Actions, loading,
  empty, error, and delete confirmation.

  Create/edit: name, slug, parent/root, sort order, description, image, status,
  relationship guidance, permission, unavailable, pending, and success.

- [ ] **Step 7: Build product-feedback routes**

  Hub: review/question metrics and route cards.

  Reviews: product/status filters; Customer/Product/Review/Status/Moderation/
  Created columns; note; Approve/Reject/Hide actions; loading, empty, request
  error, and action pending/success/failure.

  Questions: product/status filters; Customer/Product/Question/Answer/Status/
  Moderation/Created columns; answer composer; moderation note; Hide/Reopen
  actions; loading, empty, request error, and save pending/success/failure.

- [ ] **Step 8: Validate Task 4**

  Assert 12 route frames, all nested product form sections, all catalog-master
  fields, child-category modal, feedback actions, no filler copy, correct
  fonts, complete bindings, module-specific tables, no unsupported toolbar
  controls, and intact component instances. Screenshot full routes and dense
  form sections individually.

- [ ] **Step 9: Save a version-history checkpoint**

  Title: `SMP Admin - catalog and feedback`.

### Task 5: Build inventory and warehouse routes

**Files:**

- Modify: Figma page `04 - Inventory and Warehouses`
- Read: `apps/admin/app/inventory/inventory-management.tsx`
- Read: `apps/admin/app/warehouses/_components/warehouse-management.tsx`
- Read: `apps/admin/lib/inventory-management.ts`
- Read: `apps/admin/lib/warehouse-management.ts`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/inventory`, `/inventory/actions`,
  `/inventory/movements`, `/warehouses`, `/warehouses/list`,
  `/warehouses/create`, and `/warehouses/staff`

- [ ] **Step 1: Create route wrappers**

  Create seven populated route frames and state sections for stock actions,
  batch/expiry states, warehouse edit, and staff assignment.

- [ ] **Step 2: Build inventory overview**

  Add stock-row, low-stock, near-expiry, and warehouse metrics; product/SKU
  search; product, warehouse, low-stock, near-expiry, and expiry-window filters.
  Build Product/Warehouse/Available/Reserved/Threshold/Warnings stock columns
  and Batch/Product/Warehouse/Quantity/Expiry/Prices batch columns. Add
  low-stock emphasis, near-expiry batch panel, loading, empty, no results,
  partial panel error, and full request error.

- [ ] **Step 3: Build stock actions**

  Create tabs and complete forms for:

  - Stock in: product, optional variant, warehouse, batch, expiry, quantity,
    purchase price, selling price, MRP, threshold, notes, auto-publish context.
  - Adjust: product, optional variant, warehouse, optional batch, delta,
    threshold, reason.
  - Transfer: product, optional variant, source, destination, optional batch,
    quantity, notes.

  Include dependency loading/empty, invalid quantity, insufficient stock,
  same-source/destination, confirmation, pending, success, and failure.

- [ ] **Step 4: Build inventory movements**

  Add movement type, product, and warehouse filters; exact
  Type/Product/Warehouse/Quantity columns; IDs in Geist Mono where returned;
  loading, empty, no results, and error.

- [ ] **Step 5: Build warehouse analytics and list**

  Analytics: total/visible/active/inactive metrics and state footprint.

  List: search/state/city/status filters; exact Warehouse/Location/Contact/
  Status/Actions columns; edit, activate/deactivate, and soft-delete actions;
  loading, empty, no results, error, and edit treatment.

- [ ] **Step 6: Build warehouse create/edit and staff**

  Warehouse form includes name, uppercase code, address, city, state, pincode,
  optional coordinates, contact, phone, status, validation, pending, success,
  and failure.

  Staff includes warehouse selector, assigned staff, add by administrator,
  remove confirmation, permission unavailable, dependency loading, no
  warehouses, no staff, pending, success, and failure.

- [ ] **Step 7: Validate Task 5**

  Assert seven route frames, three stock action forms, accurate inventory
  relationships, warehouse field completeness, staff states, correct bindings,
  exact table/filter contracts, no unsupported controls, and intact component
  instances. Screenshot each route and form tab.

- [ ] **Step 8: Save a version-history checkpoint**

  Title: `SMP Admin - inventory and warehouses`.

### Task 6: Build orders, returns, and customer routes

**Files:**

- Modify: Figma page `05 - Orders Returns and Customers`
- Read: `apps/admin/app/orders/_components/order-sections.tsx`
- Read: `apps/admin/app/orders/[id]/page.tsx`
- Read: `apps/admin/app/returns-refunds/_components/returns-refunds-sections.tsx`
- Read: `apps/admin/app/customers/_components/customer-sections.tsx`
- Read: `apps/admin/app/customers/[id]/page.tsx`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/orders`, `/orders/list`, `/orders/[id]`,
  `/returns-refunds`, `/returns-refunds/requests`, `/customers`,
  `/customers/list`, and `/customers/[id]`

- [ ] **Step 1: Create route wrappers**

  Create eight populated route frames and sections for order actions, return
  disposition, customer status, support notes, confirmations, and failure
  states.

- [ ] **Step 2: Build order hub and list**

  Hub: task routes and order metrics.

  List: status, payment, from, to, customer mobile, order number, and warehouse
  filters; metrics; exact Order/Customer/Status/Payment/Date/Warehouse/Total/
  Action columns; pagination; loading; first-use empty; no results; and error.
  Do not add bulk, import, or export controls.

- [ ] **Step 3: Build complete order detail**

  Include summary metrics, customer, address, exact Item/SKU/Qty/Unit/Tax/Total/
  Warehouse item columns, warehouse, totals, payment, invoice metadata,
  JSON/HTML preview/PDF download, timeline, update status, cancel, and assign
  delivery.
  Add no-next-status, cancellation unavailable, partner loading/empty,
  assignment unavailable, destructive confirmation, pending, success, and
  failure states.

- [ ] **Step 4: Build returns hub and request queue**

  Hub: total/active/completed/failed metrics and task route.

  Queue: refund status, warehouse, customer mobile, and order number filters;
  exact Order/Customer/Payment/Refund/Reason/Warehouse/Stock disposition/Actions
  columns; internal note; returned item; quantity; RESTOCK/QUARANTINE/SCRAP
  disposition; inspection note; refund status; View order/Approve/Reject/
  Process-or-refetch/Record stock actions; permission unavailable; loading,
  empty, no results, and action pending/success/failure.

- [ ] **Step 5: Build customer hub and list**

  Hub: total/active/inactive/GSTIN metrics and list route.

  List: name/mobile/email/business/GSTIN search, status filter, exact Customer/
  Mobile/Email/Business/Orders/Status/Created/Action columns, pagination,
  loading, empty, no results, and error. Do not add customer create, edit,
  delete, bulk, import, or export workflows.

- [ ] **Step 6: Build customer detail**

  Include status/order/address/GSTIN metrics, identity, account status form and
  internal reason, saved addresses, order history, support notes, permission
  unavailable, status confirmation, note pending, success, and failure.

- [ ] **Step 7: Validate Task 6**

  Assert eight route frames, complete order sections, complete return
  disposition, complete customer support actions, correct status semantics,
  exact table/filter contracts, correct variables/fonts, no unsupported
  controls, and intact component instances. Screenshot all route frames and
  operational-action sections.

- [ ] **Step 8: Save a version-history checkpoint**

  Title: `SMP Admin - orders returns and customers`.

### Task 7: Build delivery routes

**Files:**

- Modify: Figma page `06 - Delivery`
- Read: `apps/admin/app/delivery/_components/delivery-sections.tsx`
- Read: `apps/admin/lib/delivery-management.ts`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/delivery`, `/delivery/partners`,
  `/delivery/assign`, and `/delivery/assignments`

- [ ] **Step 1: Create route wrappers**

  Create four populated route frames and state sections for partner approval,
  document lists, assignment dependencies, timelines, and confirmations.

- [ ] **Step 2: Build delivery hub**

  Add partner, active, pending, online, assignment, and in-progress metrics with
  route cards and actionable operational summaries.

- [ ] **Step 3: Build partner list/detail**

  Add status filter; exact Partner/Status/Availability/Documents/Actions
  columns; selected row; identity; mobile; email; verification; vehicle;
  wallet; earnings; availability; last seen; creation date; documents;
  approve/reject actions; loading; no selection; no documents; empty list;
  request error; confirmation; pending; success; and failure. Do not invent
  partner edit/delete.

- [ ] **Step 4: Build assign-order route**

  Add order, partner, pickup warehouse, instructions, assignment preview,
  dependency loading, no assignable orders, no active partners, validation,
  submit pending, success, and failure.

- [ ] **Step 5: Build assignment list/detail**

  Add status/warehouse/partner filters; exact Order/Partner/Status/Pickup
  location/Timeline/Proof-or-issue columns; selected assignment; status and
  timeline; loading; empty; no results; request error; and detail unavailable.
  Do not invent assignment edit/delete.

- [ ] **Step 6: Validate Task 7**

  Assert four route frames, complete partner detail, complete assignment form,
  timeline, exact tables/filters, all dependency states, correct bindings, no
  unsupported actions, and intact component instances. Screenshot each route
  and state section.

- [ ] **Step 7: Save a version-history checkpoint**

  Title: `SMP Admin - delivery`.

### Task 8: Build commercial routes

**Files:**

- Modify: Figma page `07 - Commercial`
- Read: `apps/admin/app/coupons/_components/coupon-sections.tsx`
- Read: `apps/admin/app/delivery-charges/_components/delivery-charge-sections.tsx`
- Read: `apps/admin/app/quote-requests/_components/quote-request-sections.tsx`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/coupons`, `/coupons/list`, `/coupons/new`,
  `/delivery-charges`, `/delivery-charges/rules`, `/delivery-charges/new`,
  `/quote-requests`, and `/quote-requests/requests`

- [ ] **Step 1: Create route wrappers**

  Create eight populated route frames plus edit side panels, archive
  confirmations, quotation workspace, and action-state sections.

- [ ] **Step 2: Build coupon routes**

  Hub: total/active/inactive/limited metrics and routes.

  List: code search; exact Coupon/Discount/Rules/Window/Usage/Status/Actions
  columns; status; edit panel; loading; empty; no results; request error; and
  archive confirmation without a restore affordance.

  New/edit form: code, type, value, minimum order, maximum discount, usage
  limit, start, expiry, active status, validation, pending, success, failure,
  and unsaved changes.

- [ ] **Step 3: Build delivery-charge routes**

  Hub: total/active/pincode/warehouse metrics and routes.

  Rules: rule-name/pincode/warehouse/status filters; exact Rule/Charge/Scope/
  Order range/Free threshold/Status/Updated/Actions columns; edit panel;
  loading; empty; no results; error; and archive confirmation without a restore
  affordance.

  New/edit form: rule name, charge, optional pincode, optional warehouse,
  minimum/maximum order, free-delivery threshold, priority, active status,
  matching guidance, validation, pending, success, failure, unsaved changes.

- [ ] **Step 4: Build quote-request hub and queue**

  Hub: new/contacted/quoted/closed metrics and queue route.

  Queue: status filter; exact Customer/Contact/Request/Status/Quotation/Created/
  Action columns; selected request side panel; customer/request context; status
  action; loading; empty; no results; and request error. Do not invent a detail
  route or delete/archive workflow.

- [ ] **Step 5: Build quotation workspace states**

  Include editable lines with SKU, item, quantity, unit price, tax, optional
  product/variant IDs, add/remove line, shipping, validity date, customer
  notes, calculated totals, existing quote summary, validation, save/send
  pending, success, and failure.

- [ ] **Step 6: Validate Task 8**

  Assert eight route frames, complete coupon and delivery-charge fields,
  complete quote line editor, overlays, status feedback, correct bindings, and
  intact component instances with no unsupported restore/import/export/bulk
  controls. Screenshot routes and side panels.

- [ ] **Step 7: Save a version-history checkpoint**

  Title: `SMP Admin - commercial`.

### Task 9: Build settings and RBAC routes

**Files:**

- Modify: Figma page `08 - Settings and RBAC`
- Read: `apps/admin/app/settings/_components/settings-sections.tsx`
- Read: `apps/admin/lib/permissions.ts`
- Read: `apps/admin/lib/settings-management.ts`

**Interfaces:**

- Consumes: foundations and shell
- Produces: route frames for `/settings`, `/settings/admin-users`,
  `/settings/roles`, and `/settings/permissions`

- [ ] **Step 1: Create route wrappers**

  Create four populated route frames and sections for create/edit user,
  password, delete, role constraints, and permission explanations.

- [ ] **Step 2: Build settings hub**

  Add administrator, active, suspended, role, and permission metrics with route
  cards and high-risk access-management context.

- [ ] **Step 3: Build admin-user route**

  Add search, role, and status filters; exact Admin/Email/Role/Status/Last login/
  Actions columns; create/edit panel; first/last name; email; mobile; role;
  status; password/new password; visibility and strength/help; validation;
  suspended status; system-role constraints; self-delete unavailable; delete
  confirmation; loading; empty; no results; request error; pending; success;
  and failure.

- [ ] **Step 4: Build role route**

  Add exact Role/Type/Description/Permissions columns, system/custom
  distinction, permission counts, read-only detail drawer backed by the
  implemented role-detail endpoint, loading, empty, and error. Do not add role
  create/edit/delete.

- [ ] **Step 5: Build permission route**

  Add grouped searchable permission catalog with exact Code/Name/Description
  columns, loading, empty, no results, and error. Do not add permission
  create/edit/delete.

- [ ] **Step 6: Validate Task 9**

  Assert four route frames, complete admin-user fields, role/permission
  semantics, read-only role detail, permission-aware actions, correct bindings,
  no invented RBAC CRUD, and intact component instances. Screenshot every
  route and destructive state.

- [ ] **Step 7: Save a version-history checkpoint**

  Title: `SMP Admin - settings and RBAC`.

### Task 10: Build shared states, overlays, and route mappings

**Files:**

- Modify: Figma page `09 - States Overlays and Flow Reference`
- Read: `apps/admin/components/admin/confirmation-dialog.tsx`
- Read: `apps/admin/components/admin/empty-state.tsx`
- Read: `apps/admin/components/admin/loading-state.tsx`
- Read: `apps/admin/components/ui/dialog.tsx`
- Read: `apps/admin/components/ui/drawer.tsx`
- Read: `apps/admin/components/ui/dropdown.tsx`
- Read: `apps/admin/components/ui/select.tsx`

**Interfaces:**

- Consumes: state requirements and route frame IDs from Tasks 2-9
- Produces: state and overlay frame IDs plus route/state mapping annotations

- [ ] **Step 1: Build global-state board**

  Create app/session loading, background refresh, metric/filter/table/form/
  detail/chart skeletons, first-use empty, no results, partial failure,
  full-page retryable error, offline, stale data, unavailable record,
  permission denied, permission-limited action, toasts, and inline alerts.

- [ ] **Step 2: Build control and form-state board**

  Create default, hover, focus, filled, disabled, read-only, invalid, valid,
  required, optional, help, count, validation, submit pending/success/failure,
  server error, reset confirmation, dependent select, rich text, and JSON
  editor examples.

- [ ] **Step 3: Build upload-state board**

  Create empty, selected, progress, processing, complete preview, unsupported,
  too large, network retry, and remove confirmation examples.

- [ ] **Step 4: Build overlay board**

  Create standard confirmation, destructive confirmation, business-rule
  warning, child-category modal, row menu, searchable select with long/loading/
  empty results, filter drawer, edit drawer, navigation drawer, account menu,
  tooltip, date treatment, and toast stack.

- [ ] **Step 5: Add route/state mappings**

  Add a matrix that maps every state and overlay example to the exact routes
  that use it. Do not use a generic `all routes` label when only a subset
  applies.

- [ ] **Step 6: Validate Task 10**

  Assert every state and overlay named in the specification exists, each has
  route references, modals/drawers define focus and footer behavior, touch
  targets meet requirements, reusable state/overlay components remain intact,
  and route-specific copy/actions are accurate. Screenshot each board at
  readable detail.

- [ ] **Step 7: Save a version-history checkpoint**

  Title: `SMP Admin - states and overlays`.

### Task 11: Build responsive route coverage

**Files:**

- Modify: Figma pages `01 - Global Shell and Authentication` through
  `09 - States Overlays and Flow Reference`
- Read: `apps/admin/app/globals.css`
- Read: route frame IDs from Tasks 2-9

**Interfaces:**

- Consumes: completed desktop route anatomy
- Produces: tablet/mobile route frames and route-to-breakpoint matrix

- [ ] **Step 1: Build tablet anatomy frames**

  Create an 834-pixel treatment for every route in its domain page. Reuse the
  tablet shell/top bar/drawer, retain tables only when essential columns remain
  readable, move lower-priority data into expandable row detail, collapse
  two-column forms to one column where needed, and adapt split list/detail
  workspaces into list-plus-drawer flows.

- [ ] **Step 2: Build mobile anatomy frames**

  Create a 390-pixel treatment for every route in its domain page. Use the
  mobile top bar and left navigation drawer, bottom-sheet filters,
  route-specific entity cards for dense tables, one-column forms, sticky bottom
  actions, full-width/bottom-aligned overlays, and 44-pixel minimum targets.
  Preserve horizontally scrollable matrices only for report comparisons.

- [ ] **Step 3: Build the route-to-anatomy matrix**

  On `09 - States Overlays and Flow Reference`, list all 52 route entry points
  with the literal desktop, tablet, and mobile frame IDs. `/` maps to redirect;
  `/login` maps to login; every remaining route maps to an explicit route
  frame.

- [ ] **Step 4: Validate Task 11**

  Assert 52 tablet mappings, 52 mobile mappings, no overflow or clipped text,
  44-pixel touch targets, sticky actions that do not obscure content, correct
  bindings, route-specific mobile data hierarchy, and intact component
  instances.

- [ ] **Step 5: Save a version-history checkpoint**

  Title: `SMP Admin - responsive coverage`.

### Task 12: Connect flows and run the final audit

**Files:**

- Modify: Figma page `09 - States Overlays and Flow Reference`
- Read: all completed Figma page and frame IDs
- Read: `docs/superpowers/specs/2026-07-31-smp-admin-figma-design.md`

**Interfaces:**

- Consumes: every `FigmaPageBuildResult`
- Produces: final prototype, coverage matrix, audit results, and handoff

- [ ] **Step 1: Build the master coverage matrix**

  Add rows for all 52 routes and columns for populated/default, loading, empty/
  no-results, error, permission, overlay/action, tablet, mobile, and prototype
  flow. Link each cell to the applicable frame or state board.

- [ ] **Step 2: Connect 17 prototype flows**

  Connect the exact flows listed in the specification. Use 180-240 millisecond
  transitions; use instant transitions for the reduced-motion annotation.
  Destructive flows must pass through confirmation.

- [ ] **Step 3: Add flow-map documentation**

  Show domain entry points, route-to-route navigation, overlay entry/exit,
  success destinations, error retry loops, and permission branches.

- [ ] **Step 4: Run programmatic structural audit**

  Inspect each page in a separate read-only call:

  - page name
  - top-level sections and route frames
  - text font families
  - variable bindings
  - unfinished-content markers
  - components and component sets
  - instance references and detached-instance count
  - route-specific table/filter/action contracts
  - local styles

  Fail the audit if an expected reusable family is missing, an instance is
  detached/broken, a route-specific composition implies unsupported behavior,
  a local style or unfinished marker remains, an unsupported font appears, or a route
  is missing.

- [ ] **Step 5: Run visual audit**

  Screenshot every page overview. Screenshot at high resolution:

  - Login
  - Desktop shell
  - Dashboard
  - Product list
  - Product create
  - Inventory actions
  - Warehouse staff
  - Order detail
  - Return disposition
  - Customer detail
  - Delivery partner
  - Quote editor
  - Admin user edit
  - Global states
  - Mobile filtered table
  - Mobile long form

  Fix clipped text, layout overlap, weak contrast, inconsistent spacing,
  filler copy, incorrect font, and unbound eligible values before
  proceeding.

- [ ] **Step 6: Verify accessibility and content fidelity**

  Confirm WCAG AA contrast, focus treatment, target sizes, non-color status
  communication, semantic table reading order, full-value treatment for
  truncation, overlay focus behavior, realistic Indian/SMP data, and no
  unsupported capabilities.

- [ ] **Step 7: Save final version history**

  Call `figma.saveVersionHistoryAsync` with title
  `SMP Admin - complete production design` and description containing route,
  state, responsive, component-integrity, and code-parity audit results.

- [ ] **Step 8: Deliver handoff**

  Report the Figma URL, created page names, 52-route coverage result, variable
  collection result, prototype-flow result, responsive result, accessibility
  result, and explicit counts for components, component sets, instances, and
  local styles.
