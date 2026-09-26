import {
  brandFormSchema,
  buildBrandPayload,
  buildCategoryPayload,
  categoryFormSchema,
  createEmptyBrandFormValues,
  createEmptyCategoryFormValues,
  slugifyCatalogName
} from "./catalog-management";

export const MAX_CATALOG_BULK_CREATE_ROWS = 30;

export type CatalogBulkCreateKind = "brand" | "category";

export type CatalogBulkCreateRow = {
  id: string;
  isActive: boolean;
  name: string;
  parentId: string;
  slug: string;
  slugEdited: boolean;
  sortOrder: string;
};

export type CatalogBulkCreateRowErrors = Partial<
  Record<"name" | "parentId" | "slug" | "sortOrder", string>
>;

export type CatalogBulkCreatePayload =
  | ReturnType<typeof buildBrandPayload>
  | ReturnType<typeof buildCategoryPayload>;

export type ValidCatalogBulkCreateRow = {
  payload: CatalogBulkCreatePayload;
  row: CatalogBulkCreateRow;
};

let bulkCreateRowSequence = 0;

export function createCatalogBulkCreateRow(
  values: Partial<Omit<CatalogBulkCreateRow, "id">> = {}
): CatalogBulkCreateRow {
  bulkCreateRowSequence += 1;

  return {
    id: `catalog-bulk-row-${bulkCreateRowSequence}`,
    isActive: values.isActive ?? true,
    name: values.name ?? "",
    parentId: values.parentId ?? "",
    slug: values.slug ?? "",
    slugEdited: values.slugEdited ?? false,
    sortOrder: values.sortOrder ?? "0"
  };
}

export function createCatalogBulkRowsFromNames(
  value: string,
  options: {
    isActive?: boolean;
    parentId?: string;
    sortOrderStart?: number;
  } = {}
) {
  return value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_CATALOG_BULK_CREATE_ROWS)
    .map((name, index) =>
      createCatalogBulkCreateRow({
        isActive: options.isActive,
        name,
        parentId: options.parentId,
        slug: slugifyCatalogName(name),
        sortOrder: String((options.sortOrderStart ?? 0) + index)
      })
    );
}

export function catalogBulkCreateRowHasContent(row: CatalogBulkCreateRow) {
  return row.name.trim().length > 0 || row.slug.trim().length > 0;
}

export function validateCatalogBulkCreateRows(
  rows: readonly CatalogBulkCreateRow[],
  kind: CatalogBulkCreateKind,
  existingSlugs: readonly string[] = []
) {
  const candidates = rows.filter(catalogBulkCreateRowHasContent);
  const existingSlugSet = new Set(
    existingSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean)
  );
  const slugCounts = new Map<string, number>();

  for (const row of candidates) {
    const slug = row.slug.trim().toLowerCase();

    if (slug) {
      slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
    }
  }

  const errors: Record<string, CatalogBulkCreateRowErrors> = {};
  const validRows: ValidCatalogBulkCreateRow[] = [];

  for (const row of candidates) {
    const rowErrors: CatalogBulkCreateRowErrors = {};
    const normalizedSlug = row.slug.trim().toLowerCase();
    let payload: CatalogBulkCreatePayload | null = null;

    if (kind === "brand") {
      const parsed = brandFormSchema.safeParse({
        ...createEmptyBrandFormValues(),
        isActive: row.isActive,
        name: row.name,
        slug: row.slug
      });

      if (parsed.success) {
        payload = buildBrandPayload(parsed.data);
      } else {
        assignCatalogRowErrors(parsed.error.issues, rowErrors);
      }
    } else {
      const parsed = categoryFormSchema.safeParse({
        ...createEmptyCategoryFormValues(),
        isActive: row.isActive,
        name: row.name,
        parentId: row.parentId,
        slug: row.slug,
        sortOrder: row.sortOrder
      });

      if (parsed.success) {
        payload = buildCategoryPayload(parsed.data);
      } else {
        assignCatalogRowErrors(parsed.error.issues, rowErrors);
      }
    }

    if (normalizedSlug && existingSlugSet.has(normalizedSlug)) {
      rowErrors.slug = "This slug already exists.";
    } else if (normalizedSlug && (slugCounts.get(normalizedSlug) ?? 0) > 1) {
      rowErrors.slug = "This slug is repeated in the batch.";
    }

    if (Object.keys(rowErrors).length > 0 || !payload) {
      errors[row.id] = rowErrors;
    } else {
      validRows.push({ payload, row });
    }
  }

  return {
    candidateCount: candidates.length,
    errors,
    validRows
  };
}

function assignCatalogRowErrors(
  issues: readonly { message: string; path: PropertyKey[] }[],
  errors: CatalogBulkCreateRowErrors
) {
  for (const issue of issues) {
    const field = issue.path[0];

    if (
      (field === "name" ||
        field === "parentId" ||
        field === "slug" ||
        field === "sortOrder") &&
      !errors[field]
    ) {
      errors[field] = issue.message;
    }
  }
}
