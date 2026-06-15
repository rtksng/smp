import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  buildCatalogProductDefinitions,
  buildProductImageGallery,
  buildProductPayload,
  flattenCategories,
  productLeafCategories,
  skuFromName
} = require("./seed-demo-catalog.cjs");

const brands = [
  { id: "brand-mb", name: "Mb+", slug: "mb-plus" },
  { id: "brand-healthium", name: "Healthium", slug: "healthium" },
  { id: "brand-contec", name: "Contec", slug: "contec" }
];

const categories = [
  {
    children: [
      {
        children: [],
        id: "critical-care",
        name: "Critical Care",
        parentId: "equipment",
        slug: "critical-care"
      },
      {
        children: [],
        id: "hospital-furniture",
        name: "Hospital Furniture",
        parentId: "equipment",
        slug: "hospital-furniture"
      }
    ],
    id: "equipment",
    name: "Equipment",
    parentId: null,
    slug: "equipment"
  },
  {
    children: [],
    id: "vaccines",
    name: "Vaccines",
    parentId: null,
    slug: "vaccines"
  }
];

test("demo catalog generator expands to 200 products across leaf categories", () => {
  const products = buildCatalogProductDefinitions(categories, brands, {
    targetCount: 200
  });
  const leaves = productLeafCategories(categories);
  const categoriesBySlug = new Map(
    flattenCategories(categories).map((category) => [category.slug, category])
  );
  const brandsBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const generatedPayloads = products.slice(36).map((product, index) =>
    buildProductPayload(
      product,
      [
        `https://cdn.example.com/products/${index}-main.png`,
        `https://cdn.example.com/products/${index}-spec.png`,
        `https://cdn.example.com/products/${index}-pack.png`
      ],
      brandsBySlug,
      categoriesBySlug
    )
  );
  const generatedVariantSkus = generatedPayloads.flatMap((product) =>
    product.variants.map((variant) => variant.sku)
  );

  assert.equal(products.length, 200);
  assert.equal(new Set(products.map((product) => product.name)).size, 200);
  assert.equal(new Set(products.map((product) => skuFromName(product.name))).size, 200);
  assert.equal(new Set(generatedPayloads.map((product) => product.sku)).size, 164);
  assert.equal(new Set(generatedVariantSkus).size, generatedVariantSkus.length);
  assert.equal(generatedVariantSkus.every((sku) => sku.length <= 80), true);
  for (const leaf of leaves) {
    assert.equal(
      products.some((product) =>
        leaf.parentId ? product.subcategory === leaf.slug : product.category === leaf.slug
      ),
      true,
      `${leaf.slug} should receive at least one generated product`
    );
  }
  assert.equal(products.every((product) => product.variants.length >= 2), true);
});

test("demo catalog product payload includes gallery images, variants, and documents", () => {
  const products = buildCatalogProductDefinitions(categories, brands, {
    targetCount: 40
  });
  const categoriesBySlug = new Map(
    flattenCategories(categories).map((category) => [category.slug, category])
  );
  const brandsBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const generated = products.find((product) => product.subcategory === "critical-care");

  assert.ok(generated);

  const galleryUrls = [
    "https://cdn.example.com/products/generated-main.png",
    "https://cdn.example.com/products/generated-spec.png",
    "https://cdn.example.com/products/generated-pack.png"
  ];
  const payload = buildProductPayload(
    generated,
    galleryUrls,
    brandsBySlug,
    categoriesBySlug
  );

  assert.equal(payload.brandId.length > 0, true);
  assert.equal(payload.categoryId, "equipment");
  assert.equal(payload.subcategoryId, "critical-care");
  assert.equal(payload.images.length, 3);
  assert.equal(payload.images.filter((image) => image.isPrimary).length, 1);
  assert.deepEqual(payload.images.map((image) => image.url), galleryUrls);
  assert.equal(new Set(payload.images.map((image) => image.url.split("?")[0])).size, 3);
  assert.deepEqual(
    payload.documents.map((document) => document.type).sort(),
    ["CERTIFICATE", "COMPLIANCE", "MANUAL", "WARRANTY"]
  );
  assert.equal(payload.variants.length >= 2, true);
  assert.equal(payload.searchTags.includes("critical-care"), true);
});

test("demo catalog gallery rejects query-string variants of the same image", () => {
  const [generated] = buildCatalogProductDefinitions(categories, brands, {
    targetCount: 40
  });

  assert.throws(
    () =>
      buildProductImageGallery(generated, [
        "https://cdn.example.com/products/generated.png",
        "https://cdn.example.com/products/generated.png?view=specification",
        "https://cdn.example.com/products/generated.png?view=package"
      ]),
    /distinct gallery image URLs/
  );
});
