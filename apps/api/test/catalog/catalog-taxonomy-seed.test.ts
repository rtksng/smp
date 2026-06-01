import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATALOG_BRANDS,
  CATALOG_CATEGORY_TREE,
  flattenSeedCatalogCategories,
  getSeedCatalogBrandSlugs,
  getSeedCatalogCategorySlugs
} from "../../prisma/seed";

test("catalog seed contains the fixed category and subcategory structure", () => {
  assert.deepEqual(
    CATALOG_CATEGORY_TREE.map((category) => category.name),
    [
      "Dental",
      "Diagnostics",
      "Consumables",
      "Equipment",
      "Orthopedics",
      "Ophthalmology",
      "Nephrology",
      "Pharma",
      "Cardiology",
      "Physiotherapy",
      "Vaccines",
      "IVF/Gynae"
    ]
  );

  const dental = CATALOG_CATEGORY_TREE.find((category) => category.name === "Dental");
  const vaccines = CATALOG_CATEGORY_TREE.find(
    (category) => category.name === "Vaccines"
  );

  assert.deepEqual(
    dental?.subcategories.map((subcategory) => subcategory.name),
    [
      "Endodontics",
      "Restoratives",
      "Impression Materials",
      "Small Equipment",
      "Consumables",
      "Crown & Bridge",
      "Orthodontics"
    ]
  );
  assert.deepEqual(vaccines?.subcategories, []);

  const flattened = flattenSeedCatalogCategories(CATALOG_CATEGORY_TREE);
  assert.equal(flattened.length, 88);
  assert.equal(
    flattened.find((entry) => entry.name === "Endodontics")?.parentSlug,
    "dental"
  );
  assert.deepEqual(getSeedCatalogCategorySlugs(), flattened.map((entry) => entry.slug));
  assert.equal(getSeedCatalogCategorySlugs().includes("surgical-gloves"), false);
});

test("catalog seed contains the fixed brand list", () => {
  assert.deepEqual(
    CATALOG_BRANDS.map((brand) => brand.name),
    ["Mb+", "Abbott", "Contec", "Volk", "Orikam", "Healthium", "GC", "J.Mitra"]
  );
  assert.deepEqual(getSeedCatalogBrandSlugs(), [
    "mb-plus",
    "abbott",
    "contec",
    "volk",
    "orikam",
    "healthium",
    "gc",
    "j-mitra"
  ]);
});
