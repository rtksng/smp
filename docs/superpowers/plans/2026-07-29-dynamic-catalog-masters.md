# Dynamic Catalog Masters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every active admin-created brand, root category, and subcategory visible and usable throughout the SMP catalog without changing a hardcoded allowlist.

**Architecture:** Keep PostgreSQL as the source of truth and remove runtime slug allowlists from brand/category reads and product relationship validation. Preserve the existing active/deleted/root/parent rules and existing API error messages, with no schema migration.

**Tech Stack:** NestJS 10, TypeScript, Prisma 7, Node test runner, pnpm workspace.

## Global Constraints

- Preserve all existing brand, category, product, slug, URL, and database records.
- Public catalog endpoints expose only active, non-deleted records.
- Admin master-data endpoints continue to expose active and inactive non-deleted records.
- Product writes accept only active, non-deleted brands and active, non-deleted root categories.
- A subcategory must be an active, non-deleted direct child of the selected root.
- Do not stage or commit the unrelated deletion of `apps/mobile/.env.example`.
- Implement with strict red-green TDD and push the verified result directly to `main`.

---

### Task 1: Make Brand Listings Database-Driven

**Files:**
- Modify: `apps/api/test/catalog/brands.service.test.ts`
- Modify: `apps/api/src/modules/brands/brands.service.ts`

**Interfaces:**
- Consumes: `BrandsService.listPublicBrands()` and `BrandsService.listAdminBrands()`.
- Produces: Public active-brand results and admin non-deleted-brand results without slug allowlists.

- [ ] **Step 1: Change the brand behavior tests**

Update the test Prisma `findMany` double to apply the supplied `deletedAt`,
`isActive`, and optional `slug.in` predicates and the requested name ordering,
so assertions exercise the service through a faithful database boundary.

Update `listPublicBrands returns only active brands with logo support` so the
expected slugs are `["abbott", "legacy-brand"]` and the expected Prisma query
is:

```ts
{
  orderBy: { name: "asc" },
  where: {
    deletedAt: null,
    isActive: true
  }
}
```

Update the admin listing test to expect the arbitrary `legacy-brand` record and
this query:

```ts
{
  orderBy: { name: "asc" },
  where: {
    deletedAt: null
  }
}
```

- [ ] **Step 2: Run the brand test and verify RED**

Run:

```powershell
corepack pnpm --filter @surgical/api exec tsx --tsconfig tsconfig.json --test test/catalog/brands.service.test.ts
```

Expected: the public/admin listing assertions fail because
`legacy-brand` is filtered by the current fixed slug list.

- [ ] **Step 3: Implement the minimal brand change**

In `brands.service.ts`, remove imports and query/filter predicates based on
`FIXED_CATALOG_BRAND_SLUGS` and `isFixedCatalogBrandSlug`. Retain:

```ts
where: {
  deletedAt: null,
  isActive: true
}
```

for public listing, and:

```ts
where: {
  deletedAt: null
}
```

for admin listing. `getPublicBrandBySlug` must accept any slug while still
requiring `deletedAt: null` and `isActive: true`.

- [ ] **Step 4: Run the brand test and verify GREEN**

Run the Step 2 command. Expected: all brand service tests pass.

---

### Task 2: Make the Public Category Tree Database-Driven

**Files:**
- Modify: `apps/api/test/catalog/categories.service.test.ts`
- Modify: `apps/api/src/modules/categories/categories.service.ts`

**Interfaces:**
- Consumes: `CategoriesService.listPublicCategories()` and `getPublicCategoryBySlug()`.
- Produces: An active database-backed root/child tree without fixed root slugs.

- [ ] **Step 1: Change the public category behavior test**

In the existing public category test, expect both active roots:

```ts
assert.deepEqual(
  categories.map((category) => category.slug),
  ["dental", "surgical-instruments"]
);
```

Retain the assertion that `dental` contains only the active `endodontics`
child. Replace the expected Prisma query with:

```ts
{
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  where: {
    deletedAt: null,
    isActive: true
  }
}
```

- [ ] **Step 2: Run the category test and verify RED**

Run:

```powershell
corepack pnpm --filter @surgical/api exec tsx --tsconfig tsconfig.json --test test/catalog/categories.service.test.ts
```

Expected: the active arbitrary root is missing because
`getFixedCatalogRoots()` filters it out.

- [ ] **Step 3: Implement the minimal category change**

Remove runtime imports and calls to `FIXED_ROOT_CATEGORY_SLUGS` and
`isFixedRootCategorySlug`. Both public list and public-by-slug should query:

```ts
where: {
  deletedAt: null,
  isActive: true
}
```

Build the tree with `buildCategoryTree(categories).roots`. Keep
`listAdminCategories()` unchanged.

- [ ] **Step 4: Run the category test and verify GREEN**

Run the Step 2 command. Expected: all category service tests pass.

---

### Task 3: Make Product Master Validation Dynamic and Active-Only

**Files:**
- Modify: `apps/api/test/catalog/products.service.test.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`

**Interfaces:**
- Consumes: `ProductsService.createProduct()` and `updateProduct()`.
- Produces: Relationship validation based on active database records rather than slug allowlists.

- [ ] **Step 1: Upgrade the product test fixture**

Extend `createProductPrismaMock` with optional relationship fixtures:

```ts
type ProductRelations = {
  brand?: RelatedFixture | null;
  categories?: RelatedFixture[];
};

function createProductPrismaMock(
  records: ProductFixture[],
  relations: ProductRelations = {
    brand: activeBrand,
    categories: [activeCategory, activeSubcategory]
  }
): ProductPrismaMock
```

Make `brand.findFirst` and `category.findFirst` return a fixture only when every
supplied `id`, `deletedAt`, `isActive`, `parentId`, and `slug.in` predicate
matches it. This keeps the mock faithful to the production Prisma boundary.

- [ ] **Step 2: Change the existing create-product query assertions**

The brand lookup must be:

```ts
{
  where: {
    deletedAt: null,
    id: activeBrand.id,
    isActive: true
  }
}
```

The root lookup must be:

```ts
{
  where: {
    deletedAt: null,
    id: activeCategory.id,
    isActive: true,
    parentId: null
  }
}
```

The child lookup must be:

```ts
{
  where: {
    deletedAt: null,
    id: activeSubcategory.id,
    isActive: true,
    parentId: activeCategory.id
  }
}
```

- [ ] **Step 3: Add dynamic and inactive relationship tests**

Extract the existing valid create input into a test-only
`createProductInput()` fixture builder. Add tests with literal fixtures that
prove:

```ts
const dynamicBrand = {
  ...activeBrand,
  id: "brand-dynamic",
  name: "Dynamic Medical",
  slug: "dynamic-medical"
};
const dynamicRoot = {
  ...activeCategory,
  id: "category-dynamic",
  name: "Hospital Furniture",
  slug: "hospital-furniture"
};
```

- Creating a product with `dynamicBrand` and `dynamicRoot` succeeds.
- A brand with `isActive: false` and allowed legacy slug `abbott` is rejected
  with `NotFoundException`.
- A root with `isActive: false` and legacy slug `dental` is rejected with
  `NotFoundException`.
- An inactive direct child is rejected with `NotFoundException`.

- [ ] **Step 4: Run the product test and verify RED**

Run:

```powershell
corepack pnpm --filter @surgical/api exec tsx --tsconfig tsconfig.json --test test/catalog/products.service.test.ts
```

Expected: dynamic fixtures fail the fixed slug checks, while inactive legacy
fixtures are incorrectly accepted because current lookups omit `isActive`.

- [ ] **Step 5: Implement minimal product validation**

Remove fixed brand/category constant imports. Change `assertBrandExists` to:

```ts
where: {
  deletedAt: null,
  id: brandId,
  isActive: true
}
```

Change root and child category checks to include `isActive: true`, while
retaining `parentId: null` for roots and `parentId: categoryId` for children.
Keep the active-child count and existing error messages unchanged.

- [ ] **Step 6: Run the product test and verify GREEN**

Run the Step 4 command. Expected: all product service tests pass.

---

### Task 4: Full Verification and Main Publication

**Files:**
- Verify: all scoped source, test, design, and plan files

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: a verified commit on `main` and healthy production deployments.

- [ ] **Step 1: Run the complete API verification**

Run:

```powershell
corepack pnpm --filter @surgical/api test
corepack pnpm --filter @surgical/api typecheck
corepack pnpm --filter @surgical/api lint
corepack pnpm --filter @surgical/api build
```

Expected: every command exits `0`.

- [ ] **Step 2: Run frontend compatibility verification**

Run:

```powershell
corepack pnpm --filter @surgical/admin typecheck
corepack pnpm --filter @surgical/admin build
corepack pnpm --filter @surgical/web typecheck
corepack pnpm --filter @surgical/web build
```

Expected: every command exits `0`. Restore only build-generated
`next-env.d.ts` line changes if produced.

- [ ] **Step 3: Review the final scope**

Run:

```powershell
git diff --check
git status --short
git diff -- apps/api/src/modules/brands/brands.service.ts apps/api/src/modules/categories/categories.service.ts apps/api/src/modules/products/products.service.ts apps/api/test/catalog/brands.service.test.ts apps/api/test/catalog/categories.service.test.ts apps/api/test/catalog/products.service.test.ts
```

Expected: only the approved catalog change plus documentation is present;
`apps/mobile/.env.example` remains unstaged.

- [ ] **Step 4: Commit and push**

Stage only the scoped implementation, tests, design, and plan. Commit with:

```powershell
git commit -m "Enable dynamic catalog brands and categories"
git push origin main
```

- [ ] **Step 5: Verify deployment**

Monitor Railway API health and both Vercel production projects to terminal
status. Perform read-only health checks only; do not create catalog data in
production.
