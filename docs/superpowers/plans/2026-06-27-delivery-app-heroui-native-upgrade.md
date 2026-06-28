# Delivery App HeroUI Native Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Expo delivery app with HeroUI Native UI, richer real delivery workflow features, validation, feedback, and offline retry behavior.

**Architecture:** Keep Expo Router screens in `apps/delivery/app`, add shared HeroUI Native setup and reusable UI primitives under `apps/delivery/components`, and keep workflow logic in pure tested helpers under `apps/delivery/lib`. Backend business rules remain unchanged.

**Tech Stack:** Expo 56, React Native 0.85, Expo Router, TanStack Query, HeroUI Native, Uniwind/Tailwind 4, Vitest, Zod.

---

## File Structure

- Modify `apps/delivery/package.json`: add HeroUI Native, Uniwind, Tailwind 4, SVG, Reanimated/Worklets, and utility dependencies required by HeroUI Native.
- Modify `apps/delivery/babel.config.js`: add Uniwind and Reanimated plugins in the documented order.
- Modify `apps/delivery/metro.config.js`: create Metro config wrapped by Uniwind.
- Create `apps/delivery/global.css`: import Tailwind 4 and HeroUI Native styles.
- Modify `apps/delivery/app/_layout.tsx`: import global CSS and wrap the app in `HeroUINativeProvider`.
- Create `apps/delivery/components/ui/feedback.tsx`: app toast and confirmation primitives.
- Create `apps/delivery/components/ui/delivery-card.tsx`: assignment card and compact metric UI.
- Create `apps/delivery/components/ui/form-field.tsx`: HeroUI Native text-field wrapper with inline error display.
- Modify `apps/delivery/components/ActionButton.tsx`, `Screen.tsx`, and `StatusPill.tsx`: align existing public props with the new component style.
- Create `apps/delivery/lib/delivery/dashboard.ts` and `apps/delivery/lib/delivery/dashboard.test.ts`: dashboard metrics, status filters, and card summaries.
- Create `apps/delivery/lib/delivery/forms.ts` and `apps/delivery/lib/delivery/forms.test.ts`: login/register/transition form validation.
- Modify `apps/delivery/lib/offline/status-queue.ts` and `status-queue.test.ts`: add retry result helpers used by the screen drain logic.
- Modify `apps/delivery/app/login.tsx`: rebuild login/register form with validation and HeroUI Native feedback.
- Modify `apps/delivery/app/(app)/assignments.tsx`: add dashboard metrics, real status filters, better loading/error/empty states, and queued retry banner.
- Modify `apps/delivery/app/(app)/assignments/[id].tsx`: add pickup/customer/timeline/totals sections, confirmations, proof preview, validation, and offline retry drain.
- Modify `apps/delivery/app/(app)/profile.tsx`: apply the shared UI style and expose location/wallet/availability clearly.

### Task 1: HeroUI Native Setup

**Files:**
- Modify: `apps/delivery/package.json`
- Modify: `apps/delivery/babel.config.js`
- Create: `apps/delivery/metro.config.js`
- Create: `apps/delivery/global.css`
- Modify: `apps/delivery/app/_layout.tsx`

- [ ] **Step 1: Install required dependencies**

Run:

```powershell
corepack pnpm --filter @surgical/delivery add heroui-native uniwind tailwindcss react-native-reanimated react-native-worklets react-native-svg tailwind-merge tailwind-variants clsx
```

Expected: `apps/delivery/package.json` and `pnpm-lock.yaml` include the native UI dependencies.

- [ ] **Step 2: Configure Babel**

Update `apps/delivery/babel.config.js` to include Uniwind and Reanimated plugins after `babel-preset-expo`.

- [ ] **Step 3: Configure Metro and CSS**

Create `apps/delivery/metro.config.js` using the Expo default Metro config wrapped by Uniwind. Create `apps/delivery/global.css` with Tailwind and HeroUI Native imports.

- [ ] **Step 4: Wrap app provider**

Import `../global.css` and wrap the existing provider tree in `HeroUINativeProvider` in `apps/delivery/app/_layout.tsx`.

- [ ] **Step 5: Verify setup compiles**

Run:

```powershell
corepack pnpm --filter @surgical/delivery typecheck
```

Expected: TypeScript errors only if package APIs differ from docs; resolve before continuing.

### Task 2: Pure Delivery Workflow Helpers

**Files:**
- Create: `apps/delivery/lib/delivery/dashboard.ts`
- Create: `apps/delivery/lib/delivery/dashboard.test.ts`
- Create: `apps/delivery/lib/delivery/forms.ts`
- Create: `apps/delivery/lib/delivery/forms.test.ts`
- Modify: `apps/delivery/lib/offline/status-queue.ts`
- Modify: `apps/delivery/lib/offline/status-queue.test.ts`

- [ ] **Step 1: Write failing dashboard tests**

Add tests for status counts, active count, COD total, status filter labels, next action labels, and date formatting fallbacks.

- [ ] **Step 2: Run dashboard tests and verify failure**

Run:

```powershell
corepack pnpm --filter @surgical/delivery test -- lib/delivery/dashboard.test.ts
```

Expected: FAIL because `lib/delivery/dashboard.ts` does not exist yet.

- [ ] **Step 3: Implement dashboard helpers**

Implement pure helpers that accept `DeliveryAssignment[]` and return metrics used by the list screen.

- [ ] **Step 4: Write failing form validation tests**

Add tests for mobile number, OTP, registration, delivered COD, delivered non-COD, and failed status forms.

- [ ] **Step 5: Run form tests and verify failure**

Run:

```powershell
corepack pnpm --filter @surgical/delivery test -- lib/delivery/forms.test.ts
```

Expected: FAIL because `lib/delivery/forms.ts` does not exist yet.

- [ ] **Step 6: Implement form validation helpers**

Implement pure validation functions returning field-level error maps and normalized payload values.

- [ ] **Step 7: Extend offline queue tests first**

Add tests for successful retry removal and retry failure attempt increments.

- [ ] **Step 8: Implement offline retry helpers**

Add pure helpers for `markStatusUpdateSucceeded` and `markStatusUpdateRetried`.

- [ ] **Step 9: Verify helper tests**

Run:

```powershell
corepack pnpm --filter @surgical/delivery test
```

Expected: all delivery unit tests pass.

### Task 3: Shared UI Components

**Files:**
- Create: `apps/delivery/components/ui/feedback.tsx`
- Create: `apps/delivery/components/ui/delivery-card.tsx`
- Create: `apps/delivery/components/ui/form-field.tsx`
- Modify: `apps/delivery/components/ActionButton.tsx`
- Modify: `apps/delivery/components/Screen.tsx`
- Modify: `apps/delivery/components/StatusPill.tsx`

- [ ] **Step 1: Implement feedback primitives**

Create a toast host/hook wrapper and a confirmation helper backed by HeroUI Native dialog/toast APIs, with React Native `Alert` fallback if a documented API differs.

- [ ] **Step 2: Implement form field wrapper**

Use HeroUI Native text input primitives when available, preserving keyboard props and inline error text.

- [ ] **Step 3: Implement delivery card primitives**

Create metric cards, section cards, empty states, loading rows, and assignment card sections that are responsive through flex wrapping and `useWindowDimensions`.

- [ ] **Step 4: Update existing primitives**

Keep the existing `ActionButton`, `Screen`, and `StatusPill` exports stable so current screens can be migrated incrementally.

- [ ] **Step 5: Verify typecheck**

Run:

```powershell
corepack pnpm --filter @surgical/delivery typecheck
```

Expected: no TypeScript errors in shared components.

### Task 4: Login, Dashboard, Detail, And Profile Screens

**Files:**
- Modify: `apps/delivery/app/login.tsx`
- Modify: `apps/delivery/app/(app)/assignments.tsx`
- Modify: `apps/delivery/app/(app)/assignments/[id].tsx`
- Modify: `apps/delivery/app/(app)/profile.tsx`

- [ ] **Step 1: Migrate login/register**

Use form validation helpers before OTP, verify OTP, and registration requests. Show inline errors and toast success/failure.

- [ ] **Step 2: Migrate assignment dashboard**

Add status filters calling `listAssignments(accessToken, selectedStatus)`, dashboard metrics, better refresh/loading/error states, and updated cards.

- [ ] **Step 3: Migrate assignment detail**

Show pickup warehouse, customer/drop details, items, totals, notes, status timeline, proof preview, and status-specific forms. Confirm cancel/fail/deliver actions before calling the API.

- [ ] **Step 4: Implement offline retry drain**

When connectivity returns, submit the next queued update with `updateAssignmentStatus`, remove it on success, increment attempts on failure, and invalidate assignments after a successful drain.

- [ ] **Step 5: Migrate profile**

Use shared cards for identity, availability, wallet, and location, keeping sign-out behavior unchanged.

- [ ] **Step 6: Verify tests and typecheck**

Run:

```powershell
corepack pnpm --filter @surgical/delivery test
corepack pnpm --filter @surgical/delivery typecheck
```

Expected: all delivery tests pass and TypeScript reports no errors.

### Task 5: Final Review

**Files:**
- Review all changed files under `apps/delivery`
- Review `pnpm-lock.yaml`
- Review docs created under `docs/superpowers`

- [ ] **Step 1: Inspect diff**

Run:

```powershell
git diff -- apps/delivery docs/superpowers pnpm-lock.yaml
```

Expected: only delivery app, lockfile, and planning docs changed.

- [ ] **Step 2: Final verification**

Run:

```powershell
corepack pnpm --filter @surgical/delivery test
corepack pnpm --filter @surgical/delivery typecheck
```

Expected: both commands exit 0.

