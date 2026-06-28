# Delivery App HeroUI Native Upgrade Design

## Goal

Upgrade `apps/delivery` from a basic Expo delivery surface into a production-ready delivery partner workflow using real HeroUI Native components, while preserving the existing Expo Router architecture and backend delivery contract.

## Constraints

- Keep the app inside `apps/delivery`; do not add mock APIs or new backend concepts.
- Use the existing delivery endpoints: `/delivery/me`, `/delivery/me/status`, `/delivery/me/location`, `/delivery/me/device`, `/delivery/assignments`, `/delivery/assignments/:id/status`, and `/delivery-partner/uploads/proof`.
- Use `heroui-native` for the redesigned UI. The native setup requires Uniwind/Tailwind 4, Metro wrapping, `global.css`, and `HeroUINativeProvider`.
- Do not rely on Expo web for delivery-app verification; HeroUI Native is intended for native iOS/Android usage.
- Maintain existing status-transition business rules: `ASSIGNED -> ACCEPTED/CANCELLED`, `ACCEPTED -> PICKED_UP/CANCELLED`, `PICKED_UP -> OUT_FOR_DELIVERY/FAILED`, `OUT_FOR_DELIVERY -> DELIVERED/FAILED`.

## User Experience

The app will use a polished native design system based on HeroUI Native:

- A delivery dashboard with profile availability, assignment status filters, active workload counts, COD total, queued retry state, pull-to-refresh, and clear empty/error/loading states.
- Delivery assignment cards that show order number, customer, destination, status, payment mode, item count, assigned time, and the next expected action.
- A detail screen with separate sections for customer/drop location, pickup warehouse, order items, totals/COD, notes, proof-of-delivery workflow, status timeline, and action controls.
- Login and registration forms with inline validation, better keyboard handling, loading states, and success/error feedback.
- Toast-style feedback for success, failure, queued offline updates, and retry completion.
- Confirmations before final or destructive transitions such as cancel, fail, and delivered.

## Functionality

The upgrade will add practical workflow features backed by existing data:

- Status filters call `listAssignments(accessToken, status)` for real server-side filtering.
- Dashboard metrics are derived from the real assignment list and profile response.
- Pickup warehouse details use `assignment.pickupWarehouse`.
- Timeline uses `assignment.statusHistory`.
- Proof and receiver/COD validation continue to use `validateStatusUpdatePayload`.
- Offline status updates move from component-local state to a reusable persistent queue that can drain after connectivity returns.
- API errors and validation messages are displayed consistently without swallowing actionable failures.

## Architecture

`apps/delivery` keeps Expo Router routes in `app/`, but shared UI and workflow logic moves into focused files under `components/` and `lib/`.

- `components/ui/*` contains HeroUI Native wrappers and delivery-specific UI primitives.
- `lib/delivery/dashboard.ts` contains pure dashboard metrics and filtering helpers.
- `lib/delivery/forms.ts` contains pure form validation helpers.
- `lib/offline/status-queue.ts` gains retry planning helpers and remains pure/testable.
- `app/(app)/assignments.tsx`, `app/(app)/assignments/[id].tsx`, `app/(app)/profile.tsx`, and `app/login.tsx` consume these helpers and components.

## Testing

Use TDD for pure workflow behavior:

- Dashboard metrics and filter summaries.
- Login/register/status payload validation.
- Offline queue dedupe, ordering, retry attempt tracking, and retry completion.
- Status update payload validation remains covered by existing schema tests.

Verification gates:

- `corepack pnpm --filter @surgical/delivery test`
- `corepack pnpm --filter @surgical/delivery typecheck`

