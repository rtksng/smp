# SMP Admin Figma Design Specification

## Status

Approved visual direction: **Premium Operations, light theme only**.

This specification is the review gate before the Figma canvas is changed. The
target file is the existing blank Figma Design file:

- File: `SMP Admin`
- File key: `cQswQB7IOSTQwgqvKeojzv`
- Current canvas: one empty page named `Page 1`

## Outcome

Create a complete, production-ready design of the SMP admin application in
Figma. The design must cover every current route, inner page, business flow,
overlay, responsive pattern, permission state, and system state represented by
the admin codebase.

The application under `apps/admin` is the functional source of truth. The
Figma work may improve information architecture, hierarchy, density, and
interaction clarity, but it must not invent unsupported business capabilities
or change the meaning of existing routes, permissions, fields, statuses, or
actions.

## Binding Constraints

- Use a light application theme with a dark forest-green navigation sidebar.
- Use the approved Premium Operations visual language.
- Do not create Figma components, component sets, variants, or instances.
- Create and bind Figma variables for the design foundations.
- Repeated visual structures remain one-off auto-layout groups on each screen.
- Do not create a separate reusable-component or UI-kit page.
- Preserve every current route and workflow.
- Treat permission filtering, disabled actions, errors, loading, and empty
  states as first-class product states.
- Desktop is the primary operational viewport, with defined tablet and mobile
  adaptations.
- Use realistic SMP medical-commerce content in every populated example.

## Product and UX Principles

### Operational clarity

The interface is an operations console, not a marketing site. Critical data,
filters, statuses, and actions should be immediately scannable. Decorative
elements must never compete with business information.

### Premium restraint

Premium quality comes from typography, proportion, spacing, alignment, and
precise interaction states. Avoid excessive gradients, glass effects, oversized
headings, decorative blobs, and nested cards without a functional grouping
reason.

### Progressive disclosure

Keep frequent actions visible and move secondary or destructive actions into
menus, drawers, or confirmations. Long workflows use clear sections, sticky
actions where useful, and explicit completion feedback.

### Permission awareness

Navigation and actions change with the signed-in administrator's permissions.
The design must distinguish hidden navigation, disabled controls with an
explanation, and explicit access-denied states.

### Dense but humane

Tables may remain information-dense, but row height, typography, column
hierarchy, truncation, sticky headers, horizontal overflow, and row actions
must remain readable and predictable.

## Figma File Architecture

Rename the existing page and create the following Figma pages:

1. `00 - Foundations`
2. `01 - Auth and Shell`
3. `02 - Dashboard and Reports`
4. `03 - Catalog`
5. `04 - Inventory and Warehouses`
6. `05 - Orders Returns Customers`
7. `06 - Delivery`
8. `07 - Commercial and Support`
9. `08 - Settings and Access`
10. `09 - States and Overlays`
11. `10 - Responsive`
12. `11 - Flow Map and Coverage`

Each page uses sections to group related route frames and state boards. Desktop
frames are 1440 pixels wide. Primary route frames should use descriptive names
with their real path, for example:

`Desktop / Catalog / Products /products / Populated`

State frames append the state:

`Desktop / Catalog / Products /products / Empty`

## Design Variables

Variables are the only reusable design-system artifacts in this file. Do not
create local paint styles, text styles, effect styles, components, or component
sets.

### Collection: `Admin / Color`

Single mode: `Light`.

#### Brand and accent

- `brand/950`: `#0E241D`
- `brand/900`: `#123129`
- `brand/800`: `#174335`
- `brand/700`: `#1D6147`
- `brand/600`: `#247B56`
- `brand/500`: `#32996B`
- `brand/200`: `#BDE8D1`
- `brand/100`: `#DDF4E7`
- `brand/50`: `#EFFAF4`

#### Neutral

- `neutral/950`: `#15201C`
- `neutral/800`: `#33413B`
- `neutral/700`: `#53635C`
- `neutral/600`: `#697970`
- `neutral/500`: `#87958F`
- `neutral/300`: `#C6D2CD`
- `neutral/200`: `#DCE5E1`
- `neutral/100`: `#EDF2F0`
- `neutral/50`: `#F7F9F8`
- `neutral/0`: `#FFFFFF`

#### Status

- `success/700`: `#176B45`
- `success/100`: `#DDF5E8`
- `warning/700`: `#9A640F`
- `warning/100`: `#FFF0C7`
- `danger/700`: `#B63232`
- `danger/100`: `#FDE3E3`
- `info/700`: `#285EB8`
- `info/100`: `#E1ECFF`

#### Semantic aliases

- `bg/canvas`: `neutral/100`
- `bg/surface`: `neutral/0`
- `bg/surface-subtle`: `neutral/50`
- `bg/sidebar`: `brand/950`
- `bg/sidebar-active`: translucent white at 10 percent
- `bg/overlay`: translucent `neutral/950` at 48 percent
- `text/primary`: `neutral/950`
- `text/secondary`: `neutral/700`
- `text/tertiary`: `neutral/500`
- `text/inverse`: `neutral/0`
- `text/link`: `brand/700`
- `border/default`: `neutral/200`
- `border/strong`: `neutral/300`
- `border/focus`: `brand/600`
- `action/primary`: `brand/700`
- `action/primary-hover`: `brand/800`
- `action/primary-pressed`: `brand/900`
- `action/primary-disabled`: `neutral/300`
- `action/secondary-hover`: `brand/50`
- `status/success-text`: `success/700`
- `status/success-bg`: `success/100`
- `status/warning-text`: `warning/700`
- `status/warning-bg`: `warning/100`
- `status/danger-text`: `danger/700`
- `status/danger-bg`: `danger/100`
- `status/info-text`: `info/700`
- `status/info-bg`: `info/100`

Primitive variables are hidden from property pickers where possible; semantic
aliases are bound to fills, text, and strokes.

### Collection: `Admin / Spacing and Size`

Single mode: `Default`.

- Spacing: `0`, `2`, `4`, `6`, `8`, `10`, `12`, `16`, `20`, `24`, `32`,
  `40`, `48`, `64`
- Control heights: `32`, `36`, `40`, `44`, `48`
- Icon sizes: `12`, `14`, `16`, `18`, `20`, `24`
- Sidebar width: `272`
- Desktop workspace padding: `32`
- Tablet workspace padding: `24`
- Mobile workspace padding: `16`
- Table compact row: `44`
- Table default row: `52`
- Modal widths: `420`, `560`, `720`
- Drawer widths: `400`, `480`, `560`

Bind spacing variables to gaps and padding, and size variables to supported
width, height, and stroke properties.

### Collection: `Admin / Radius`

Single mode: `Default`.

- `radius/none`: `0`
- `radius/xs`: `4`
- `radius/sm`: `6`
- `radius/md`: `8`
- `radius/lg`: `12`
- `radius/xl`: `16`
- `radius/pill`: `999`

Primary panels use 12 pixels. Inputs, buttons, tables, and menus use 8 pixels.
Small tags and icon containers use 6 pixels or the pill value where
appropriate.

### Collection: `Admin / Typography`

Single mode: `Default`.

Primary family: `Plus Jakarta Sans`.

Optional data family: `Geist Mono` for SKUs, order numbers, warehouse codes,
IDs, and technical values where monospaced alignment materially improves
scanning.

Define variables for:

- Font family
- Font weight
- Font size
- Line height
- Letter spacing

Named roles:

- `display`: 32/40, weight 700
- `page-title`: 28/36, weight 700
- `section-title`: 20/28, weight 700
- `card-title`: 16/24, weight 650
- `body-lg`: 16/26, weight 450
- `body`: 14/22, weight 450
- `body-strong`: 14/22, weight 650
- `label`: 13/18, weight 650
- `caption`: 12/18, weight 500
- `overline`: 11/16, weight 700, 0.08em letter spacing
- `table-header`: 12/16, weight 700
- `table-cell`: 13/20, weight 500
- `code`: 12/18, weight 550, Geist Mono

Text nodes bind directly to these variables. Do not create Figma text styles.

### Collection: `Admin / Elevation`

Single mode: `Default`.

Define effect-field variables for color, blur, spread, and X/Y offset:

- `elevation/0`: none
- `elevation/1`: subtle panel lift, 8 blur, 0 spread, 0/2 offset
- `elevation/2`: menu and sticky bar, 20 blur, -4 spread, 0/8 offset
- `elevation/3`: modal and drawer, 40 blur, -8 spread, 0/18 offset

Shadows use a cool-black color at restrained opacity. The sidebar may use a
separate right-side shadow. Do not create Figma effect styles.

### Collection: `Admin / Motion`

Single mode: `Default`.

- `duration/instant`: `0`
- `duration/fast`: `120`
- `duration/base`: `180`
- `duration/slow`: `240`
- `opacity/disabled`: `0.48`
- `opacity/secondary`: `0.72`
- `opacity/scrim`: `0.48`

Motion values are documented and used in prototype transitions where Figma
supports them. Reduced-motion behavior uses instant transitions.

## Shell and Global Layout

### Desktop shell

- Fixed 272-pixel dark sidebar.
- SMEP mark and `SMP Admin` product title at the top.
- Permission-filtered navigation with route-aware group expansion.
- Clear active route indicator using a low-contrast green surface and bright
  text.
- Scrollable navigation region with pinned operator identity and logout at the
  bottom.
- Workspace on a pale cool-gray canvas with a maximum readable content width
  where appropriate.
- Page header contains breadcrumb, title, concise operational description, and
  route actions.
- Optional sticky local action bar on long forms and record-detail screens.

### Tablet shell

- Compact top bar with menu trigger, page title, and operator avatar.
- Navigation opens in a left drawer.
- Two-column content collapses to one column when the secondary panel would
  become too narrow.

### Mobile shell

- 390-pixel reference viewport.
- Navigation drawer covers most of the viewport and preserves the operator
  footer.
- Tables become horizontally scrollable data regions or route-specific summary
  cards when actions cannot remain usable in a narrow row.
- Filters open in a bottom sheet or stack vertically.
- Sticky bottom action bar is used on long create/edit workflows.

## Shared Screen Anatomy

These are design rules, not Figma components.

### Hub

Page header, high-level metrics, and route cards for the module's major tasks.
Hub cards state the task, current count or status when available, and the
destination route.

### List

Page header, metric strip, filter surface, result summary, table, pagination,
bulk/action affordances where supported, and state messaging.

### Create and edit

Breadcrumb and title, sectioned form, inline validation, contextual help,
upload states where needed, neutral cancel action, primary save action, and
unsaved-changes confirmation.

### Detail

Identity summary, status and key metrics, logically grouped record information,
timeline/history, related records, operational actions, and permission-aware
action states.

### Reports

Filter bar, metric cards, readable charts, table drilldowns, export actions,
empty chart states, loading skeletons, and a clear data timestamp.

## Route Coverage

Every route below receives a named desktop frame. Routes that are redirects or
section hubs are documented rather than silently omitted.

### Entry, authentication, and shell

| Route | Required design |
| --- | --- |
| `/` | Auth-aware redirect/loading handoff to `/dashboard` or `/login` |
| `/login` | Default, focused, submitting, invalid credentials, session-expired, and redirect-in-progress states |
| `/dashboard` | Operational overview based on current reports data, populated/loading/empty/error states |

The shell also needs full-permission, restricted-permission, navigation-scroll,
mobile-drawer, operator-menu, and logout-pending examples.

### Catalog

| Route | Required design |
| --- | --- |
| `/products` | Metrics, product filters, populated table, no-results, initial empty, loading, error, row menu, archive confirmation |
| `/products/create` | Complete product creation form and all nested content states |
| `/products/[id]/edit` | Loaded edit, loading, unavailable, permission denied, validation errors, save pending, save success, unsaved changes |
| `/brands` | Brand metrics, search, table, logo/no-logo rows, loading, empty, row actions, archive confirmation |
| `/brands/create` | Brand create form |
| `/brands/[id]/edit` | Brand edit, loading, unavailable, permission denied, save states |
| `/categories` | Hierarchy metrics, search, root table, child counts, loading, empty, row actions |
| `/categories/create` | Root or child category create form |
| `/categories/[id]/edit` | Category edit and permission/unavailable states |

Product create/edit includes:

- Core details: name, slug, SKU, brand, root category, subcategory, status,
  short description, and rich description.
- Pricing and classification: base price, selling price, MRP, tax, unit, pack
  size, material, specialty, expiry-sensitive, sterile, and disposable
  controls.
- SEO and search: meta title, meta description, and search tags.
- Images: upload/URL entry, preview, alt text, primary status, sort order,
  upload progress, upload failure, and removal.
- Variants: add, edit, reorder/remove, name, SKU, prices, status, and
  attributes JSON validation.
- Documents: add, upload, title, type, file key/URL, progress, failure, and
  removal.
- Rich-text toolbar and editor focus/empty/validation states.

Brand forms include name, generated/editable slug, description, image upload or
URL, active status, validation, and upload failure.

Category forms include name, slug, parent/root selection, sort order,
description, image, active status, and root/child relationship guidance. The
category list also needs the child-category modal in populated and empty
states.

### Product feedback

| Route | Required design |
| --- | --- |
| `/product-feedback` | Hub with review/question metrics and task routes |
| `/product-feedback/reviews` | Moderation filters, review table, status actions, moderation note, loading/empty/error |
| `/product-feedback/questions` | Question filters, answer composer, status actions, moderation note, loading/empty/error |

Show pending, published/approved, answered, and hidden treatments without
depending on color alone. Include answer-save pending, moderation pending,
success, and failure feedback.

### Inventory

| Route | Required design |
| --- | --- |
| `/inventory` | Stock metrics, filters, stock table, low-stock emphasis, near-expiry panel, loading/empty/error |
| `/inventory/actions` | Stock-in, adjustment, and transfer task tabs with forms, previews, validation, confirmations, success/failure |
| `/inventory/movements` | Movement filters, audit table, loading/empty/error |

Stock-in includes product, optional variant, warehouse, batch number, expiry,
quantity, purchase price, selling price, MRP, reorder threshold, notes, and
auto-publish context.

Adjustment includes product, optional variant, warehouse, optional batch,
quantity delta, reorder threshold, and reason.

Transfer includes product, optional variant, source warehouse, destination
warehouse, optional batch, quantity, and notes.

The design must make it explicit that product creation does not create
inventory and that stock belongs to warehouse/product/variant and, where
applicable, batch.

### Warehouses

| Route | Required design |
| --- | --- |
| `/warehouses` | Warehouse analytics, metrics, state footprint, loading/empty/error |
| `/warehouses/list` | Filters, table, active/inactive status, row actions, loading/empty/error |
| `/warehouses/create` | Complete warehouse form, validation, save states |
| `/warehouses/staff` | Warehouse selector, assigned staff, add/remove workflow, permission unavailable, loading/empty/error |

Warehouse form fields: name, code, address, city, state, six-digit pincode,
optional latitude/longitude, contact person, contact number, and status.
Include edit treatment where the existing list opens the edit workflow.

### Orders

| Route | Required design |
| --- | --- |
| `/orders` | Hub with operational order tasks and metrics |
| `/orders/list` | Status/payment/warehouse/date/customer/order filters, table, pagination, loading/empty/error |
| `/orders/[id]` | Full order detail and operational action states |

Order detail contains:

- Status, payment, warehouse, and total metrics.
- Customer information and link to customer record.
- Delivery address.
- Order-item table with product, variant, quantity, price, tax, and totals.
- Linked warehouse.
- Subtotal, discount, delivery, tax, and grand total.
- Payment detail.
- Invoice detail and PDF state.
- Order status timeline.
- Update-status action with no-next-status state.
- Cancel-order action with unavailable and destructive confirmation states.
- Assign-delivery action with partner, pickup warehouse, instructions,
  unavailable/loading/empty states, and success/failure feedback.

### Returns and refunds

| Route | Required design |
| --- | --- |
| `/returns-refunds` | Hub with active/completed/failed metrics and task route |
| `/returns-refunds/requests` | Filters, request table, refund workflow, loading/empty/error |

Include internal note entry, returned-item selection, disposition quantity,
disposition outcome, inspection note, refund status, action pending, action
success, action failure, and permission unavailable states.

### Customers

| Route | Required design |
| --- | --- |
| `/customers` | Hub with customer metrics and list route |
| `/customers/list` | Search/status filters, account table, loading/empty/error |
| `/customers/[id]` | Complete customer detail and support actions |

Customer detail contains:

- Status, order, address, and GSTIN metrics.
- Name, mobile, email, business, GSTIN, created date, and customer ID.
- Account status update with internal reason and permission-unavailable state.
- Saved addresses.
- Order history.
- Internal support notes with add-note permission state.
- Status-change confirmation, pending, success, and failure.

### Delivery

| Route | Required design |
| --- | --- |
| `/delivery` | Delivery hub with partner and assignment metrics |
| `/delivery/partners` | Filters, partner list, selected partner detail, approvals, documents, loading/empty/error |
| `/delivery/assign` | Assignable order, partner, pickup warehouse, instructions, preview, validation, empty dependencies, success/failure |
| `/delivery/assignments` | Filters, assignment table, selected detail/timeline, loading/empty/error |

Partner detail includes identity, mobile, email, verification status, vehicle,
wallet, earnings, availability, last seen, creation date, documents, and
approval/suspension actions. Destructive or high-impact status changes require
confirmation.

### Commercial operations

| Route | Required design |
| --- | --- |
| `/coupons` | Hub with coupon metrics and routes |
| `/coupons/list` | Filters, table, edit side panel, loading/empty/error, archive confirmation |
| `/coupons/new` | Complete create form |
| `/delivery-charges` | Hub with rule metrics and routes |
| `/delivery-charges/rules` | Filters, rule table, edit side panel, loading/empty/error, archive confirmation |
| `/delivery-charges/new` | Complete create form |

Coupon form includes code, discount type, value, minimum order, maximum
discount, usage limit, start, expiry, and active status.

Delivery-charge form includes rule name, charge, optional pincode, optional
warehouse, minimum/maximum order, free-delivery threshold, priority, and active
status. Explain matching precedence and optional scopes in contextual copy.

### Quote requests

| Route | Required design |
| --- | --- |
| `/quote-requests` | Hub with new/contacted/quoted/closed metrics |
| `/quote-requests/requests` | Filters, queue table, selected request/quotation workspace, loading/empty/error |

Quotation workspace includes status, request/customer context, editable quote
lines, SKU, item name, quantity, unit price, tax, optional product and variant
IDs, shipping, validity date, customer notes, calculated totals, existing quote
summary, save/send pending, success, and failure.

### Reports

| Route | Required design |
| --- | --- |
| `/reports` | Report hub and overview metrics |
| `/reports/sales` | Revenue trends, summary metrics, drilldown table |
| `/reports/orders` | Order trends, status/payment filters, drilldown table |
| `/reports/products` | Top-product analysis and drilldown |
| `/reports/inventory` | Stock alerts, low-stock/near-expiry analysis |
| `/reports/warehouses` | Warehouse stock summary and drilldown |

All report screens include date filters, relevant warehouse/status/payment
filters, applied-filter summary, reset, export, data timestamp, chart loading,
no-data, request error, and export pending/success/failure states. Charts must
remain legible without color and expose data in an accompanying table.

### Settings and access

| Route | Required design |
| --- | --- |
| `/settings` | Settings hub with administrator, role, and permission metrics |
| `/settings/admin-users` | Filters, table, create/edit panel, delete confirmation, loading/empty/error |
| `/settings/roles` | Role cards or table with permission sets, loading/empty/error |
| `/settings/permissions` | Searchable/grouped permission catalog, loading/empty/error |

Admin-user form includes first name, last name, email, mobile, role, status,
and create/new-password behavior. Include password visibility, strength/help,
validation, suspended status, system-role constraints, permission explanation,
delete unavailable, delete confirmation, pending, success, and failure states.

## States and Overlays

The `09 - States and Overlays` page contains one-off, variable-bound examples
with route references. Each route frame is annotated with the states that
apply.

### Global states

- App/session loading
- Background refresh without replacing loaded content
- Skeleton loading for metric, filter, table, form, detail, and chart layouts
- First-use empty state
- No search or filter results
- Partial data where one panel fails and other data remains usable
- Full-page network/server error with retry
- Offline state
- Stale-data warning
- Route not found or record unavailable
- Permission denied
- Permission-limited action with explanation
- Success, information, warning, and failure toast
- Persistent inline alert

### Form states

- Default, hover, focus, filled, disabled, read-only, invalid, and valid control
  treatments
- Required and optional labels
- Help text, character count, and validation message
- Submit idle, pending, success, and failure
- Server-level form error
- Unsaved changes confirmation
- Reset confirmation
- Dependent select loading/empty/disabled
- Rich-text empty/focused/invalid
- JSON editor valid/invalid

### Upload states

- Empty drop/upload area
- File selected
- Upload progress
- Upload processing
- Upload complete with preview
- Unsupported file
- File too large
- Network failure with retry
- Remove-file confirmation

### Overlays

- Standard confirmation
- Destructive confirmation
- Blocking business-rule warning
- Child-category modal
- Row-action menu
- Select popover with search, long options, no results, and loading
- Filter drawer/bottom sheet
- Create/edit side panel
- Navigation drawer
- Operator/account menu
- Tooltip
- Date input/calendar treatment
- Toast stack

Every modal and drawer includes title, description, focus target, close action,
scroll behavior, sticky action footer where needed, escape/backdrop behavior,
and mobile treatment.

## Primary Prototype Flows

Connect the following flows on the `11 - Flow Map and Coverage` page:

1. Sign in, handle invalid credentials, and reach dashboard.
2. Navigate with full permissions and with a restricted operator.
3. Create a brand and category, then create a product using them.
4. Create a product with image, variant, document, and validation failure.
5. Receive inventory for a product and verify the resulting stock state.
6. Adjust and transfer stock with confirmation and error handling.
7. Create a warehouse and assign staff.
8. Filter orders, open order detail, update status, cancel, and assign delivery.
9. Review a return, record disposition, and progress the refund.
10. Open a customer, change account status, and add a support note.
11. Review a delivery partner and assign an eligible order.
12. Moderate a product review and answer a product question.
13. Build and save a quote with multiple line items.
14. Create/edit/archive a coupon.
15. Create/edit/archive a delivery-charge rule.
16. Filter a report, drill into data, and export.
17. Create/edit/delete an admin user and inspect role/permission context.

Prototype connections use restrained 180–240 millisecond transitions. Destructive
actions never jump directly to a success state without a confirmation frame.

## Responsive Coverage

All 52 route entry points receive a desktop design. The responsive page contains
tablet and mobile adaptations for every unique screen anatomy:

- Login
- Shell and navigation
- Hub
- Metric-heavy dashboard
- Filtered table
- Long create/edit form
- Product nested form
- Record detail with timeline and actions
- Report with charts and drilldown
- Split list/detail workspace
- Settings access management
- Modal
- Drawer
- Bottom-sheet filters
- Loading, empty, error, and permission states

The responsive frame annotations map each route to one of these anatomies, so no
route lacks a defined collapse behavior.

## Accessibility

- Text and meaningful icons meet WCAG AA contrast.
- Body text targets at least 4.5:1 contrast.
- Focus is always visible and uses both border and ring treatment.
- Interactive targets are at least 40 pixels on desktop and 44 pixels on touch
  layouts.
- Status is communicated through label, icon, and color.
- Tables retain headers and reading order.
- Truncated values expose their complete value through an accessible detail or
  tooltip pattern.
- Icon-only actions have visible tooltips and accessible names.
- Dialogs and drawers define focus entry, focus containment, and focus return.
- Errors are located near the relevant field and summarized when the form is
  long.
- Reduced-motion behavior is documented.

## Content and Data Fidelity

- Use current route names and current visible field labels.
- Use realistic surgical-product, warehouse, order, delivery, and customer
  examples.
- Use Indian currency, phone, GSTIN, pincode, and address formats where the
  existing application does.
- Preserve the relationship between products, variants, warehouses, inventory,
  batches, movements, orders, reservations, and delivery.
- Preserve current status semantics.
- Do not add unsupported charts, metrics, bulk actions, or integrations.
- Product and brand images may use representative local SMP assets where
  available. Image absence must also have a designed treatment.

## Figma Construction Rules

- Use auto-layout for all structural groups.
- Bind every eligible color, spacing, radius, typography, opacity, and effect
  field to the corresponding variable.
- Use SVG imports for Lucide icons. Do not reconstruct icons from lines or
  rotated primitives.
- Give every top-level frame a clear route/state name.
- Place screens in predictable left-to-right flows with generous canvas
  separation.
- Do not create components, component sets, variants, or instances.
- Do not create local styles.
- Do not leave shimmer placeholders on completed work.

## Verification and Acceptance

Before handoff:

1. Confirm the file contains the 12 named pages.
2. Confirm all 52 route entry points are represented or explicitly documented
   when the route is a redirect.
3. Confirm all primary flows have connected prototype paths.
4. Confirm all required global, form, upload, overlay, permission, and
   destructive states exist.
5. Confirm responsive mappings cover every route.
6. Programmatically confirm there are zero components, zero component sets, and
   zero instances created by this work.
7. Confirm the variable collections, modes, names, values, scopes, and bindings.
8. Confirm all rendered text uses Plus Jakarta Sans or the approved Geist Mono
   data role.
9. Screenshot every page overview and inspect representative screens at high
   resolution.
10. Inspect individual sections for clipped text, broken auto-layout, overflow,
    placeholder copy, inconsistent spacing, and unbound values.
11. Verify contrast, focus, touch target, and status communication rules.
12. Verify the Figma work did not change application code or backend behavior.

The design is complete only when route coverage, flow coverage, state coverage,
responsive coverage, and the no-components constraint all pass this audit.
