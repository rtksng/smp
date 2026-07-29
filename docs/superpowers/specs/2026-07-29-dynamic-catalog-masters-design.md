# Dynamic Catalog Masters Design

## Goal

Allow an administrator to create a brand, root category, or subcategory and use
the active record immediately throughout the admin and customer catalog without
another code deployment.

## Current Problem

Brand and category records are stored in PostgreSQL and can be created from the
admin, but runtime services still restrict public listings and product
validation to hardcoded slug lists. An arbitrary admin-created brand or root
category therefore saves successfully but does not behave like the seeded
catalog masters.

## Approved Behavior

- All non-deleted, active brands appear in customer brand listings and can be
  assigned to products.
- All non-deleted brands, including inactive records, remain visible in admin
  management screens.
- All non-deleted, active root categories appear in the public category tree.
- Active children of active root categories appear as public subcategories.
- Any non-deleted, active root category can be assigned to a product.
- A selected subcategory must be a non-deleted, active direct child of the
  selected root category.
- If a selected root category has one or more active children, a subcategory is
  required.
- Inactive brands and categories cannot be assigned to new or updated products.
- Existing records, slugs, IDs, URLs, products, and database schema remain
  unchanged.

## Service Changes

### Brands

Remove fixed-slug filtering from public and admin brand queries. Public reads
continue to require `isActive = true` and `deletedAt = null`. Product writes
validate the selected brand by ID using the same active and non-deleted rules.

### Categories

Remove fixed-root filtering from the public category tree. Public reads load
active, non-deleted categories and build the hierarchy from database
relationships. Product writes validate that the selected category is active,
non-deleted, and a root. Subcategory validation also requires an active,
non-deleted direct child.

### Compatibility

The fixed catalog constant files may remain for seed/bootstrap compatibility,
but they will no longer control runtime visibility or product eligibility.
There is no migration because the relational schema already supports dynamic
records.

## Error Handling

- An inactive or deleted brand produces the existing `Brand was not found.`
  response.
- An inactive, deleted, or non-root category produces the existing
  `Category was not found.` response.
- An invalid or inactive child produces the existing
  `Subcategory was not found for the selected category.` response.
- A root with active children still produces
  `Subcategory is required for the selected category.` when no child is chosen.

Keeping the existing response wording avoids changing admin error handling or
API consumers.

## Tests

Tests will be written before production changes and must first fail because of
the hardcoded restrictions. Coverage will prove:

1. A newly created active brand with an arbitrary slug appears publicly.
2. Admin brand listing includes non-deleted records without a slug allowlist.
3. A newly created active root and its active child appear publicly.
4. Products accept an active arbitrary brand and active arbitrary root.
5. Products reject inactive brands, inactive roots, and inactive children.
6. Existing subcategory-required behavior remains intact.

Relevant API catalog tests, API type checking, linting, and production build
must pass before the changes are committed and pushed to `main`.

## Deployment

The implementation will be committed directly to `main` as requested. Railway
will deploy the API behavior, and the Vercel admin/customer projects will
rebuild from the same commit. Production verification will confirm the
deployments are healthy without creating or modifying catalog data.
