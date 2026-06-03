# Admin HeroUI Modernization Design

## Context

The admin app is a Next.js 16 and React 19 application under `apps/admin`. It
currently mixes a global custom CSS admin shell with a recent shadcn-style
component foundation in `apps/admin/components/ui`. That foundation is backed by
Radix primitives for checkbox, dialog, label, select, and slot behavior.

The requested change is a full admin panel visual modernization using HeroUI as
the primary frontend UI system. This is a UI/UX redesign only. Backend code,
API contracts, database logic, authentication, permissions, routing, data flow,
validation, mutation behavior, and business rules must remain unchanged.

## Approved Visual Direction

Use Direction A: **Clinical Command Center**.

The admin experience should feel like a premium medical-commerce operations
console:

- Fixed dark SMEP sidebar with clear product identity and operator profile.
- Pale medical-gray workspace background.
- White HeroUI surfaces with subtle borders and restrained elevation.
- Teal primary actions and medical green supporting accents.
- Compact but readable tables, filters, forms, and CRUD controls.
- Strong hierarchy without marketing-style hero sections.
- Minimal visual clutter, no decorative blobs, no purple gradient theme, no
  beige/cream rewrite, and no nested-card layouts.

Visual references are committed alongside this spec:

- `docs/superpowers/specs/assets/2026-06-04-admin-heroui-dashboard-concept.png`
- `docs/superpowers/specs/assets/2026-06-04-admin-heroui-crud-concept.png`

These concept images are visual anchors, not new product requirements. They
define density, palette, component treatment, and information hierarchy while
existing app routes and workflows remain the source of functional truth.

## Goals

- Replace Radix/shadcn-backed admin UI primitives with HeroUI-based components.
- Remove direct Radix UI imports and direct Radix dependencies from the admin
  frontend.
- Modernize the entire admin app, including shell, login, dashboard, reports,
  products, categories, brands, inventory, orders, order detail, customers,
  warehouses, delivery, settings, and shared resource screens.
- Preserve all CRUD operations, filters, pagination, tables, forms, uploads,
  confirmation flows, rich text editing, mutations, loading states, empty
  states, and error states.
- Keep the visual system consistent across desktop, tablet, and mobile.
- Prefer HeroUI prebuilt components whenever they fit the existing behavior.

## Non-Goals

- Do not modify API endpoints, request payloads, response parsing, DTOs, Prisma
  schema, backend services, worker code, or customer web app behavior.
- Do not alter authentication, authorization, session refresh, permissions, or
  protected route behavior.
- Do not rename existing functions, variables, hooks, route helpers, service
  calls, query keys, form field names, or validation schemas unless a local
  HeroUI adapter absolutely requires it.
- Do not replace working routes with new drawer-only navigation. Drawers may
  improve local editing/detail experiences only where they do not change route
  semantics or data flow.
- Do not introduce a marketing landing page, oversized hero dashboard, or
  decorative visual system.

## Architecture

### HeroUI Foundation

Add a HeroUI provider in `apps/admin/app/providers.tsx` around the existing
`QueryClientProvider` and `AdminSessionProvider`. Keep provider order compatible
with current session and query behavior.

Use targeted HeroUI packages for the admin surface instead of the broad package
when that helps avoid pulling direct Radix-backed surfaces into the app. The
initial component set should cover:

- Button
- Input and Textarea
- Select
- Checkbox and Switch
- Card
- Chip or Badge equivalent
- Table
- Modal
- Drawer
- Dropdown
- Tabs
- Tooltip
- Pagination
- Spinner and skeleton/loading surfaces

Keep HeroUI imports centralized behind admin-local wrappers when existing page
code benefits from a stable interface. The preferred pattern is:

- `apps/admin/components/ui/*`: HeroUI-backed compatibility primitives for
  repeated controls.
- `apps/admin/components/admin/*`: workflow-level admin components such as
  status badges, metric cards, confirmation dialogs, file-upload controls,
  empty states, loading panels, filter bars, and pagination controls.

This lets pages move from Radix/shadcn to HeroUI without rewriting business
logic or spreading HeroUI API details through every CRUD screen.

### Radix Removal

Remove all direct admin imports from `@radix-ui/*` and `radix-ui`. Delete or
rewrite the Radix-backed component implementations:

- `apps/admin/components/ui/button.tsx`
- `apps/admin/components/ui/checkbox.tsx`
- `apps/admin/components/ui/dialog.tsx`
- `apps/admin/components/ui/label.tsx`
- `apps/admin/components/ui/select.tsx`

Remove direct Radix package entries from `apps/admin/package.json` after the
HeroUI replacements compile:

- `@radix-ui/react-checkbox`
- `@radix-ui/react-dialog`
- `@radix-ui/react-label`
- `@radix-ui/react-select`
- `@radix-ui/react-slot`
- `radix-ui`

The final verification should include a source scan proving admin code has no
direct Radix imports. If a third-party HeroUI package has an internal transitive
dependency, the app still must not import, wrap, or render Radix components
directly.

## Design System

Keep the SMEP medical operations identity, refined toward the approved concept:

- Sidebar background: deep blue-green/charcoal.
- Workspace background: pale medical gray.
- Surfaces: white, bordered, low elevation.
- Primary action: teal.
- Success: medical green.
- Warning: amber/orange.
- Danger: red.
- Radius: 8px or smaller for panels, inputs, buttons, and menus.
- Typography: existing Outfit font, explicit sizes for controls, tables, chips,
  captions, labels, and body text.
- Motion: short, subtle transitions for hover, menu, modal, drawer, tab, and
  loading state changes. Respect reduced-motion preferences.

Avoid one-off styling. Repeated buttons, chips, cards, filters, table cells,
modal footers, and pagination controls should share components or variants.

## Surface Design

### Shell and Navigation

Modernize `AdminShell` without changing `getVisibleNavigationItems`,
permission filtering, logout behavior, or route paths.

- Keep fixed sidebar on desktop.
- Add compact mobile/tablet navigation behavior using a HeroUI drawer or
  equivalent controlled shell.
- Add a workspace top bar area for page title, search/action slots, and user
  context where pages need it.
- Preserve the current admin identity footer and logout flow.
- Use lucide icons for nav items where they clarify scanning.

### Dashboard and Reports

Use HeroUI cards, chips, tabs, filters, and tables/charts styling around the
existing reports data.

- Preserve `ReportsDashboard` data queries and filter logic.
- Keep date range and near-expiry controls behavior.
- Improve metric cards, chart panels, loading states, error states, and empty
  charts.
- Do not invent new analytics endpoints or metrics.

### CRUD List Screens

Products, categories, brands, customers, warehouses, inventory, orders,
delivery, and settings should share a consistent operational pattern:

- Page header with title, concise support text, and primary action.
- Filter bar using HeroUI Input, Select, Checkbox/Switch, Button, and Dropdown.
- HeroUI Table for tabular data where practical.
- Chip-based status indicators.
- Dropdown row actions or compact icon buttons with tooltips.
- Pagination using HeroUI Pagination or a wrapper that preserves existing page
  query behavior.
- Empty and loading states using shared admin components.

### Forms

Preserve current form state, schema validation, submit handlers, upload
handlers, and field names.

- Use HeroUI Input, Textarea, Select, Checkbox, Switch, and Button.
- Keep field-level validation text adjacent to the control.
- Use section cards only where they group real form responsibilities.
- For product rich text, keep Lexical and its HTML serialization behavior.
  Modernize the toolbar buttons/selects visually without replacing the editor
  engine.
- File upload controls may use a HeroUI-styled button wrapper, but the actual
  file input and upload logic stay unchanged.

### Modals and Drawers

Use HeroUI Modal for destructive confirmations and compact dialogs. Use HeroUI
Drawer for local edit/detail panels only when it preserves the existing route or
inline workflow.

Confirmation flows must keep current pending states, error handling, and
mutation calls. The visual language should match the CRUD concept: clear title,
plain consequence text, neutral cancel action, and strong destructive action.

### Settings and Permissions

Settings is a high-risk admin surface. Modernize its controls and tables while
preserving:

- Admin user creation/editing.
- Role and permission rendering.
- Delete confirmation.
- Validation and pagination.
- Permission labels and values.

Do not alter role semantics or permission checks.

## Data Flow

All query hooks, API wrappers, route helpers, mutation handlers, Zod schemas,
and state reducers remain functionally unchanged. Component adapters may convert
HeroUI events into the current value shapes, but they must not reshape backend
payloads or alter validation contracts.

For HeroUI controlled selects, use thin adapters so existing string values and
boolean filters continue to work. Keep conversion helpers local and obvious.

## Accessibility

- Preserve semantic labels for every form field.
- Keep tables semantic and keyboard accessible.
- Ensure modals and drawers trap focus and announce titles.
- Keep visible focus states.
- Keep disabled and pending states visible.
- Icon-only controls require accessible names or visible tooltips.
- Maintain color contrast for chips and action states.

## Responsive Behavior

Desktop remains the primary operational view. Tablet and mobile should remain
usable:

- Sidebar collapses into a drawer or compact navigation trigger.
- Tables keep horizontal scroll where data density requires it.
- Filter bars wrap cleanly into stacked controls.
- Forms use one column on small screens.
- Modals and drawers fit viewport height and preserve primary actions.
- Text must not overflow buttons, chips, table cells, or form panels.

## Implementation Strategy

Use a foundation-first migration:

1. Add HeroUI provider, dependencies, theme tokens, and wrappers.
2. Replace Radix-backed shared UI components.
3. Migrate shared admin components.
4. Migrate shell and login.
5. Migrate dashboard and reports.
6. Migrate CRUD/list/form surfaces in risk order:
   - Brands and categories
   - Warehouses
   - Inventory
   - Products
   - Orders and order detail
   - Customers
   - Delivery
   - Settings
7. Remove obsolete Radix dependencies and stale shadcn/Radix tests or rewrite
   them as HeroUI migration guards.
8. Run source scans, tests, type checks, build, and browser QA.

## Testing and Verification

Required commands before completion:

- `corepack pnpm --filter @surgical/admin lint`
- `corepack pnpm --filter @surgical/admin test`
- `corepack pnpm --filter @surgical/admin typecheck`
- `corepack pnpm --filter @surgical/admin build`

If dependency or shared package changes affect the repo, also run the relevant
root `lint`, `test`, `typecheck`, or `build` commands.

Required source checks:

- No `@radix-ui/*` imports in `apps/admin`.
- No `radix-ui` imports in `apps/admin`.
- No direct Radix dependencies in `apps/admin/package.json`.
- HeroUI wrappers are used for repeated buttons, inputs, selects, checkboxes,
  cards, tables, modals, tabs, chips, tooltips, pagination, and loading states.

Required browser QA:

- Login screen.
- Dashboard/reports.
- Product list and product create/edit.
- Brand and category create/edit.
- Inventory overview/actions/movements.
- Warehouse list/staff/create.
- Orders list and order detail.
- Customers list.
- Delivery partners/assignments.
- Settings admin user workflow.
- Desktop and mobile viewport checks.
- Console error check.

Visual QA should compare the rendered app against the two concept images for at
least palette, sidebar anatomy, table density, filters, cards, chips, modal
treatment, drawer/form treatment, spacing, typography, and responsive collapse.

## Risks

- HeroUI Select and Table APIs differ from current native/shadcn components, so
  adapters must preserve value shapes carefully.
- Product management is large and includes Lexical; migrate its chrome without
  replacing editor internals.
- Settings and delivery screens include many local helpers; keep changes visual
  and avoid renaming state handlers.
- Removing Radix after HeroUI migration may expose tests that asserted shadcn
  source strings. Rewrite those tests to protect HeroUI behavior instead of
  deleting coverage.

## Rollout Criteria

The modernization is ready when:

- The whole admin frontend uses HeroUI-based UI surfaces for repeated controls.
- Admin code has no direct Radix imports.
- Admin package dependencies no longer list Radix UI packages directly.
- All existing user flows still operate with the same data and API behavior.
- Lint, tests, typecheck, build, source scans, and browser QA are complete or
  documented with concrete blockers.
- The rendered UI matches the Clinical Command Center direction closely enough
  for production handoff.
