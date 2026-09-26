import { describe, expect, it } from "vitest";
import {
  catalogBulkCreateRowHasContent,
  createCatalogBulkCreateRow,
  createCatalogBulkRowsFromNames,
  validateCatalogBulkCreateRows
} from "./catalog-bulk-create";

describe("catalog bulk creation", () => {
  it("turns pasted names into rows with generated slugs and sort order", () => {
    const rows = createCatalogBulkRowsFromNames(
      " Surgical Instruments \n\nImplants\nDiagnostics ",
      { sortOrderStart: 4 }
    );

    expect(rows.map(({ name, slug, sortOrder }) => ({ name, slug, sortOrder }))).toEqual([
      {
        name: "Surgical Instruments",
        slug: "surgical-instruments",
        sortOrder: "4"
      },
      { name: "Implants", slug: "implants", sortOrder: "5" },
      { name: "Diagnostics", slug: "diagnostics", sortOrder: "6" }
    ]);
  });

  it("builds valid category payloads and ignores untouched blank rows", () => {
    const blankRow = createCatalogBulkCreateRow();
    const categoryRow = createCatalogBulkCreateRow({
      name: "Forceps",
      parentId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      slug: "forceps",
      sortOrder: "8"
    });
    const validation = validateCatalogBulkCreateRows(
      [blankRow, categoryRow],
      "category"
    );

    expect(catalogBulkCreateRowHasContent(blankRow)).toBe(false);
    expect(validation.candidateCount).toBe(1);
    expect(validation.errors).toEqual({});
    expect(validation.validRows[0]?.payload).toMatchObject({
      name: "Forceps",
      parentId: "7d9f8f33-d348-4a89-94e8-907be76a91c6",
      slug: "forceps",
      sortOrder: 8
    });
  });

  it("blocks existing, repeated, and invalid slugs before requests begin", () => {
    const existing = createCatalogBulkCreateRow({
      name: "Acme",
      slug: "acme"
    });
    const repeatedOne = createCatalogBulkCreateRow({
      name: "First",
      slug: "repeated"
    });
    const repeatedTwo = createCatalogBulkCreateRow({
      name: "Second",
      slug: "repeated"
    });
    const invalid = createCatalogBulkCreateRow({
      name: "Invalid",
      slug: "Invalid Slug"
    });
    const validation = validateCatalogBulkCreateRows(
      [existing, repeatedOne, repeatedTwo, invalid],
      "brand",
      ["acme"]
    );

    expect(validation.validRows).toEqual([]);
    expect(validation.errors[existing.id]?.slug).toBe("This slug already exists.");
    expect(validation.errors[repeatedOne.id]?.slug).toBe(
      "This slug is repeated in the batch."
    );
    expect(validation.errors[repeatedTwo.id]?.slug).toBe(
      "This slug is repeated in the batch."
    );
    expect(validation.errors[invalid.id]?.slug).toContain("lowercase letters");
  });
});
