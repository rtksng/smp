# Admin HeroUI Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the full `apps/admin` frontend into the approved Clinical Command Center UI using HeroUI while preserving existing backend contracts, routes, auth, permissions, validation, state, and data flow.

**Architecture:** Add targeted HeroUI dependencies and a provider, then replace admin-local shadcn/Radix primitives with HeroUI-backed compatibility wrappers. Migrate each admin surface onto shared HeroUI-style admin components in risk order so page behavior stays stable and visual QA can happen after each slice.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, targeted HeroUI packages, React Aria-backed HeroUI primitives, TanStack Query, React Hook Form, Lexical, Vitest, Testing Library.

---

## File Structure

- Modify `apps/admin/package.json`: add targeted HeroUI packages and remove direct Radix dependencies after replacement.
- Modify `pnpm-lock.yaml`: dependency graph updates from `pnpm add` and `pnpm remove`.
- Modify `apps/admin/app/providers.tsx`: add `HeroUIProvider` without changing query/session behavior.
- Modify `apps/admin/app/globals.css`: update Clinical Command Center tokens, HeroUI source scanning, shell styles, and page layout utilities.
- Create `apps/admin/app/admin-heroui-modernization.test.ts`: source guard for HeroUI adoption and Radix removal.
- Modify `apps/admin/app/admin-styles.test.ts`: update style assertions from shadcn/Radix-specific expectations to HeroUI shell expectations.
- Modify `apps/admin/app/scoped-shadcn-migration.test.ts`: replace shadcn wording and expectations with HeroUI scoped surface guards.
- Modify all files under `apps/admin/components/ui`: HeroUI-backed compatibility primitives.
- Create `apps/admin/components/ui/dropdown.tsx`, `drawer.tsx`, `pagination.tsx`, `skeleton.tsx`, `spinner.tsx`, `switch.tsx`, `tabs.tsx`, and `tooltip.tsx`.
- Modify `apps/admin/components/admin/confirmation-dialog.tsx`: HeroUI modal-based confirmation.
- Modify `apps/admin/components/admin/file-upload-button.tsx`: HeroUI button styling while preserving native file input use.
- Modify `apps/admin/components/admin/metric-card.tsx`: HeroUI card/chip treatment.
- Modify `apps/admin/components/admin/status-badge.tsx`: HeroUI chip treatment.
- Create `apps/admin/components/admin/empty-state.tsx`, `loading-state.tsx`, `page-header.tsx`, `pagination-controls.tsx`, and `filter-actions.tsx`.
- Modify `apps/admin/app/admin-shell.tsx`: HeroUI-ready responsive shell and mobile drawer navigation.
- Modify `apps/admin/app/login/page.tsx`: HeroUI form controls and Clinical Command Center sign-in layout.
- Modify `apps/admin/app/_components/reports-dashboard.tsx` and `apps/admin/app/dashboard/page.tsx`: dashboard/report visual migration.
- Modify `apps/admin/app/_components/resource-page.tsx`: shared resource page HeroUI treatment.
- Modify scoped catalog/warehouse/inventory files:
  - `apps/admin/app/brands/_components/brand-management.tsx`
  - `apps/admin/app/categories/_components/category-management.tsx`
  - `apps/admin/app/warehouses/_components/warehouse-management.tsx`
  - `apps/admin/app/inventory/inventory-management.tsx`
  - existing source tests next to those files
- Modify product files:
  - `apps/admin/app/products/product-management.tsx`
  - `apps/admin/app/products/product-management-source.test.ts`
- Modify remaining admin surfaces:
  - `apps/admin/app/orders/page.tsx`
  - `apps/admin/app/orders/[id]/page.tsx`
  - `apps/admin/app/customers/page.tsx`
  - `apps/admin/app/delivery/page.tsx`
  - `apps/admin/app/settings/page.tsx`
  - `apps/admin/lib/order-management.test.ts`
  - `apps/admin/lib/customer-management.test.ts`
  - `apps/admin/lib/delivery-management.test.ts`
  - `apps/admin/lib/settings-management.test.ts`

Do not modify files under `apps/api`, `apps/worker`, `apps/web`, `packages/config`, `packages/types`, or database/infra folders for this UI migration.

---

### Task 1: Add HeroUI Migration Guard Tests

**Files:**
- Create: `apps/admin/app/admin-heroui-modernization.test.ts`
- Modify: `apps/admin/app/scoped-shadcn-migration.test.ts`
- Modify: `apps/admin/app/admin-styles.test.ts`
- Test: `corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts scoped-shadcn-migration.test.ts admin-styles.test.ts`

- [ ] **Step 1: Add the failing modernization guard test**

Create `apps/admin/app/admin-heroui-modernization.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminRoot = join(__dirname, "..");
const appDir = __dirname;
const packageJson = JSON.parse(
  readFileSync(join(adminRoot, "package.json"), "utf8")
) as { dependencies?: Record<string, string> };

function readAdmin(path: string) {
  return readFileSync(join(adminRoot, path), "utf8");
}

const uiFiles = [
  "components/ui/badge.tsx",
  "components/ui/button.tsx",
  "components/ui/card.tsx",
  "components/ui/checkbox.tsx",
  "components/ui/dialog.tsx",
  "components/ui/dropdown.tsx",
  "components/ui/drawer.tsx",
  "components/ui/input.tsx",
  "components/ui/label.tsx",
  "components/ui/pagination.tsx",
  "components/ui/select.tsx",
  "components/ui/skeleton.tsx",
  "components/ui/spinner.tsx",
  "components/ui/switch.tsx",
  "components/ui/table.tsx",
  "components/ui/tabs.tsx",
  "components/ui/textarea.tsx",
  "components/ui/tooltip.tsx"
];

describe("admin HeroUI modernization", () => {
  it("uses HeroUIProvider in the admin provider stack", () => {
    const providersSource = readFileSync(join(appDir, "providers.tsx"), "utf8");

    expect(providersSource).toContain('import { HeroUIProvider } from "@heroui/system"');
    expect(providersSource).toContain("<HeroUIProvider>");
    expect(providersSource).toContain("<AdminSessionProvider>");
    expect(providersSource).toContain("<QueryClientProvider");
  });

  it("has no direct Radix dependencies in the admin package", () => {
    const dependencies = Object.keys(packageJson.dependencies ?? {});

    expect(dependencies.filter((name) => name.startsWith("@radix-ui/"))).toEqual([]);
    expect(dependencies).not.toContain("radix-ui");
    expect(dependencies).not.toContain("@heroui/react");
  });

  it("keeps repeated admin primitives behind HeroUI-backed wrappers", () => {
    for (const file of uiFiles) {
      const source = readAdmin(file);

      expect(source, file).toMatch(/from "@heroui\//);
      expect(source, file).not.toMatch(/from "@radix-ui\//);
      expect(source, file).not.toMatch(/from "radix-ui"/);
    }
  });

  it("does not import Radix directly anywhere in admin source", () => {
    const scannedFiles = [
      ...uiFiles,
      "components/admin/confirmation-dialog.tsx",
      "components/admin/file-upload-button.tsx",
      "components/admin/metric-card.tsx",
      "components/admin/status-badge.tsx",
      "app/admin-shell.tsx",
      "app/login/page.tsx",
      "app/_components/reports-dashboard.tsx",
      "app/products/product-management.tsx",
      "app/settings/page.tsx",
      "app/delivery/page.tsx"
    ];

    for (const file of scannedFiles) {
      const source = readAdmin(file);

      expect(source, file).not.toMatch(/@radix-ui|radix-ui/);
    }
  });
});
```

- [ ] **Step 2: Rename scoped shadcn guard language to HeroUI**

Modify `apps/admin/app/scoped-shadcn-migration.test.ts` so the suite name and first assertion read:

```ts
describe("scoped admin HeroUI modernization", () => {
  it("uses admin-local HeroUI compatibility primitives in every scoped page", () => {
```

Keep the existing scoped file list and table/dialog guards, because those imports remain local wrapper imports. Add a package-level guard to the same file:

```ts
  it("does not mention shadcn or Radix in scoped component source", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).not.toMatch(/shadcn|@radix-ui|radix-ui/i);
    }
  });
```

- [ ] **Step 3: Update admin style test expectations**

In `apps/admin/app/admin-styles.test.ts`, replace the shadcn button-specific assertion body with HeroUI wrapper expectations:

```ts
  it("keeps button labels and icons visible through the HeroUI wrapper", () => {
    expect(globalsCss).not.toMatch(/\.panelHeader\s+span\s*{/);
    expect(globalsCss).toMatch(/\.panelHeader\s*>\s*span\s*{/);
    expect(buttonSource).toContain('from "@heroui/button"');
    expect(buttonSource).toContain("buttonVariants");
    expect(buttonSource).toContain("heroButtonClassName");
  });
```

- [ ] **Step 4: Run the guard tests and confirm they fail**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts scoped-shadcn-migration.test.ts admin-styles.test.ts
```

Expected: FAIL because HeroUI wrappers, provider, new wrapper files, and dependency cleanup are not implemented yet.

- [ ] **Step 5: Commit the failing guard tests**

Run:

```powershell
git add apps/admin/app/admin-heroui-modernization.test.ts apps/admin/app/scoped-shadcn-migration.test.ts apps/admin/app/admin-styles.test.ts
git commit -m "test: guard admin HeroUI modernization"
```

---

### Task 2: Add HeroUI Dependencies, Provider, and Theme Sources

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/admin/app/providers.tsx`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts`

- [ ] **Step 1: Install targeted HeroUI packages**

Run:

```powershell
corepack pnpm --filter @surgical/admin add @heroui/system@2.4.28 @heroui/theme@2.4.26 @heroui/button@2.2.32 @heroui/input@2.4.33 @heroui/select@2.4.33 @heroui/checkbox@2.3.32 @heroui/switch@2.2.27 @heroui/card@2.2.28 @heroui/chip@2.2.25 @heroui/table@2.2.32 @heroui/modal@2.2.29 @heroui/drawer@2.2.29 @heroui/dropdown@2.3.32 @heroui/tabs@2.2.29 @heroui/tooltip@2.2.29 @heroui/pagination@2.2.27 @heroui/spinner@2.2.29 @heroui/skeleton@2.2.18 framer-motion@12.40.0
```

Expected: `apps/admin/package.json` contains those packages and `pnpm-lock.yaml` changes. Do not install `@heroui/react` because its package metadata includes a direct Radix avatar dependency.

- [ ] **Step 2: Add HeroUIProvider without changing query or session behavior**

Modify `apps/admin/app/providers.tsx` to:

```tsx
"use client";

import { HeroUIProvider } from "@heroui/system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminSessionProvider } from "../lib/admin-session";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 45_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <AdminSessionProvider>{children}</AdminSessionProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Add Tailwind v4 source directives and HeroUI tokens**

At the top of `apps/admin/app/globals.css`, keep `@import "tailwindcss";` first and add:

```css
@source "../../../node_modules/@heroui/**/*.{js,ts,jsx,tsx}";
```

In `:root`, keep the existing SMEP tokens and add HeroUI-compatible tokens:

```css
  --admin-accent-soft: #d8f3dc;
  --admin-sidebar-active: #007f86;
  --admin-danger-soft: #fff1f2;
  --admin-warning-soft: #fff7ed;
  --admin-success-soft: #ecfdf3;
  --admin-focus-ring: rgba(0, 109, 119, 0.24);
```

Keep `--radius-sm`, `--radius-md`, `--radius-lg`, and `--radius-xl` at `8px` or smaller.

- [ ] **Step 4: Run provider and source guard**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts
```

Expected: still FAIL because wrapper files are not HeroUI-backed yet, but the provider assertion passes.

- [ ] **Step 5: Commit dependency and provider setup**

Run:

```powershell
git add apps/admin/package.json pnpm-lock.yaml apps/admin/app/providers.tsx apps/admin/app/globals.css
git commit -m "feat: add admin HeroUI foundation"
```

---

### Task 3: Replace Shared UI Primitives With HeroUI Wrappers

**Files:**
- Modify: `apps/admin/components/ui/badge.tsx`
- Modify: `apps/admin/components/ui/button.tsx`
- Modify: `apps/admin/components/ui/card.tsx`
- Modify: `apps/admin/components/ui/checkbox.tsx`
- Modify: `apps/admin/components/ui/dialog.tsx`
- Modify: `apps/admin/components/ui/input.tsx`
- Modify: `apps/admin/components/ui/label.tsx`
- Modify: `apps/admin/components/ui/select.tsx`
- Modify: `apps/admin/components/ui/table.tsx`
- Modify: `apps/admin/components/ui/textarea.tsx`
- Create: `apps/admin/components/ui/dropdown.tsx`
- Create: `apps/admin/components/ui/drawer.tsx`
- Create: `apps/admin/components/ui/pagination.tsx`
- Create: `apps/admin/components/ui/skeleton.tsx`
- Create: `apps/admin/components/ui/spinner.tsx`
- Create: `apps/admin/components/ui/switch.tsx`
- Create: `apps/admin/components/ui/tabs.tsx`
- Create: `apps/admin/components/ui/tooltip.tsx`
- Test: `corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts admin-styles.test.ts scoped-shadcn-migration.test.ts`

- [ ] **Step 1: Replace the button wrapper**

Modify `apps/admin/components/ui/button.tsx` to keep the local API stable while rendering HeroUI:

```tsx
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button as HeroButton } from "@heroui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-extrabold transition-colors disabled:pointer-events-none disabled:opacity-60 [&_span]:!text-current [&_svg]:!text-current [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default"
    },
    variants: {
      size: {
        default: "px-4 py-2",
        icon: "size-10 min-w-10 p-0",
        sm: "min-h-9 px-3 py-2"
      },
      variant: {
        default: "bg-primary !text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive !text-destructive-foreground hover:bg-destructive/90",
        ghost: "bg-transparent !text-foreground hover:bg-muted",
        outline: "border border-border bg-card !text-foreground hover:bg-muted",
        secondary: "bg-secondary !text-secondary-foreground hover:bg-secondary/90"
      }
    }
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps = Omit<ComponentProps<typeof HeroButton>, "size" | "variant"> &
  ButtonVariantProps & {
    asChild?: boolean;
    href?: string;
  };

export function heroButtonClassName({
  className,
  size,
  variant
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  return cn(buttonVariants({ className, size, variant }));
}

export function Button({
  asChild = false,
  children,
  className,
  href,
  size,
  variant,
  ...props
}: ButtonProps) {
  const buttonClassName = heroButtonClassName({ className, size, variant });

  if (asChild && href) {
    return (
      <HeroButton as={Link} className={buttonClassName} href={href} radius="sm" {...props}>
        {children as ReactNode}
      </HeroButton>
    );
  }

  return (
    <HeroButton className={buttonClassName} radius="sm" {...props}>
      {children as ReactNode}
    </HeroButton>
  );
}
```

After this step, update existing `Button asChild` usages that wrap `Link` to pass `href` directly, for example:

```tsx
<Button className="iconTextButton" href="/products/create" variant="default">
  <Plus aria-hidden size={16} />
  <span>Create product</span>
</Button>
```

- [ ] **Step 2: Replace input and textarea wrappers**

Modify `apps/admin/components/ui/input.tsx`:

```tsx
import type { ComponentProps } from "react";
import { Input as HeroInput } from "@heroui/input";
import { cn } from "@/lib/utils";

export type InputProps = ComponentProps<typeof HeroInput>;

export function Input({ className, radius = "sm", variant = "bordered", ...props }: InputProps) {
  return (
    <HeroInput
      className={cn("adminHeroInput", className)}
      classNames={{
        inputWrapper:
          "min-h-10 border-border bg-card shadow-none data-[hover=true]:border-primary group-data-[focus=true]:border-primary group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-[var(--admin-focus-ring)]",
        input: "text-sm text-foreground placeholder:text-muted-foreground"
      }}
      radius={radius}
      variant={variant}
      {...props}
    />
  );
}
```

Modify `apps/admin/components/ui/textarea.tsx`:

```tsx
import type { ComponentProps } from "react";
import { Textarea as HeroTextarea } from "@heroui/input";
import { cn } from "@/lib/utils";

export type TextareaProps = ComponentProps<typeof HeroTextarea>;

export function Textarea({
  className,
  minRows = 4,
  radius = "sm",
  variant = "bordered",
  ...props
}: TextareaProps) {
  return (
    <HeroTextarea
      className={cn("adminHeroTextarea", className)}
      classNames={{
        inputWrapper:
          "border-border bg-card shadow-none data-[hover=true]:border-primary group-data-[focus=true]:border-primary group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-[var(--admin-focus-ring)]",
        input: "text-sm text-foreground placeholder:text-muted-foreground"
      }}
      minRows={minRows}
      radius={radius}
      variant={variant}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Replace checkbox and add switch wrappers**

Modify `apps/admin/components/ui/checkbox.tsx`:

```tsx
"use client";

import type { ComponentProps } from "react";
import { Checkbox as HeroCheckbox } from "@heroui/checkbox";
import { cn } from "@/lib/utils";

type HeroCheckboxProps = ComponentProps<typeof HeroCheckbox>;

export type CheckboxProps = Omit<HeroCheckboxProps, "onValueChange"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({ className, onCheckedChange, radius = "sm", ...props }: CheckboxProps) {
  return (
    <HeroCheckbox
      className={cn("adminHeroCheckbox", className)}
      classNames={{
        wrapper: "border-border before:border-border after:bg-primary"
      }}
      onValueChange={onCheckedChange}
      radius={radius}
      {...props}
    />
  );
}
```

Create `apps/admin/components/ui/switch.tsx`:

```tsx
"use client";

import type { ComponentProps } from "react";
import { Switch as HeroSwitch } from "@heroui/switch";
import { cn } from "@/lib/utils";

export type SwitchProps = ComponentProps<typeof HeroSwitch>;

export function Switch({ className, size = "sm", ...props }: SwitchProps) {
  return (
    <HeroSwitch
      className={cn("adminHeroSwitch", className)}
      classNames={{
        wrapper: "group-data-[selected=true]:bg-primary"
      }}
      size={size}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Replace card and badge wrappers**

Modify `apps/admin/components/ui/card.tsx`:

```tsx
import type { ComponentProps } from "react";
import {
  Card as HeroCard,
  CardBody,
  CardFooter as HeroCardFooter,
  CardHeader as HeroCardHeader
} from "@heroui/card";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<typeof HeroCard>) {
  return (
    <HeroCard
      className={cn("border border-border bg-card text-card-foreground shadow-sm", className)}
      radius="sm"
      shadow="none"
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<typeof HeroCardHeader>) {
  return <HeroCardHeader className={cn("grid gap-1.5 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-lg font-extrabold text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<typeof CardBody>) {
  return <CardBody className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<typeof HeroCardFooter>) {
  return <HeroCardFooter className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}
```

Modify `apps/admin/components/ui/badge.tsx`:

```tsx
import type { ComponentProps } from "react";
import { Chip } from "@heroui/chip";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

export type BadgeProps = Omit<ComponentProps<typeof Chip>, "variant"> & {
  variant?: BadgeVariant;
};

const badgeClassNames: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border bg-card text-foreground",
  secondary: "bg-muted text-foreground"
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <Chip
      className={cn("h-6 rounded-md px-2 text-xs font-extrabold", badgeClassNames[variant], className)}
      radius="sm"
      size="sm"
      variant="flat"
      {...props}
    />
  );
}
```

- [ ] **Step 5: Replace dialog with HeroUI modal compatibility exports**

Modify `apps/admin/components/ui/dialog.tsx`:

```tsx
"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader
} from "@heroui/modal";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Dialog({
  children,
  onOpenChange,
  open
}: {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  return (
    <Modal
      classNames={{
        backdrop: "bg-black/45",
        base: "border border-border bg-card text-card-foreground shadow-2xl"
      }}
      isOpen={open}
      onOpenChange={onOpenChange}
      radius="sm"
    >
      {children}
    </Modal>
  );
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ModalContent className={cn("max-w-[520px] p-0", className)}>
      {(onClose) => (
        <>
          <Button
            aria-label="Close"
            className="absolute right-4 top-4 z-10"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden size={16} />
          </Button>
          {children}
        </>
      )}
    </ModalContent>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<typeof ModalHeader>) {
  return <ModalHeader className={cn("grid gap-2 px-6 pb-0 pt-6 text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<typeof ModalFooter>) {
  return <ModalFooter className={cn("flex flex-col-reverse gap-2 px-6 pb-6 pt-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-xl font-bold text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof ModalBody>) {
  return <ModalBody className={cn("px-0 py-0 text-sm text-muted-foreground", className)} {...props} />;
}
```

If a page imports `DialogTrigger`, `DialogClose`, or `DialogPortal`, replace that call site with controlled `open` state. Current admin source only needs controlled dialog behavior.

- [ ] **Step 6: Replace select with a compatibility API**

Modify `apps/admin/components/ui/select.tsx` to export `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem`, while internally collecting child items and rendering HeroUI `Select`:

```tsx
"use client";

import type { ReactElement, ReactNode } from "react";
import { createContext, isValidElement, useContext } from "react";
import { Select as HeroSelect, SelectItem as HeroSelectItem } from "@heroui/select";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  placeholder?: string;
};

const SelectContext = createContext<SelectContextValue>({});

type SelectProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

type SelectItemProps = {
  children: ReactNode;
  value: string;
};

export function Select({ children, className, disabled, onValueChange, value }: SelectProps) {
  const items = collectSelectItems(children);
  const placeholder = collectSelectPlaceholder(children);

  return (
    <HeroSelect
      aria-label={placeholder ?? "Select value"}
      className={cn("adminHeroSelect", className)}
      classNames={{
        trigger:
          "min-h-10 border-border bg-card shadow-none data-[hover=true]:border-primary data-[open=true]:border-primary data-[focus=true]:ring-2 data-[focus=true]:ring-[var(--admin-focus-ring)]",
        value: "text-sm text-foreground"
      }}
      isDisabled={disabled}
      onSelectionChange={(keys) => {
        const nextValue = Array.from(keys)[0];

        if (typeof nextValue === "string") {
          onValueChange?.(nextValue);
        }
      }}
      radius="sm"
      selectedKeys={value ? new Set([value]) : new Set()}
      variant="bordered"
    >
      {items.map((item) => (
        <HeroSelectItem key={item.value} textValue={item.label}>
          {item.children}
        </HeroSelectItem>
      ))}
    </HeroSelect>
  );
}

export function SelectTrigger({ children }: { children: ReactNode }) {
  return <SelectContext.Provider value={{ placeholder: undefined }}>{children}</SelectContext.Provider>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = useContext(SelectContext);

  return <span data-placeholder={placeholder ?? context.placeholder} />;
}

export function SelectContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SelectItem({ children, value }: SelectItemProps) {
  return <span data-select-item-value={value}>{children}</span>;
}

export function SelectGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SelectLabel({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SelectSeparator() {
  return null;
}

function collectSelectItems(children: ReactNode): Array<{ children: ReactNode; label: string; value: string }> {
  const items: Array<{ children: ReactNode; label: string; value: string }> = [];

  walkSelectChildren(children, (element) => {
    if (element.type === SelectItem) {
      const props = element.props as SelectItemProps;
      items.push({
        children: props.children,
        label: String(props.children),
        value: props.value
      });
    }
  });

  return items;
}

function collectSelectPlaceholder(children: ReactNode) {
  let placeholder: string | undefined;

  walkSelectChildren(children, (element) => {
    if (element.type === SelectValue) {
      placeholder = (element.props as { placeholder?: string }).placeholder;
    }
  });

  return placeholder;
}

function walkSelectChildren(children: ReactNode, visit: (element: ReactElement) => void) {
  if (Array.isArray(children)) {
    for (const child of children) {
      walkSelectChildren(child, visit);
    }
    return;
  }

  if (!isValidElement(children)) {
    return;
  }

  visit(children);
  walkSelectChildren((children.props as { children?: ReactNode }).children, visit);
}
```

After this step, run typecheck. If TypeScript rejects `element.props` narrowing, add local type assertions only inside `collectSelectItems`, `collectSelectPlaceholder`, and `walkSelectChildren`.

- [ ] **Step 7: Replace table wrapper with HeroUI table primitives**

Modify `apps/admin/components/ui/table.tsx`:

```tsx
import type { ComponentProps } from "react";
import {
  Table as HeroTable,
  TableBody as HeroTableBody,
  TableCell as HeroTableCell,
  TableColumn,
  TableHeader as HeroTableHeader,
  TableRow as HeroTableRow
} from "@heroui/table";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<typeof HeroTable>) {
  return (
    <HeroTable
      className={cn("adminHeroTable", className)}
      classNames={{
        base: "overflow-auto",
        table: "min-w-full border-collapse text-sm",
        wrapper: "rounded-lg border border-border bg-card p-0 shadow-none",
        th: "bg-muted px-4 py-3 text-xs font-extrabold text-foreground",
        td: "px-4 py-3 text-muted-foreground",
        tr: "border-b border-border"
      }}
      radius="sm"
      shadow="none"
      {...props}
    />
  );
}

export const TableHeader = HeroTableHeader;
export const TableBody = HeroTableBody;
export const TableRow = HeroTableRow;
export const TableCell = HeroTableCell;
export const TableHead = TableColumn;

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return <tfoot className={cn("border-t bg-muted font-bold", className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}
```

If current table call sites fail because HeroUI Table requires `aria-label`, add `aria-label` to every `<Table>` with the visible panel title, such as `aria-label="Products"`.

- [ ] **Step 8: Add dropdown, drawer, tabs, tooltip, pagination, spinner, and skeleton wrappers**

Create `apps/admin/components/ui/dropdown.tsx`:

```tsx
export {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger
} from "@heroui/dropdown";
```

Create `apps/admin/components/ui/drawer.tsx`:

```tsx
export {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader
} from "@heroui/drawer";
```

Create `apps/admin/components/ui/tabs.tsx`:

```tsx
export { Tab, Tabs } from "@heroui/tabs";
```

Create `apps/admin/components/ui/tooltip.tsx`:

```tsx
export { Tooltip } from "@heroui/tooltip";
```

Create `apps/admin/components/ui/pagination.tsx`:

```tsx
export { Pagination } from "@heroui/pagination";
```

Create `apps/admin/components/ui/spinner.tsx`:

```tsx
export { Spinner } from "@heroui/spinner";
```

Create `apps/admin/components/ui/skeleton.tsx`:

```tsx
export { Skeleton } from "@heroui/skeleton";
```

- [ ] **Step 9: Run wrapper guard tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts admin-styles.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: guard tests for wrappers pass after all direct Radix imports are gone from wrapper files. Typecheck may still fail on page call sites that need HeroUI wrapper adjustments; fix those before moving to the next task.

- [ ] **Step 10: Commit HeroUI wrappers**

Run:

```powershell
git add apps/admin/components/ui apps/admin/app/admin-heroui-modernization.test.ts apps/admin/app/admin-styles.test.ts apps/admin/app/scoped-shadcn-migration.test.ts
git commit -m "feat: replace admin UI primitives with HeroUI"
```

---

### Task 4: Migrate Shared Admin Components, Shell, and Login

**Files:**
- Modify: `apps/admin/components/admin/confirmation-dialog.tsx`
- Modify: `apps/admin/components/admin/file-upload-button.tsx`
- Modify: `apps/admin/components/admin/metric-card.tsx`
- Modify: `apps/admin/components/admin/status-badge.tsx`
- Create: `apps/admin/components/admin/empty-state.tsx`
- Create: `apps/admin/components/admin/loading-state.tsx`
- Create: `apps/admin/components/admin/page-header.tsx`
- Create: `apps/admin/components/admin/pagination-controls.tsx`
- Modify: `apps/admin/app/admin-shell.tsx`
- Modify: `apps/admin/app/login/page.tsx`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts admin-styles.test.ts`

- [ ] **Step 1: Convert confirmation dialog to the HeroUI-compatible modal wrapper**

Modify `apps/admin/components/admin/confirmation-dialog.tsx` so it keeps the existing `ConfirmationState` API:

```tsx
"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export type ConfirmationState = {
  action: () => Promise<void>;
  body: string;
  confirmLabel?: string;
  title: string;
};

export function ConfirmationDialog({
  confirmation,
  isPending,
  onCancel
}: {
  confirmation: ConfirmationState | null;
  isPending: boolean;
  onCancel: () => void;
}) {
  async function confirm() {
    await confirmation?.action();
  }

  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <span className="confirmationIcon" aria-hidden>
            <AlertTriangle size={22} />
          </span>
          <DialogTitle>{confirmation?.title ?? "Confirm action"}</DialogTitle>
          <DialogDescription>{confirmation?.body ?? ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} onClick={() => void confirm()} type="button" variant="destructive">
            {isPending ? "Working..." : confirmation?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add shared empty/loading/page-header/pagination components**

Create `apps/admin/components/admin/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ action, body, title }: { action?: ReactNode; body: string; title: string }) {
  return (
    <Card className="adminEmptyState">
      <CardContent>
        <h2>{title}</h2>
        <p>{body}</p>
        {action}
      </CardContent>
    </Card>
  );
}
```

Create `apps/admin/components/admin/loading-state.tsx`:

```tsx
import { Spinner } from "@/components/ui/spinner";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="adminLoadingState" role="status">
      <Spinner color="primary" size="sm" />
      <span>{label}</span>
    </div>
  );
}
```

Create `apps/admin/components/admin/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  actions,
  eyebrow,
  summary,
  title
}: {
  actions?: ReactNode;
  eyebrow?: string;
  summary?: string;
  title: string;
}) {
  return (
    <header className="adminPageHeader">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {summary ? <p className="panelSummary">{summary}</p> : null}
      </div>
      {actions ? <div className="adminPageActions">{actions}</div> : null}
    </header>
  );
}
```

Create `apps/admin/components/admin/pagination-controls.tsx`:

```tsx
"use client";

import { Pagination } from "@/components/ui/pagination";

export function PaginationControls({
  page,
  totalPages,
  onChange
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="paginationBar">
      <Pagination
        color="primary"
        onChange={onChange}
        page={page}
        radius="sm"
        showControls
        total={Math.max(totalPages, 1)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Modernize file upload, metric card, and status badge wrappers**

Modify `apps/admin/components/admin/file-upload-button.tsx` to use `heroButtonClassName`:

```tsx
import type { InputHTMLAttributes, ReactNode } from "react";
import { heroButtonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FileUploadButton({
  children,
  className,
  inputProps
}: {
  children: ReactNode;
  className?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <label className={cn(heroButtonClassName({ variant: "secondary" }), "cursor-pointer", className)}>
      {children}
      <input className="sr-only" type="file" {...inputProps} />
    </label>
  );
}
```

Modify `apps/admin/components/admin/metric-card.tsx` and `status-badge.tsx` to render `Card` and `Badge` wrappers only, with no native Radix imports and no page-specific mutation logic.

- [ ] **Step 4: Modernize the shell without changing navigation logic**

In `apps/admin/app/admin-shell.tsx`, keep `visibleNavItems = getVisibleNavigationItems(admin?.permissions)`, `handleLogout`, `formatAdminName`, and `getAdminInitials`. Add nav icons through a local map:

```tsx
const navIconMap = {
  Brands: Tag,
  Categories: LayoutGrid,
  Customers: Users,
  Dashboard: LayoutDashboard,
  Delivery: Truck,
  Inventory: Boxes,
  Orders: ShoppingCart,
  Products: Package,
  Reports: BarChart3,
  Settings: Settings,
  Warehouses: Warehouse
} satisfies Record<string, LucideIcon>;
```

Update sidebar links to render:

```tsx
const Icon = navIconMap[item.label] ?? Circle;

<Link
  aria-current={pathname === item.href ? "page" : undefined}
  className="sidebarNavLink"
  href={item.href}
>
  <Icon aria-hidden size={18} />
  <span>{item.label}</span>
</Link>
```

For mobile, add a controlled `isNavOpen` state and a HeroUI `Drawer` that renders the same navigation markup. Do not duplicate permission filtering.

- [ ] **Step 5: Modernize login with HeroUI wrappers**

In `apps/admin/app/login/page.tsx`, keep `email`, `password`, `error`, `isSubmitting`, `login`, and `normalizeNextPath`. Replace native inputs/buttons with:

```tsx
<Input
  autoComplete="email"
  isRequired
  label="Email"
  onChange={(event) => setEmail(event.target.value)}
  type="email"
  value={email}
/>
<Input
  autoComplete="current-password"
  isRequired
  label="Password"
  minLength={8}
  onChange={(event) => setPassword(event.target.value)}
  type="password"
  value={password}
/>
<Button className="w-full" disabled={isSubmitting} type="submit">
  {isSubmitting ? "Signing in..." : "Sign in"}
</Button>
```

- [ ] **Step 6: Add shell and login CSS**

In `apps/admin/app/globals.css`, add Clinical Command Center classes:

```css
.adminPageHeader {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 24px;
}

.adminPageActions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.sidebarNavLink {
  align-items: center;
  display: flex;
  gap: 10px;
}

.adminEmptyState,
.adminLoadingState {
  align-items: center;
  color: var(--muted);
  display: flex;
  justify-content: center;
  min-height: 180px;
  text-align: center;
}

.adminLoadingState {
  gap: 10px;
}

.confirmationIcon {
  align-items: center;
  background: var(--admin-danger-soft);
  border-radius: 8px;
  color: var(--destructive);
  display: inline-flex;
  height: 44px;
  justify-content: center;
  width: 44px;
}
```

- [ ] **Step 7: Run shell tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- admin-heroui-modernization.test.ts admin-styles.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: PASS for the shell/provider/source guards and typecheck after call-site fixes.

- [ ] **Step 8: Commit shared admin modernization**

Run:

```powershell
git add apps/admin/components/admin apps/admin/app/admin-shell.tsx apps/admin/app/login/page.tsx apps/admin/app/globals.css
git commit -m "feat: modernize admin shell with HeroUI"
```

---

### Task 5: Migrate Dashboard, Reports, and Shared Resource Pages

**Files:**
- Modify: `apps/admin/app/_components/reports-dashboard.tsx`
- Modify: `apps/admin/app/dashboard/page.tsx`
- Modify: `apps/admin/app/reports/page.tsx`
- Modify: `apps/admin/app/_components/resource-page.tsx`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- reports-management.test.ts navigation.test.ts admin-heroui-modernization.test.ts`

- [ ] **Step 1: Replace report page chrome with shared header and HeroUI controls**

In `ReportsDashboard`, import:

```tsx
import { PageHeader } from "@/components/admin/page-header";
import { LoadingState } from "@/components/admin/loading-state";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
```

Replace the top header block with:

```tsx
<PageHeader
  actions={
    <Button className="iconTextButton" onClick={refreshReports} type="button" variant="outline">
      <RefreshCw aria-hidden size={16} />
      <span>Refresh</span>
    </Button>
  }
  eyebrow={eyebrow}
  summary="Overview of operations and key performance metrics."
  title={title}
/>
```

Keep `applyFilters`, `resetFilters`, query keys, date math, and dashboard response mapping unchanged.

- [ ] **Step 2: Convert metrics and chart panels to HeroUI cards**

Use the existing card data returned by `buildDashboardCards`. Render each metric with `MetricCard` or:

```tsx
<Card className="metric">
  <CardContent>
    <span className="metricIcon">{card.icon}</span>
    <span>{card.label}</span>
    <strong>{card.value}</strong>
  </CardContent>
</Card>
```

For chart panels, keep existing chart calculations and replace only the panel wrapper:

```tsx
<Card className="chartPanel">
  <CardHeader>
    <CardTitle>{title}</CardTitle>
  </CardHeader>
  <CardContent>{children}</CardContent>
</Card>
```

- [ ] **Step 3: Update `ResourcePage` shared table/list shell**

In `apps/admin/app/_components/resource-page.tsx`, import `PageHeader`, `LoadingState`, `EmptyState`, `Card`, and table wrappers. Preserve the generic type signature:

```tsx
export function ResourcePage<TData, TItem>({
```

Use `PageHeader` for title/summary and render loading with:

```tsx
if (query.isLoading) {
  return <LoadingState label={`Loading ${resourceName.toLowerCase()}...`} />;
}
```

Keep fetcher and row renderer props unchanged.

- [ ] **Step 4: Run report/resource tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- reports-management.test.ts navigation.test.ts admin-heroui-modernization.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: PASS after visual-only changes.

- [ ] **Step 5: Commit dashboard/report migration**

Run:

```powershell
git add apps/admin/app/_components/reports-dashboard.tsx apps/admin/app/_components/resource-page.tsx apps/admin/app/dashboard/page.tsx apps/admin/app/reports/page.tsx apps/admin/app/globals.css
git commit -m "feat: migrate admin dashboard to HeroUI"
```

---

### Task 6: Migrate Brand, Category, Warehouse, and Inventory Surfaces

**Files:**
- Modify: `apps/admin/app/brands/_components/brand-management.tsx`
- Modify: `apps/admin/app/categories/_components/category-management.tsx`
- Modify: `apps/admin/app/warehouses/_components/warehouse-management.tsx`
- Modify: `apps/admin/app/inventory/inventory-management.tsx`
- Modify: `apps/admin/app/brands/_components/brand-management-source.test.ts`
- Modify: `apps/admin/app/categories/_components/category-management-source.test.ts`
- Modify: `apps/admin/app/warehouses/_components/warehouse-management-source.test.ts`
- Modify: `apps/admin/app/inventory/inventory-route-source.test.ts`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- brand-management-source.test.ts category-management-source.test.ts warehouse-management-source.test.ts inventory-route-source.test.ts scoped-shadcn-migration.test.ts`

- [ ] **Step 1: Normalize page headers and filters**

For each scoped page, keep existing state and handler functions. Replace local header markup with `PageHeader`. Replace filter buttons/inputs with existing local wrappers:

```tsx
<form className="filterBar" onSubmit={handleFilterSubmit}>
  <Input
    label="Search"
    onChange={(event) => updateFilter("search", event.target.value)}
    value={filters.search}
  />
  <Button className="iconTextButton" type="submit">
    <Search aria-hidden size={16} />
    <span>Search</span>
  </Button>
  <Button onClick={onReset} type="button" variant="outline">
    Reset
  </Button>
</form>
```

Preserve exact filter keys and reset behavior in each file.

- [ ] **Step 2: Replace selected table wrappers with HeroUI table wrappers**

Every table in these files should render:

```tsx
<Table aria-label="Brand list">
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Slug</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.slug}</TableCell>
        <TableCell>
          <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
        </TableCell>
        <TableCell>
          <Button className="iconTextButton" href={buildBrandEditPath(item.id)} size="sm" variant="outline">
            <Pencil aria-hidden size={16} />
            <span>Edit</span>
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Adapt column labels to each existing table. Do not remove any current displayed fields.

- [ ] **Step 3: Update category child modal to HeroUI dialog wrapper**

Keep `ChildCategoryModal`, `rootCategory`, `onClose`, and child action handlers. Replace modal chrome with the compatibility dialog:

```tsx
<Dialog open={Boolean(rootCategory)} onOpenChange={(open) => !open && onClose()}>
  <DialogContent className="categoryChildDialog">
    <DialogHeader>
      <DialogTitle>{rootCategory.name}</DialogTitle>
      <DialogDescription className="panelSummary">
        Manage child categories for this root category.
      </DialogDescription>
    </DialogHeader>
    <Table aria-label={`Child categories for ${rootCategory.name}`}>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rootCategory.children.map((child) => (
          <TableRow key={child.id}>
            <TableCell>{child.name}</TableCell>
            <TableCell>{child.slug}</TableCell>
            <TableCell>
              <StatusBadge status={child.isActive ? "ACTIVE" : "INACTIVE"} />
            </TableCell>
            <TableCell>
              <Button className="iconTextButton" href={buildCategoryEditPath(child.id)} size="sm" variant="outline">
                <Pencil aria-hidden size={16} />
                <span>Edit</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Replace active booleans and inventory toggles**

Use `Checkbox` when the current page renders a checkbox and `Switch` only when the design benefits from a binary setting. Preserve value conversion:

```tsx
<Checkbox
  isSelected={values.isActive}
  onCheckedChange={(checked) => onValueChange("isActive", checked === true)}
>
  Active
</Checkbox>
```

For inventory filter booleans:

```tsx
<Checkbox
  isSelected={filters.lowStock}
  onCheckedChange={(checked) =>
    onFilterChange("lowStock", checked === true)
  }
>
  Low stock
</Checkbox>
```

- [ ] **Step 5: Run scoped tests and typecheck**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- brand-management-source.test.ts category-management-source.test.ts warehouse-management-source.test.ts inventory-route-source.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: PASS, with source tests updated from shadcn wording to HeroUI wrappers.

- [ ] **Step 6: Commit scoped operational migration**

Run:

```powershell
git add apps/admin/app/brands apps/admin/app/categories apps/admin/app/warehouses apps/admin/app/inventory apps/admin/app/globals.css
git commit -m "feat: migrate operational admin screens to HeroUI"
```

---

### Task 7: Migrate Product Management Without Replacing Lexical

**Files:**
- Modify: `apps/admin/app/products/product-management.tsx`
- Modify: `apps/admin/app/products/product-management-source.test.ts`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- product-management-source.test.ts product-form.test.ts scoped-shadcn-migration.test.ts`

- [ ] **Step 1: Keep product data flow untouched**

Before editing, record these functions in `apps/admin/app/products/product-management.tsx` and do not rename or move them:

```tsx
function buildProductQuery(filters: ProductFilters, page: number) {
function toOptionalBoolean(value: BooleanFilter) {
async function uploadFile(
function formatStatus(value: string) {
function getErrorMessage(error: unknown) {
```

Also preserve:

```tsx
LexicalComposer
RichTextPlugin
OnChangePlugin
$generateHtmlFromNodes
$generateNodesFromDOM
HeadingNode
ListNode
LinkNode
```

- [ ] **Step 2: Modernize product list header, filters, and pagination**

Use `PageHeader`, `Input`, `Select`, `Button`, and `PaginationControls`. Keep `handleFilterSubmit`, `resetFilters`, `setPage`, and all filter field names.

For product pagination, replace the local button bar with:

```tsx
{pagination ? (
  <PaginationControls
    onChange={setPage}
    page={pagination.page}
    totalPages={pagination.totalPages}
  />
) : null}
```

- [ ] **Step 3: Modernize product table actions**

Keep current `requestDeactivate`, `updateProductStatus`, and `requestDelete` calls. Replace clusters of row buttons with `Dropdown` where density improves:

```tsx
<Dropdown>
  <DropdownTrigger>
    <Button aria-label={`Actions for ${product.name}`} size="icon" type="button" variant="ghost">
      <MoreVertical aria-hidden size={16} />
    </Button>
  </DropdownTrigger>
  <DropdownMenu aria-label={`Actions for ${product.name}`}>
    <DropdownItem href={buildProductEditPath(product.id)} key="edit">Edit</DropdownItem>
    <DropdownItem key="status" onPress={() => requestDeactivate(product)}>
      Deactivate
    </DropdownItem>
    <DropdownItem className="text-destructive" key="delete" onPress={() => requestDelete(product)}>
      Delete
    </DropdownItem>
  </DropdownMenu>
</Dropdown>
```

If `DropdownItem href` typecheck fails, render a `Link` inside the item and keep the accessible text.

- [ ] **Step 4: Modernize product form sections and uploads**

Wrap logical form groups in `Card`, not nested cards. Keep `react-hook-form` registration and `form.watch` calls. For upload rows, keep `uploadImage`, `uploadDocument`, and `FileUploadButton`:

```tsx
<FileUploadButton
  inputProps={{
    accept: "image/*",
    disabled: isUploading,
    onChange: (event) => void uploadImage(index, event.target.files?.[0])
  }}
>
  <ImageUp aria-hidden size={16} />
  <span>Upload image</span>
</FileUploadButton>
```

- [ ] **Step 5: Modernize rich text toolbar chrome only**

Keep `RichTextEditorField`, `RichTextToolbar`, `EditorButton`, and Lexical commands. Replace toolbar buttons with `Button size="icon" variant="outline"` and keep the format select:

```tsx
<Button
  aria-label={label}
  onClick={onClick}
  size="icon"
  type="button"
  variant="outline"
>
  <Icon aria-hidden size={16} />
</Button>
```

- [ ] **Step 6: Run product tests and typecheck**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- product-management-source.test.ts product-form.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: PASS. Product form serialization and source guards remain intact.

- [ ] **Step 7: Commit product migration**

Run:

```powershell
git add apps/admin/app/products apps/admin/app/globals.css
git commit -m "feat: migrate product admin to HeroUI"
```

---

### Task 8: Migrate Orders, Customers, Delivery, and Settings

**Files:**
- Modify: `apps/admin/app/orders/page.tsx`
- Modify: `apps/admin/app/orders/[id]/page.tsx`
- Modify: `apps/admin/app/customers/page.tsx`
- Modify: `apps/admin/app/delivery/page.tsx`
- Modify: `apps/admin/app/settings/page.tsx`
- Modify: `apps/admin/lib/order-management.test.ts`
- Modify: `apps/admin/lib/customer-management.test.ts`
- Modify: `apps/admin/lib/delivery-management.test.ts`
- Modify: `apps/admin/lib/settings-management.test.ts`
- Modify: `apps/admin/app/globals.css`
- Test: `corepack pnpm --filter @surgical/admin test -- order-management.test.ts customer-management.test.ts delivery-management.test.ts settings-management.test.ts admin-heroui-modernization.test.ts`

- [ ] **Step 1: Migrate orders list and detail visually**

Keep order query state, `applyFilters`, `resetFilters`, `requestStatusUpdate`, `requestCancel`, and delivery assignment logic. Replace native filter controls with local wrappers:

```tsx
<Input
  label="Search"
  onChange={(event) => onFilterChange("search", event.target.value)}
  value={filters.search}
/>
```

For order detail action cards, use `Card` and `Button`, but keep exact mutation calls and confirmation text.

- [ ] **Step 2: Migrate customers page**

Keep `CustomersContent`, `CustomerFilterForm`, `CustomerTable`, `PaginationControls` behavior. Replace local pagination with shared `PaginationControls`:

```tsx
<PaginationControls
  onChange={setPage}
  page={pagination.page}
  totalPages={Math.max(pagination.totalPages, 1)}
/>
```

- [ ] **Step 3: Migrate delivery page**

Keep `DeliveryContent`, partner filters, assignment filters, `requestPartnerAction`, `requestAssignment`, and `invalidateDeliveryData`. Replace:

```tsx
<div className="paginationControls">
```

with shared `PaginationControls`, and replace partner/assignment panels with `Card` wrappers. Keep status and availability calculations.

- [ ] **Step 4: Migrate settings page with permission semantics preserved**

Keep `SettingsContent`, `AdminUserFilterForm`, `AdminUsersTable`, `AdminUserForm`, `RoleList`, `PermissionList`, `TextField`, `getFieldErrors`, and `getErrorMessage`. Replace the role native select with the HeroUI select compatibility API:

```tsx
<Select
  onValueChange={(value) => onValueChange("roleId", value)}
  value={values.roleId}
>
  <SelectTrigger>
    <SelectValue placeholder="Select role" />
  </SelectTrigger>
  <SelectContent>
    {roles.map((role) => (
      <SelectItem key={role.id} value={role.id}>
        {role.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

For active status, use:

```tsx
<Switch
  isSelected={values.isActive}
  onValueChange={(value) => onValueChange("isActive", value)}
>
  Active
</Switch>
```

- [ ] **Step 5: Run remaining business tests and typecheck**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- order-management.test.ts customer-management.test.ts delivery-management.test.ts settings-management.test.ts admin-heroui-modernization.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: PASS after visual migration.

- [ ] **Step 6: Commit remaining surface migration**

Run:

```powershell
git add apps/admin/app/orders apps/admin/app/customers apps/admin/app/delivery apps/admin/app/settings apps/admin/app/globals.css
git commit -m "feat: migrate remaining admin screens to HeroUI"
```

---

### Task 9: Remove Radix Dependencies, Clean Stale CSS, and Verify

**Files:**
- Modify: `apps/admin/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/admin/app/globals.css`
- Modify: `apps/admin/app/admin-heroui-modernization.test.ts`
- Modify: `apps/admin/app/admin-styles.test.ts`
- Modify: `apps/admin/app/scoped-shadcn-migration.test.ts`
- Test: full admin verification commands

- [ ] **Step 1: Remove direct Radix packages**

Run:

```powershell
corepack pnpm --filter @surgical/admin remove @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot radix-ui
```

Expected: `apps/admin/package.json` no longer lists those package names.

- [ ] **Step 2: Run source scans**

Run:

```powershell
rg -n "@radix-ui|radix-ui|shadcn" apps/admin apps/admin/package.json
```

Expected: no matches, except historical docs outside `apps/admin` are acceptable and should not be edited in this task.

- [ ] **Step 3: Remove obsolete CSS only after no page uses it**

For each old class, scan before removal:

```powershell
rg -n "primaryButton|secondaryButton|ghostButton|dangerButton|confirmationDialog|dialogBackdrop" apps/admin
```

When a class has no TSX usage, remove its CSS block from `apps/admin/app/globals.css`. Keep layout classes still used by pages, such as `panel`, `panelHeader`, `filterBar`, `tableActions`, and dense grid classes, until the final visual QA confirms a cleaner replacement.

- [ ] **Step 4: Run complete admin verification**

Run:

```powershell
corepack pnpm --filter @surgical/admin lint
corepack pnpm --filter @surgical/admin test
corepack pnpm --filter @surgical/admin typecheck
corepack pnpm --filter @surgical/admin build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Start admin dev server for browser QA**

Run:

```powershell
corepack pnpm --filter @surgical/config --filter @surgical/types --filter @surgical/ui build
corepack pnpm --filter @surgical/admin dev
```

Expected: admin app listens on `http://localhost:3001`.

- [ ] **Step 6: Browser QA desktop and mobile**

Use the Browser plugin to inspect:

```text
http://localhost:3001/login
http://localhost:3001/dashboard
http://localhost:3001/products
http://localhost:3001/products/create
http://localhost:3001/brands
http://localhost:3001/categories
http://localhost:3001/inventory
http://localhost:3001/inventory/actions
http://localhost:3001/inventory/movements
http://localhost:3001/warehouses
http://localhost:3001/warehouses/list
http://localhost:3001/warehouses/staff
http://localhost:3001/orders
http://localhost:3001/customers
http://localhost:3001/delivery
http://localhost:3001/reports
http://localhost:3001/settings
```

Verify at `1440x1024`, `1024x768`, and `390x844`:

- Sidebar desktop layout matches the dashboard concept.
- Mobile nav opens from a drawer and closes after route changes.
- Tables remain readable or horizontally scrollable.
- Filters wrap cleanly.
- Dialogs and drawers fit viewport height.
- Buttons and chips do not overflow text.
- No console errors appear.

- [ ] **Step 7: Compare rendered UI with concept images**

Open these references with `view_image`:

```text
docs/superpowers/specs/assets/2026-06-04-admin-heroui-dashboard-concept.png
docs/superpowers/specs/assets/2026-06-04-admin-heroui-crud-concept.png
```

Capture browser screenshots for dashboard and products. Inspect at least:

- Palette.
- Sidebar anatomy.
- Table density.
- Filter/control treatment.
- Card and chip style.
- Modal treatment.
- Drawer/form treatment.
- Typography.
- Responsive collapse.

- [ ] **Step 8: Commit final cleanup**

Run:

```powershell
git add apps/admin/package.json pnpm-lock.yaml apps/admin/app apps/admin/components
git commit -m "chore: remove Radix from admin frontend"
```

---

## Final Verification Checklist

- [ ] `corepack pnpm --filter @surgical/admin lint` exits `0`.
- [ ] `corepack pnpm --filter @surgical/admin test` exits `0`.
- [ ] `corepack pnpm --filter @surgical/admin typecheck` exits `0`.
- [ ] `corepack pnpm --filter @surgical/admin build` exits `0`.
- [ ] `rg -n "@radix-ui|radix-ui|shadcn" apps/admin apps/admin/package.json` returns no matches.
- [ ] Browser QA covers login, dashboard, products, brands, categories, inventory, warehouses, orders, customers, delivery, reports, and settings.
- [ ] Desktop and mobile screenshots are compared with the two approved concept images.
- [ ] Existing dirty environment files are not staged unless the user explicitly asks for them.
