import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCatalogImportPlan,
  normalizeSku,
  parseCsv,
  type CatalogSheetCsv
} from "../../src/catalog-import/catalog-sheet-transform";

const csv: CatalogSheetCsv = {
  Brand: [
    "Name,Slug,Description,Logo URL,Is Active",
    "Hospi Surgical,hospi-surgical,Medical equipment brand,,TRUE"
  ].join("\n"),
  Category: [
    "Name,Slug,Description,Image URL,Sort Order,Is Active",
    "Ward Essential,ward-essential,Ward products,,2,TRUE",
    "Hospital Bed,hospital-bed,Hospital beds,,1,TRUE",
    "Unused Root,unused-root,Must be removed,,3,TRUE"
  ].join("\n"),
  Inventory: "Product SKU,Warehouse Code,Quantity",
  Products: [
    "Name,SKU,Brand,Category,Subcategory,Short Description,Description,Search Tags,Material,Pack Size,Medical Specialty,Meta Description",
    'Ward Essential," hsd 127 ",Hospi Surgical,Ward Essential,Linen & Bags,,"Square shape Canvas bag, removable.",ward,,1 bag,Ward,',
    'Emergency & Recovery Trolley,HSD-135(E),Hospi Surgical,Hospital Bed,Emergency Trolley,Electric trolley,"Electric recovery trolley\nwith controls",recovery,Steel,1 trolley,Emergency,'
  ].join("\n"),
  Warehourse: [
    "Name,Code,Address,City,State,Pincode,Contact Person,Contact Number,Latitude,Longitude",
    'HospiSurgical Division Dehraund,1,"Khasra No. 1214 KH, Gali no 3",Dehradun,Uttarakhand,248001,Nitin Verma,79063 38894,,'
  ].join("\n")
};

test("CSV parser preserves quoted commas and line breaks", () => {
  assert.deepEqual(parseCsv('a,b\n"x,y","line 1\nline 2"'), [
    ["a", "b"],
    ["x,y", "line 1\nline 2"]
  ]);
});

test("catalog plan keeps only used roots and builds child categories", () => {
  const plan = buildCatalogImportPlan(csv);
  const roots = plan.categories.filter((category) => category.parentSlug === null);
  const children = plan.categories.filter((category) => category.parentSlug !== null);

  assert.deepEqual(
    roots.map((category) => category.name),
    ["Ward Essential", "Hospital Bed"]
  );
  assert.equal(
    plan.categories.some((category) => category.name === "Unused Root"),
    false
  );
  assert.deepEqual(
    children.map((category) => [category.name, category.parentSlug]),
    [
      ["Linen & Bags", "ward-essential"],
      ["Emergency Trolley", "hospital-bed"]
    ]
  );
});

test("catalog plan applies requested product and inventory defaults", () => {
  const plan = buildCatalogImportPlan(csv);
  const hamperBag = plan.products[0];
  const trolley = plan.products[1];

  assert.ok(hamperBag);
  assert.ok(trolley);
  assert.equal(hamperBag.name, "Hamper Bag");
  assert.equal(hamperBag.sku, "HSD-127");
  assert.equal(hamperBag.slug, "hamper-bag");
  assert.equal(trolley.name, "Emergency & Recovery Trolley - Electric");
  assert.equal(trolley.slug, "emergency-recovery-trolley-electric");
  assert.equal(
    trolley.description,
    "<p>Electric recovery trolley<br>with controls</p>"
  );

  for (const product of plan.products) {
    assert.equal(product.taxRate, 18);
    assert.equal(product.unit, "");
    assert.ok(product.basePrice > 0);
    assert.ok(product.sellingPrice >= product.basePrice);
    assert.ok(product.mrp >= product.sellingPrice);
    assert.ok(product.shortDescription.length > 0);
  }

  assert.equal(plan.inventory.length, plan.products.length);
  assert.equal(
    plan.inventory.every((row) => row.warehouseCode === "1"),
    true
  );
  assert.equal(
    plan.inventory.every((row) => row.quantity >= 5 && row.quantity <= 50),
    true
  );
  assert.equal(plan.warehouses[0]?.contactNumber, "79063 38894");
});

test("SKU normalization is deterministic and admin-compatible", () => {
  assert.equal(normalizeSku(" hsd 144 (a) "), "HSD-144-A");
  assert.match(normalizeSku("HSD/200 test"), /^[A-Z0-9][A-Z0-9._-]*$/);
});
