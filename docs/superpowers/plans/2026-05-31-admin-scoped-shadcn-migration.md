# Admin Scoped shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Warehouse, Brand, Category, Products, and Inventory admin pages to a shared shadcn-style component foundation while preserving SMEP routes, data flows, permissions, and workflows.

**Architecture:** Add shadcn primitives under `apps/admin/components/ui`, then add small admin wrappers under `apps/admin/components/admin` for repeated operational patterns. Migrate scoped pages onto those primitives without changing backend payloads or route helpers.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui latest, Radix UI primitives, Vitest, Testing Library.

---

## File Structure

Create or modify these files only for the migration:

- Create `components.json`: shadcn CLI configuration for the admin app.
- Modify `apps/admin/tsconfig.json`: add `@/*` alias for admin-local shadcn imports while preserving workspace aliases.
- Modify `apps/admin/package.json` and `pnpm-lock.yaml`: add shadcn/Radix helper dependencies.
- Modify `apps/admin/app/globals.css`: bridge shadcn Tailwind v4 tokens to existing SMEP theme variables and keep dense layout helpers.
- Create `apps/admin/lib/utils.ts`: `cn()` helper used by shadcn components.
- Create `apps/admin/components/ui/*`: shadcn primitives generated from `shadcn@latest`.
- Create `apps/admin/components/admin/confirmation-dialog.tsx`: scoped shared confirmation dialog built on shadcn `Dialog`.
- Create `apps/admin/components/admin/file-upload-button.tsx`: upload label wrapper that uses shadcn button styles.
- Create `apps/admin/components/admin/metric-card.tsx`: compact card used by metrics.
- Create `apps/admin/components/admin/status-badge.tsx`: status badge helper built on shadcn `Badge`.
- Create `apps/admin/app/scoped-shadcn-migration.test.ts`: source-level guard for the scoped migration.
- Modify `apps/admin/app/brands/_components/brand-management.tsx`: migrate Brand UI.
- Modify `apps/admin/app/categories/_components/category-management.tsx`: migrate Category UI.
- Modify `apps/admin/app/products/product-management.tsx`: migrate Products UI and remove the local duplicate confirmation dialog.
- Modify `apps/admin/app/inventory/inventory-management.tsx`: migrate Inventory UI.
- Modify `apps/admin/app/warehouses/_components/warehouse-management.tsx`: migrate Warehouse UI.
- Keep existing route source tests in place and update only string assertions that refer to old dialog/table class names.

Do not intentionally migrate Customer, Orders, Delivery, Reports, Settings, Login, Dashboard, API, worker, or customer web files.

---

### Task 1: Add Migration Guard Test

**Files:**
- Create: `apps/admin/app/scoped-shadcn-migration.test.ts`
- Test command: `corepack pnpm --filter @surgical/admin test -- scoped-shadcn-migration.test.ts`

- [ ] **Step 1: Write the failing source guard test**

Create `apps/admin/app/scoped-shadcn-migration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scopedFiles = [
  "brands/_components/brand-management.tsx",
  "categories/_components/category-management.tsx",
  "products/product-management.tsx",
  "inventory/inventory-management.tsx",
  "warehouses/_components/warehouse-management.tsx"
];

function readAdminAppFile(path: string) {
  return readFileSync(join(__dirname, path), "utf8");
}

describe("scoped admin shadcn migration", () => {
  it("uses admin-local shadcn primitives in every scoped page", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).toContain("@/components/ui/button");
      expect(source, path).toContain("@/components/ui/card");
      expect(source, path).toMatch(/@\/components\/ui\/(?:input|select|textarea|checkbox)/);
    }
  });

  it("removes legacy button and modal classes from scoped pages", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).not.toMatch(
        /className="(?:primaryButton|secondaryButton|ghostButton|dangerButton|dialogBackdrop|confirmationDialog)(?:\s|")/
      );
    }
  });

  it("uses shared shadcn table primitives for scoped data tables", () => {
    for (const path of scopedFiles) {
      const source = readAdminAppFile(path);

      expect(source, path).toContain("@/components/ui/table");
      expect(source, path).toContain("<Table");
      expect(source, path).toContain("<TableHeader");
      expect(source, path).toContain("<TableRow");
      expect(source, path).toContain("<TableCell");
    }
  });

  it("uses the shared admin confirmation dialog instead of local modal markup", () => {
    const scopedSources = scopedFiles.map(readAdminAppFile).join("\n");
    const productSource = readAdminAppFile("products/product-management.tsx");

    expect(scopedSources).toContain("@/components/admin/confirmation-dialog");
    expect(productSource).not.toContain("function ConfirmationDialog(");
    expect(scopedSources).not.toContain('className="dialogBackdrop"');
  });
});
```

- [ ] **Step 2: Run the guard test and confirm it fails**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- scoped-shadcn-migration.test.ts
```

Expected: FAIL because scoped pages still use legacy classes and do not import the new shadcn primitives.

- [ ] **Step 3: Commit the failing test**

Run:

```powershell
git add apps/admin/app/scoped-shadcn-migration.test.ts
git commit -m "test: guard scoped admin shadcn migration"
```

Only stage the new test file.

---

### Task 2: Add shadcn Foundation

**Files:**
- Create: `components.json`
- Create: `apps/admin/lib/utils.ts`
- Create: `apps/admin/components/ui/button.tsx`
- Create: `apps/admin/components/ui/input.tsx`
- Create: `apps/admin/components/ui/textarea.tsx`
- Create: `apps/admin/components/ui/select.tsx`
- Create: `apps/admin/components/ui/checkbox.tsx`
- Create: `apps/admin/components/ui/card.tsx`
- Create: `apps/admin/components/ui/dialog.tsx`
- Create: `apps/admin/components/ui/badge.tsx`
- Create: `apps/admin/components/ui/table.tsx`
- Create: `apps/admin/components/ui/label.tsx`
- Modify: `apps/admin/tsconfig.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/admin/app/globals.css`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add admin-local import aliases**

Modify `apps/admin/tsconfig.json` so `compilerOptions` includes admin-local `@/*` aliases and preserves workspace aliases:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "incremental": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "paths": {
      "@/*": ["apps/admin/*"],
      "@surgical/config": ["packages/config/src/index.ts"],
      "@surgical/types": ["packages/types/src/index.ts"],
      "@surgical/ui": ["packages/ui/src/index.ts"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ],
    "types": ["node"],
    "jsx": "preserve"
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Add shadcn CLI configuration**

Create `components.json` at the repo root:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "apps/admin/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 3: Install shadcn dependencies**

Run from `D:\my-work\smep\surgical-platform`:

```powershell
corepack pnpm --filter @surgical/admin add @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot class-variance-authority clsx tailwind-merge
```

Expected: `apps/admin/package.json` and `pnpm-lock.yaml` update with the new dependencies.

- [ ] **Step 4: Add the shadcn utility helper**

Create `apps/admin/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Generate shadcn primitives**

Run from `D:\my-work\smep\surgical-platform`:

```powershell
corepack pnpm dlx shadcn@latest add button input textarea select checkbox card dialog badge table label
```

Expected: files are created under `apps/admin/components/ui`.

- [ ] **Step 6: Bridge Tailwind v4 theme tokens to SMEP colors**

In `apps/admin/app/globals.css`, keep the existing `:root` SMEP variables and add this `@theme inline` block after `@import "tailwindcss";`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--text);
  --color-card: var(--surface);
  --color-card-foreground: var(--text);
  --color-popover: var(--surface);
  --color-popover-foreground: var(--text);
  --color-primary: var(--primary);
  --color-primary-foreground: #ffffff;
  --color-secondary: #233d4d;
  --color-secondary-foreground: #ffffff;
  --color-warning: var(--warning);
  --color-muted: var(--surface-muted);
  --color-muted-foreground: var(--muted);
  --color-accent: #d8f3dc;
  --color-accent-foreground: #12342d;
  --color-destructive: #9b2226;
  --color-destructive-foreground: #ffffff;
  --color-border: var(--border);
  --color-input: var(--border);
  --color-ring: var(--primary);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 8px;
}
```

If the shadcn CLI inserts duplicate neutral tokens, consolidate them so the SMEP variables above are the source of truth.

- [ ] **Step 7: Run foundation checks**

Run:

```powershell
corepack pnpm --filter @surgical/admin typecheck
corepack pnpm --filter @surgical/admin test -- scoped-shadcn-migration.test.ts
```

Expected: typecheck passes or only reports downstream migration errors from pages not yet converted; the migration guard test still fails until scoped pages are migrated.

- [ ] **Step 8: Commit the foundation**

Run:

```powershell
git add components.json apps/admin/tsconfig.json apps/admin/package.json apps/admin/app/globals.css apps/admin/lib/utils.ts apps/admin/components/ui pnpm-lock.yaml
git commit -m "feat: add admin shadcn component foundation"
```

Only stage foundation files.

---

### Task 3: Add Shared Admin shadcn Wrappers

**Files:**
- Create: `apps/admin/components/admin/confirmation-dialog.tsx`
- Create: `apps/admin/components/admin/file-upload-button.tsx`
- Create: `apps/admin/components/admin/metric-card.tsx`
- Create: `apps/admin/components/admin/status-badge.tsx`

- [ ] **Step 1: Create shared confirmation dialog**

Create `apps/admin/components/admin/confirmation-dialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
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
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  title: string;
};

export function ConfirmationDialog({
  confirmation,
  isPending,
  onCancel,
  onConfirmComplete
}: {
  confirmation: ConfirmationState | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirmComplete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [confirmation]);

  async function confirm() {
    if (!confirmation) {
      return;
    }

    try {
      setError(null);
      await confirmation.onConfirm();
      onConfirmComplete();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    }
  }

  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmation?.title ?? "Confirm action"}</DialogTitle>
          <DialogDescription>{confirmation?.body ?? ""}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={isPending} onClick={() => void confirm()} type="button" variant="destructive">
            {isPending ? "Working..." : confirmation?.confirmLabel ?? "Confirm"}
          </Button>
          <Button disabled={isPending} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create file upload button wrapper**

Create `apps/admin/components/admin/file-upload-button.tsx`:

```tsx
import type { InputHTMLAttributes, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileUploadButtonProps = {
  children: ReactNode;
  className?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

export function FileUploadButton({ children, className, inputProps }: FileUploadButtonProps) {
  return (
    <label className={cn(buttonVariants({ variant: "secondary" }), "relative cursor-pointer", className)}>
      {children}
      <input
        {...inputProps}
        className="absolute h-px w-px opacity-0"
        type="file"
      />
    </label>
  );
}
```

- [ ] **Step 3: Create metric card wrapper**

Create `apps/admin/components/admin/metric-card.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;
  tone?: "primary" | "warning" | "neutral";
};

const toneClassName = {
  primary: "border-t-primary",
  warning: "border-t-warning",
  neutral: "border-t-[#63736f]"
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <Card className={cn("min-h-[132px] border-t-4", toneClassName[tone])}>
      <CardContent className="p-5">
        <span className="block text-sm font-semibold text-muted-foreground">{label}</span>
        <strong className="mt-5 block text-3xl text-foreground">{value}</strong>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create status badge helper**

Create `apps/admin/components/admin/status-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusToneClassName: Record<string, string> = {
  active: "bg-[#d8f3dc] text-[#1b5e20]",
  draft: "bg-[#edf2f7] text-[#344054]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  out_of_stock: "bg-[#fff4dc] text-[#8a4b00]",
  pending: "bg-[#eef2ff] text-[#3730a3]",
  created: "bg-[#eef2ff] text-[#3730a3]",
  confirmed: "bg-[#d8f3dc] text-[#1b5e20]",
  paid: "bg-[#d8f3dc] text-[#1b5e20]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
  failed: "bg-[#fee2e2] text-[#991b1b]"
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("capitalize", statusToneClassName[status.toLowerCase()] ?? "bg-muted text-muted-foreground")}>
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}
```

- [ ] **Step 5: Run wrapper checks**

Run:

```powershell
corepack pnpm --filter @surgical/admin typecheck
```

Expected: wrapper files typecheck.

- [ ] **Step 6: Commit wrappers**

Run:

```powershell
git add apps/admin/components/admin apps/admin/app/globals.css
git commit -m "feat: add admin shadcn workflow wrappers"
```

Only stage wrapper files and the warning token change.

---

### Task 4: Migrate Brand and Category Pages

**Files:**
- Modify: `apps/admin/app/brands/_components/brand-management.tsx`
- Modify: `apps/admin/app/brands/_components/brand-management-source.test.ts`
- Modify: `apps/admin/app/categories/_components/category-management.tsx`
- Modify: `apps/admin/app/categories/_components/category-management-source.test.ts`

- [ ] **Step 1: Update imports in Brand and Category components**

In both component files, import these primitives:

```tsx
import { ConfirmationDialog, type ConfirmationState } from "@/components/admin/confirmation-dialog";
import { FileUploadButton } from "@/components/admin/file-upload-button";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
```

Remove the old relative import from `../../_components/confirmation-dialog`.

- [ ] **Step 2: Replace top-level panels and metrics**

Replace repeated metric articles like:

```tsx
<article className="metric metric--primary">
  <span>Total brands</span>
  <strong>{summary.total}</strong>
</article>
```

with:

```tsx
<MetricCard label="Total brands" tone="primary" value={summary.total} />
```

Use `label="Total categories"` for category totals and keep the existing values unchanged.

- [ ] **Step 3: Replace Brand table markup**

In `BrandTable`, keep the outer horizontal scroll wrapper if needed, but replace table children with shadcn primitives:

```tsx
<div className="brandTableScroll">
  <Table className="brandDataTable">
    <TableHeader>
      <TableRow>
        <TableHead>Brand</TableHead>
        <TableHead>Image</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Sort order</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {brands.map((brand) => (
        <TableRow key={brand.id}>
          <TableCell>
            <strong>{brand.name}</strong>
            <span className="tableSubtext">{brand.slug}</span>
          </TableCell>
          <TableCell>{brand.imageUrl ? <img alt="" className="brandImagePreview" src={brand.imageUrl} /> : "No image"}</TableCell>
          <TableCell><StatusBadge status={brand.isActive ? "active" : "inactive"} /></TableCell>
          <TableCell>{brand.sortOrder}</TableCell>
          <TableCell>{/* keep existing edit/delete actions, but render with Button */}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

Keep the existing brand route links and delete mutation logic. Use `Button asChild variant="outline"` for edit links and `Button variant="destructive"` for delete buttons.

- [ ] **Step 4: Replace Category table markup**

In `CategoryTable`, use the same shadcn `Table` pattern. Preserve `formatChildCategoryCount`, `ChildCategoryModal`, `setChildCategoryModal(category)`, and `buildCategoryEditPath(category.id)`.

- [ ] **Step 5: Replace Brand and Category form controls**

For text fields, replace raw inputs with:

```tsx
<Label>
  Name
  <Input onChange={(event) => onChange(event.target.value)} value={value} />
</Label>
```

For descriptions:

```tsx
<Label>
  Description
  <Textarea onChange={(event) => onChange(event.target.value)} value={value} />
</Label>
```

For active toggles:

```tsx
<Label className="checkField">
  <Checkbox
    checked={values.isActive}
    onCheckedChange={(checked) => updateValue("isActive", checked === true)}
  />
  Active
</Label>
```

For upload labels:

```tsx
<FileUploadButton
  inputProps={{
    accept: "image/*",
    disabled: isUploading,
    onChange: (event) => void uploadImage(event)
  }}
>
  Upload image
</FileUploadButton>
```

- [ ] **Step 6: Update Category child modal**

Replace manual `dialogBackdrop`/`confirmationDialog` child modal markup with shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, and `Button`. Keep `categoryChildDialog` only if needed for width/scroll CSS; do not keep `dialogBackdrop`.

- [ ] **Step 7: Update route source tests**

In `brand-management-source.test.ts`, keep existing route/image assertions. In `category-management-source.test.ts`, replace assertions for old dialog classes:

```ts
expect(categoryManagementSource).toContain("ChildCategoryModal");
expect(categoryManagementSource).toContain("setChildCategoryModal(category)");
expect(categoryManagementSource).toContain("@/components/ui/dialog");
expect(categoryManagementSource).not.toContain('className="dialogBackdrop"');
```

- [ ] **Step 8: Run Brand and Category tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- brand-management-source.test.ts category-management-source.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: Brand and Category route tests pass. The scoped migration test may still fail for Products, Inventory, and Warehouse.

- [ ] **Step 9: Commit Brand and Category migration**

Run:

```powershell
git add apps/admin/app/brands/_components/brand-management.tsx apps/admin/app/brands/_components/brand-management-source.test.ts apps/admin/app/categories/_components/category-management.tsx apps/admin/app/categories/_components/category-management-source.test.ts
git commit -m "feat: migrate brand and category admin UI to shadcn"
```

---

### Task 5: Migrate Warehouse and Inventory Pages

**Files:**
- Modify: `apps/admin/app/warehouses/_components/warehouse-management.tsx`
- Modify: `apps/admin/app/warehouses/_components/warehouse-management-source.test.ts`
- Modify: `apps/admin/app/inventory/inventory-management.tsx`
- Modify: `apps/admin/app/inventory/inventory-route-source.test.ts`

- [ ] **Step 1: Update imports**

Import the same admin wrappers and shadcn primitives used in Task 4. Warehouse needs `Select`; Inventory needs `Select`, `Textarea`, and `Checkbox`.

- [ ] **Step 2: Replace filters with shadcn controls**

For warehouse and inventory filter forms, preserve existing `handleFilterSubmit`, `resetFilters`, and state update functions. Replace raw controls with `Input`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem`.

Use this sentinel-value pattern for controlled selects so Radix Select never receives an empty item value:

```tsx
const ALL_STATUSES_VALUE = "__all_statuses__";

<Select
  value={filters.status || ALL_STATUSES_VALUE}
  onValueChange={(value) =>
    updateFilter("status", value === ALL_STATUSES_VALUE ? "" : value)
  }
>
  <SelectTrigger>
    <SelectValue placeholder="Status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
    <SelectItem value="ACTIVE">Active</SelectItem>
    <SelectItem value="INACTIVE">Inactive</SelectItem>
  </SelectContent>
</Select>
```

- [ ] **Step 3: Replace Warehouse tables**

Convert `WarehouseTable` and analytics tables from `div role="table"` to shadcn `Table` primitives. Preserve:

```ts
buildWarehouseEditPath(warehouse.id)
buildWarehouseCreatePath(WAREHOUSE_LIST_PATH)
router.push(redirectAfterSavePath)
```

Use `Button asChild variant="outline"` for edit links and `Button variant="secondary"` for staff/inventory route actions.

- [ ] **Step 4: Replace Inventory tables**

Convert `StockTable`, `BatchTable`, and `MovementTable` to shadcn `Table` primitives. Preserve all existing data fields and empty-state text:

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Product</TableHead>
      <TableHead>Warehouse</TableHead>
      <TableHead>Available</TableHead>
      <TableHead>Reserved</TableHead>
      <TableHead>Low stock</TableHead>
      <TableHead>Expiry</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>{/* existing stock rows */}</TableBody>
</Table>
```

- [ ] **Step 5: Replace action forms**

For `StockInForm`, `AdjustStockForm`, and `TransferStockForm`, use `Card`, `Input`, `Select`, `Textarea`, and `Button`. Preserve payload builders and submit handlers:

```ts
submitStockIn(values)
submitAdjustment(values)
submitTransfer(values)
```

- [ ] **Step 6: Update tests**

Keep existing assertions for route split, admin product selector API, staff-query gating, and removed duplicate panels. Update only old class-name assertions that no longer apply because tables/dialogs are shadcn-based.

- [ ] **Step 7: Run Warehouse and Inventory tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- warehouse-management-source.test.ts inventory-route-source.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: Warehouse and Inventory tests pass. The scoped migration test may still fail for Products.

- [ ] **Step 8: Commit Warehouse and Inventory migration**

Run:

```powershell
git add apps/admin/app/warehouses/_components/warehouse-management.tsx apps/admin/app/warehouses/_components/warehouse-management-source.test.ts apps/admin/app/inventory/inventory-management.tsx apps/admin/app/inventory/inventory-route-source.test.ts
git commit -m "feat: migrate warehouse and inventory admin UI to shadcn"
```

---

### Task 6: Migrate Products Page

**Files:**
- Modify: `apps/admin/app/products/product-management.tsx`
- Modify: `apps/admin/app/products/product-management-source.test.ts`

- [ ] **Step 1: Update imports**

Add shadcn primitive imports for `Button`, `Card`, `Input`, `Textarea`, `Select`, `Checkbox`, `Table`, `Badge`, and the admin wrappers. Remove the local `ConfirmationDialog` implementation and import:

```tsx
import { ConfirmationDialog, type ConfirmationState } from "@/components/admin/confirmation-dialog";
```

- [ ] **Step 2: Migrate product filters**

Preserve `buildProductQuery(filters, page)`, `handleFilterSubmit`, and `resetFilters`. Replace raw inputs/selects with shadcn controls. Keep existing product filter field names unchanged.

- [ ] **Step 3: Migrate product table**

Replace `<table className="brandDataTable productDataTable">` with shadcn `Table` primitives. Preserve:

```ts
href={PRODUCT_CREATE_PATH}
href={buildProductEditPath(product.id)}
router.push(PRODUCT_LIST_PATH)
```

Use `StatusBadge` for product status and shadcn `Badge` for product flags.

- [ ] **Step 4: Migrate product form sections**

Replace section panels with `Card`. Replace text controls with `Input` and `Textarea`. Replace boolean fields with controlled `Checkbox`:

```tsx
<Label className="checkField">
  <Checkbox
    checked={form.watch("expirySensitive")}
    onCheckedChange={(checked) => form.setValue("expirySensitive", checked === true)}
  />
  Expiry sensitive
</Label>
```

Keep `ProductFormValues`, `buildProductPayload(values)`, and `productToFormValues(product)` unchanged.

- [ ] **Step 5: Migrate assets, documents, and variants**

Use `Card` for repeated asset/document/variant rows, `FileUploadButton` for file inputs, `Input` for URL/order fields, `Checkbox` for primary image flags, and `Button variant="destructive"` for remove actions. Preserve array add/remove handlers and existing field paths.

- [ ] **Step 6: Keep Lexical editor behavior intact**

Do not replace `LexicalComposer`, `RichTextPlugin`, `OnChangePlugin`, `$generateHtmlFromNodes`, `$generateNodesFromDOM`, `HeadingNode`, `ListNode`, `LinkNode`, `data-editor="lexical"`, `lexicalEditorFrame`, `useId`, or `aria-labelledby={labelId}`. Only migrate toolbar buttons/selects to shadcn `Button` and `Select`.

- [ ] **Step 7: Update product source test**

Keep existing route and Lexical assertions. Add assertions:

```ts
expect(productManagementSource).toContain("@/components/ui/button");
expect(productManagementSource).toContain("@/components/ui/table");
expect(productManagementSource).toContain("@/components/admin/confirmation-dialog");
expect(productManagementSource).not.toContain("function ConfirmationDialog(");
```

- [ ] **Step 8: Run Product tests**

Run:

```powershell
corepack pnpm --filter @surgical/admin test -- product-management-source.test.ts scoped-shadcn-migration.test.ts
corepack pnpm --filter @surgical/admin typecheck
```

Expected: Product tests and the scoped migration guard pass.

- [ ] **Step 9: Commit Products migration**

Run:

```powershell
git add apps/admin/app/products/product-management.tsx apps/admin/app/products/product-management-source.test.ts
git commit -m "feat: migrate product admin UI to shadcn"
```

---

### Task 7: CSS Cleanup and Full Verification

**Files:**
- Modify: `apps/admin/app/globals.css`
- Modify: `README.md` if the final migration changes documented admin setup commands or adds new shadcn usage notes.

- [ ] **Step 1: Remove obsolete scoped CSS**

In `apps/admin/app/globals.css`, remove CSS that is no longer referenced by the scoped pages:

```css
.primaryButton
.secondaryButton
.dangerButton
.dialogBackdrop
.confirmationDialog
```

Keep classes still used by non-scoped pages unless those pages are also migrated later. Keep layout-only classes such as grid wrappers and dense table min-width helpers when referenced.

- [ ] **Step 2: Run source checks for dead scoped legacy classes**

Run:

```powershell
rg -n 'className="(primaryButton|secondaryButton|ghostButton|dangerButton|dialogBackdrop|confirmationDialog)' apps/admin/app/brands apps/admin/app/categories apps/admin/app/products apps/admin/app/inventory apps/admin/app/warehouses
```

Expected: no matches in the scoped pages.

- [ ] **Step 3: Run admin verification**

Run:

```powershell
corepack pnpm --filter @surgical/admin lint
corepack pnpm --filter @surgical/admin test
corepack pnpm --filter @surgical/admin typecheck
corepack pnpm --filter @surgical/admin build
```

Expected: all commands pass. If a command fails because of pre-existing unrelated worktree changes, capture the exact failing file and error in the final summary.

- [ ] **Step 4: Run repo-level verification when package metadata changed**

Because `pnpm-lock.yaml` and `apps/admin/package.json` change, run:

```powershell
corepack pnpm -r --sort lint
corepack pnpm -r --sort typecheck
corepack pnpm -r --sort build
```

Expected: all commands pass or failures are documented with exact scope.

- [ ] **Step 5: Visual verification**

Start the admin app:

```powershell
corepack pnpm dev:admin
```

Open the admin app at `http://localhost:3001` and verify these routes:

- `/warehouses`
- `/warehouses/list`
- `/warehouses/create`
- `/warehouses/staff`
- `/brands`
- `/brands/create`
- `/categories`
- `/categories/create`
- `/products`
- `/products/create`
- `/inventory`
- `/inventory/actions`
- `/inventory/movements`

Expected: buttons, filters, cards, dialogs, badges, checkboxes, and tables are visually consistent; no text overlaps; the fixed sidebar behavior remains unchanged.

- [ ] **Step 6: Final commit**

Run:

```powershell
git add apps/admin/app/globals.css README.md
git commit -m "chore: clean scoped admin legacy UI styles"
```

Only include `README.md` if it changed.
