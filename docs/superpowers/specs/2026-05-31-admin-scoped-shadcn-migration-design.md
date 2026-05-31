# Admin Scoped shadcn Migration Design

## Context

The admin app currently uses a custom CSS system for panels, metrics, buttons,
filters, forms, dialogs, status badges, and dense tables. The requested change is
to use `shadcn@latest` components as much as possible, while keeping the current
SMEP admin identity and limiting implementation to these admin areas:

- Warehouse
- Brand
- Category
- Products
- Inventory

The migration must not change backend contracts, routes, permissions, form field
names, or operational workflows.

## Goals

- Add a reusable shadcn-style component foundation for the admin app.
- Keep the current SMEP visual identity, including the fixed admin sidebar,
  medical-commerce color palette, and dense operational layout.
- Replace repeated native/custom controls in the scoped pages with shared
  shadcn primitives.
- Improve consistency for buttons, inputs, selects, cards, dialogs, badges,
  checkboxes, and tables across the scoped pages.
- Preserve current page behavior, API calls, loading states, mutation flows, and
  validation behavior.
- Keep the implementation narrow enough to verify safely.

## Non-Goals

- Do not restyle or migrate the entire admin app in this pass.
- Do not change Customer, Orders, Delivery, Reports, Settings, Login, or
  Dashboard pages except where a shared component import is unavoidable.
- Do not add a delivery partner web app.
- Do not change API DTOs, Prisma schema, or backend business rules.
- Do not rename existing form fields to match shadcn examples.
- Do not replace the fixed sidebar shell or current route split.

## Approach

Use a foundation-first migration:

1. Configure shadcn-style UI components inside `apps/admin`.
2. Map component styling to the current SMEP CSS variables and Tailwind v4 setup.
3. Migrate scoped pages to the shared primitives.
4. Remove or reduce obsolete scoped CSS only after the replacement is complete.

This avoids each page inventing its own local variant of a shadcn component and
keeps the UI consistent as more admin areas are migrated later.

## Component Foundation

Add reusable components under `apps/admin/components/ui`:

- `button`
- `input`
- `textarea`
- `select`
- `checkbox`
- `card`
- `dialog`
- `badge`
- `table`
- `label`

If the shadcn CLI also requires helper files, add them in the standard local
location, such as `apps/admin/lib/utils.ts`, and keep those helpers generic.

Use variants that map cleanly to existing intent:

- `primaryButton` -> `Button` default
- `ghostButton` -> `Button` outline or ghost, depending on context
- `secondaryButton` -> `Button` secondary
- `dangerButton` -> `Button` destructive
- `.panel` -> `Card`
- `.metric` -> compact `Card`
- status pill classes -> `Badge` variants
- native filter fields -> `Input`, `Select`, and `Checkbox`
- custom confirmation modal -> `Dialog`
- data grids -> `Table` primitives where semantic table markup is practical

The existing admin color tokens remain the source of truth. shadcn tokens should
be bridged to SMEP colors instead of replacing the product palette with the
default neutral dashboard look.

## Scoped Page Migration

### Warehouse

Migrate warehouse list, create/edit, analytics, and staff-management surfaces.
Use shared cards for page sections and metrics, shared controls for filters and
forms, shared badges for status, and shared buttons for route actions and row
actions. Preserve the existing route split and staff-query gating behavior.

### Brand

Migrate brand filters, list table, create/edit form, image upload control, active
toggle, row actions, and delete confirmation. Preserve current brand routes and
soft-delete behavior.

### Category

Migrate category filters, hierarchy table, child category modal, create/edit
form, image upload control, active toggle, and row actions. Preserve parent/child
relationships and existing category form contracts.

### Products

Migrate product filters, product list table, create/edit product form sections,
rich text toolbar controls where practical, flags, assets, documents, variants,
and confirmation dialogs. Keep product form field names and submit mapping
unchanged.

### Inventory

Migrate inventory filters, stock, batch, movement tables, stock action forms, and
status/quantity indicators. Preserve current product, warehouse, batch, and
movement API usage.

## Data Flow

This is a presentation-layer migration. Query keys, mutation functions, DTO
shapes, route helpers, form state, and validation helpers should stay as they are
unless a local adapter is needed for a shadcn controlled component.

For `Select` and `Checkbox`, use thin local adapters where needed so existing
form state remains readable and type-safe. Do not reshape backend payloads just
to fit component APIs.

## Error Handling

Keep current error messaging and empty states. Field-level errors should be
rendered near their controls with the shared label/input pattern. Destructive
actions should continue to require confirmation through a shared dialog.

## Accessibility

- Preserve semantic labels for form fields.
- Use real table markup where the data is tabular.
- Keep icon buttons accessible with visible text or screen-reader labels.
- Preserve keyboard access for dialogs and selects.
- Keep disabled states and pending states visible.

## Styling Rules

- Use 8px or smaller border radii unless inherited shadcn defaults require less.
- Keep dense operational layouts; do not introduce marketing-style hero sections
  or decorative cards.
- Keep fixed dimensions or responsive grid constraints for dense tables, toolbars,
  and action rows so controls do not shift unexpectedly.
- Avoid a generic one-hue neutral rewrite. The SMEP medical palette remains.
- Prefer lucide icons already used in the app.

## Verification

Run the actual repo commands before claiming completion:

- `corepack pnpm --filter @surgical/admin lint`
- `corepack pnpm --filter @surgical/admin test`
- `corepack pnpm --filter @surgical/admin typecheck`
- `corepack pnpm --filter @surgical/admin build`

If the implementation touches shared packages or repository configuration, also
run the relevant repo-level lint, typecheck, and build commands. Visually verify
the scoped pages in the browser after the dev server is running.

## Rollout Criteria

The migration is complete when:

- The scoped pages use the shared shadcn-style primitives for repeated controls.
- Current warehouse, brand, category, product, and inventory workflows still work.
- No unrelated admin pages are intentionally migrated.
- Lint, tests, typecheck, and build have been run or any blockers are documented.
- The remaining custom CSS is limited to layout, SMEP theme tokens, and
  page-specific dense table constraints.
