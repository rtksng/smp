export const DEFAULT_CATALOG_SHEET_ID = "1gStz1qxrWjzao134Wh3mFlaKTO2IqtRmYty9t452cB8";

export const CATALOG_SHEET_NAMES = [
  "Products",
  "Brand",
  "Category",
  "Inventory",
  "Warehourse"
] as const;

export type CatalogSheetName = (typeof CATALOG_SHEET_NAMES)[number];

export type CatalogSheetCsv = Record<CatalogSheetName, string>;

export type CatalogBrandImport = {
  description: string | null;
  isActive: boolean;
  logoUrl: null;
  name: string;
  slug: string;
};

export type CatalogCategoryImport = {
  description: string | null;
  imageUrl: null;
  isActive: boolean;
  name: string;
  parentSlug: string | null;
  slug: string;
  sortOrder: number;
};

export type CatalogWarehouseImport = {
  address: string;
  city: string;
  code: string;
  contactNumber: string;
  contactPerson: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  pincode: string;
  state: string;
};

export type CatalogProductImport = {
  basePrice: number;
  brandSlug: string;
  categorySlug: string;
  description: string;
  disposable: boolean;
  expirySensitive: boolean;
  material: string | null;
  medicalSpecialty: string | null;
  metaDescription: string;
  metaTitle: string;
  mrp: number;
  name: string;
  originalSku: string;
  packSize: string | null;
  searchTags: string[];
  sellingPrice: number;
  shortDescription: string;
  sku: string;
  slug: string;
  sterile: boolean;
  subcategorySlug: string;
  taxRate: 18;
  unit: "";
};

export type CatalogInventoryImport = {
  batchNumber: string;
  expiryDate: string | null;
  lowStockThreshold: number;
  mrp: number;
  productSku: string;
  purchasePrice: number;
  quantity: number;
  sellingPrice: number;
  warehouseCode: string;
};

export type CatalogImportPlan = {
  brands: CatalogBrandImport[];
  categories: CatalogCategoryImport[];
  inventory: CatalogInventoryImport[];
  products: CatalogProductImport[];
  warehouses: CatalogWarehouseImport[];
};

type SheetRecord = Record<string, string>;

const PRODUCT_NAME_FIXES: Record<string, string> = {
  "HSD-127": "Hamper Bag",
  "HSD-135": "Emergency & Recovery Trolley - Hydraulic",
  "HSD-135(E)": "Emergency & Recovery Trolley - Electric",
  "HSD-144(A)": "LED X-Ray Viewer - Single Panel",
  "HSD-144(B)": "LED X-Ray Viewer - Double Panel",
  "HSD-144(C)": "LED X-Ray Viewer - Triple Panel",
  "HSD-163": "Ward Essential Accessory - HSD-163"
};

const PRICE_BANDS: Record<string, { minimum: number; span: number }> = {
  Furniture: { minimum: 12_000, span: 68_000 },
  "Hospital Bed": { minimum: 35_000, span: 215_000 },
  "LED Examination Light": { minimum: 22_000, span: 58_000 },
  "Operating Chair": { minimum: 65_000, span: 95_000 },
  "Surgical LED Operating Lights": { minimum: 75_000, span: 375_000 },
  "Surgical Operating Tables": { minimum: 110_000, span: 490_000 },
  "Ward Essential": { minimum: 2_500, span: 97_500 }
};

export class CatalogImportValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Catalog sheet validation failed:\n- ${issues.join("\n- ")}`);
    this.name = "CatalogImportValidationError";
  }
}

export function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }

      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function buildCatalogImportPlan(csv: CatalogSheetCsv): CatalogImportPlan {
  const productsSource = recordsFromCsv(csv.Products, ["Name", "SKU", "Brand"]);
  const brandsSource = recordsFromCsv(csv.Brand, ["Name", "Is Active"]);
  const categoriesSource = recordsFromCsv(csv.Category, ["Name", "Sort Order"]);
  const warehousesSource = recordsFromCsv(csv.Warehourse, ["Name", "Code"]);
  const issues: string[] = [];

  if (productsSource.length === 0) {
    issues.push("Products tab has no product rows.");
  }
  if (brandsSource.length === 0) {
    issues.push("Brand tab has no brand rows.");
  }
  if (categoriesSource.length === 0) {
    issues.push("Category tab has no category rows.");
  }
  if (warehousesSource.length !== 1) {
    issues.push(
      `Warehourse tab must contain exactly one warehouse row; found ${warehousesSource.length}.`
    );
  }

  const brandByName = new Map(
    brandsSource.map((row) => [normalizeWhitespace(row.Name).toLowerCase(), row])
  );
  const categoryByName = new Map(
    categoriesSource.map((row) => [normalizeWhitespace(row.Name).toLowerCase(), row])
  );
  const usedRootCategoryNames = unique(
    productsSource.map((row) => normalizeWhitespace(row.Category)).filter(Boolean)
  );
  const usedBrandNames = unique(
    productsSource.map((row) => normalizeWhitespace(row.Brand)).filter(Boolean)
  );

  for (const brandName of usedBrandNames) {
    if (!brandByName.has(brandName.toLowerCase())) {
      issues.push(`Product brand is missing from Brand tab: ${brandName}.`);
    }
  }
  for (const categoryName of usedRootCategoryNames) {
    if (!categoryByName.has(categoryName.toLowerCase())) {
      issues.push(`Product category is missing from Category tab: ${categoryName}.`);
    }
  }

  const brands: CatalogBrandImport[] = usedBrandNames.map((name) => {
    const source = brandByName.get(name.toLowerCase());

    return {
      description: blankToNull(source?.Description ?? ""),
      isActive: parseBooleanCell(source?.["Is Active"] ?? ""),
      logoUrl: null,
      name,
      slug: slugify(name)
    };
  });

  const rootCategories: CatalogCategoryImport[] = usedRootCategoryNames.map(
    (name, index) => {
      const source = categoryByName.get(name.toLowerCase());
      const sourceSortOrder = Number(source?.["Sort Order"] ?? "");

      return {
        description: blankToNull(source?.Description ?? ""),
        imageUrl: null,
        isActive: parseBooleanCell(source?.["Is Active"] ?? ""),
        name,
        parentSlug: null,
        slug: slugify(name),
        sortOrder: Number.isInteger(sourceSortOrder) ? sourceSortOrder : index + 1
      };
    }
  );
  const rootCategorySlugByName = new Map(
    rootCategories.map((category) => [category.name.toLowerCase(), category.slug])
  );
  const subcategoryKeys = unique(
    productsSource.map((row) => {
      const category = normalizeWhitespace(row.Category);
      const subcategory = normalizeWhitespace(row.Subcategory);

      return `${category}\u0000${subcategory}`;
    })
  );
  const subcategorySortByRoot = new Map<string, number>();
  const subcategories: CatalogCategoryImport[] = subcategoryKeys.map((key) => {
    const [rootName = "", subcategoryName = ""] = key.split("\u0000");
    const rootSlug =
      rootCategorySlugByName.get(rootName.toLowerCase()) ?? slugify(rootName);
    const nextSortOrder = (subcategorySortByRoot.get(rootSlug) ?? 0) + 1;

    subcategorySortByRoot.set(rootSlug, nextSortOrder);
    if (!subcategoryName) {
      issues.push(
        `A product under ${rootName || "an unknown category"} has no subcategory.`
      );
    }

    return {
      description: `${subcategoryName} products under ${rootName}.`,
      imageUrl: null,
      isActive: true,
      name: subcategoryName,
      parentSlug: rootSlug,
      slug: `${rootSlug}-${slugify(subcategoryName)}`,
      sortOrder: nextSortOrder
    };
  });
  const subcategorySlugByKey = new Map(
    subcategories.map((category) => [
      `${category.parentSlug}\u0000${category.name.toLowerCase()}`,
      category.slug
    ])
  );

  const products: CatalogProductImport[] = productsSource.map((row, index) => {
    const originalName = normalizeWhitespace(row.Name);
    const originalSku = normalizeWhitespace(row.SKU);
    const sku = normalizeSku(originalSku);
    const name =
      PRODUCT_NAME_FIXES[originalSku] ?? PRODUCT_NAME_FIXES[sku] ?? originalName;
    const categoryName = normalizeWhitespace(row.Category);
    const categorySlug = rootCategorySlugByName.get(categoryName.toLowerCase()) ?? "";
    const subcategoryName = normalizeWhitespace(row.Subcategory);
    const subcategorySlug =
      subcategorySlugByKey.get(
        `${categorySlug}\u0000${subcategoryName.toLowerCase()}`
      ) ?? "";
    const brandName = normalizeWhitespace(row.Brand);
    const brandSlug = slugify(brandName);
    const price = createDeterministicPrice(categoryName, sku, index);
    const seed = hash32(`${sku}:${name}`);
    const sourceDescription = normalizeMultiline(row.Description);
    const fallbackDescription = `${name} is a medical equipment product from ${brandName}, intended for professional hospitals, clinics and institutional healthcare use. Final dimensions and technical configuration should be confirmed before ordering.`;
    const descriptionText = sourceDescription || fallbackDescription;
    const sourceShortDescription = normalizeWhitespace(row["Short Description"]);
    const shortDescription =
      !sourceShortDescription ||
      (name !== originalName &&
        sourceShortDescription.toLowerCase() === originalName.toLowerCase())
        ? `${name} for professional hospital, clinic and institutional healthcare use.`
        : sourceShortDescription;
    const searchTags = buildSearchTags(
      row["Search Tags"],
      name,
      sku,
      categoryName,
      subcategoryName,
      brandName
    );

    if (!name) {
      issues.push(`Product row ${index + 1} has no name.`);
    }
    if (!originalSku) {
      issues.push(`Product ${name || `row ${index + 1}`} has no SKU.`);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) {
      issues.push(`Normalized SKU is invalid for ${name}: ${sku}.`);
    }
    if (!brandSlug || !brandByName.has(brandName.toLowerCase())) {
      issues.push(`Brand mapping failed for ${name}: ${brandName || "blank"}.`);
    }
    if (!categorySlug) {
      issues.push(`Category mapping failed for ${name}: ${categoryName || "blank"}.`);
    }
    if (!subcategorySlug) {
      issues.push(
        `Subcategory mapping failed for ${name}: ${subcategoryName || "blank"}.`
      );
    }

    return {
      basePrice: price.basePrice,
      brandSlug,
      categorySlug,
      description: descriptionToHtml(descriptionText),
      disposable: seed % 11 === 0,
      expirySensitive: seed % 13 === 0,
      material: blankToNull(row.Material),
      medicalSpecialty: blankToNull(row["Medical Specialty"]),
      metaDescription: truncate(
        normalizeWhitespace(row["Meta Description"]) || shortDescription,
        320
      ),
      metaTitle: truncate(`${name} | ${brandName}`, 160),
      mrp: price.mrp,
      name,
      originalSku,
      packSize: blankToNull(row["Pack Size"]),
      searchTags,
      sellingPrice: price.sellingPrice,
      shortDescription: truncate(shortDescription, 500),
      sku,
      slug: slugify(name),
      sterile: seed % 5 === 0,
      subcategorySlug,
      taxRate: 18,
      unit: ""
    };
  });

  validateUnique(products, "sku", issues);
  validateUnique(products, "slug", issues);
  validateUnique(brands, "slug", issues);
  validateUnique([...rootCategories, ...subcategories], "slug", issues);

  const warehouses: CatalogWarehouseImport[] = warehousesSource.map((row, index) => {
    const warehouse = {
      address: normalizeWhitespace(row.Address),
      city: normalizeWhitespace(row.City),
      code: normalizeWhitespace(row.Code),
      contactNumber: normalizeWhitespace(row["Contact Number"]),
      contactPerson: normalizeWhitespace(row["Contact Person"]),
      latitude: optionalCoordinate(row.Latitude, -90, 90, "latitude", issues),
      longitude: optionalCoordinate(row.Longitude, -180, 180, "longitude", issues),
      name: normalizeWhitespace(row.Name),
      pincode: normalizeWhitespace(row.Pincode),
      state: normalizeWhitespace(row.State)
    };

    for (const [field, value] of Object.entries(warehouse)) {
      if (
        !["latitude", "longitude"].includes(field) &&
        typeof value === "string" &&
        !value
      ) {
        issues.push(`Warehouse row ${index + 1} is missing ${field}.`);
      }
    }

    return warehouse;
  });
  const warehouseCode = warehouses[0]?.code ?? "";
  const inventory: CatalogInventoryImport[] = products.map((product) => {
    const seed = hash32(`${product.sku}:inventory`);
    const quantity = 5 + (seed % 46);

    return {
      batchNumber: truncate(`OPENING-${product.sku}`, 120),
      expiryDate: product.expirySensitive ? "2028-12-31T00:00:00.000Z" : null,
      lowStockThreshold: Math.max(2, Math.floor(quantity * 0.2)),
      mrp: product.mrp,
      productSku: product.sku,
      purchasePrice: product.basePrice,
      quantity,
      sellingPrice: product.sellingPrice,
      warehouseCode
    };
  });

  if (issues.length > 0) {
    throw new CatalogImportValidationError(unique(issues));
  }

  return {
    brands,
    categories: [...rootCategories, ...subcategories],
    inventory,
    products,
    warehouses
  };
}

export function normalizeSku(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function recordsFromCsv(csv: string, requiredHeaders: string[]): SheetRecord[] {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) =>
    requiredHeaders.every((header) => row.includes(header))
  );

  if (headerIndex < 0) {
    return [];
  }

  const headers = rows[headerIndex]?.map((header) => header.trim()) ?? [];

  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index]?.trim() ?? ""])
      )
    );
}

function createDeterministicPrice(category: string, sku: string, index: number) {
  const band = PRICE_BANDS[category] ?? { minimum: 5_000, span: 95_000 };
  const steps = Math.floor(band.span / 500) + 1;
  const basePrice =
    band.minimum + ((hash32(`${category}:${sku}`) + index) % steps) * 500;
  const sellingPrice = roundUp(basePrice * 1.22, 100);
  const mrp = roundUp(sellingPrice * 1.18, 100);

  return {
    basePrice,
    mrp,
    sellingPrice
  };
}

function buildSearchTags(source: string | undefined, ...values: string[]) {
  const tags = [
    ...(source ?? "").split(/[\n,]/),
    ...values.flatMap((value) => value.split(/\s+/))
  ]
    .map((tag) => normalizeWhitespace(tag).toLowerCase())
    .filter(Boolean);

  return unique(tags);
}

function descriptionToHtml(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .map(escapeHtml);

  return `<p>${lines.join("<br>")}</p>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWhitespace(value: string | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeMultiline(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n");
}

function blankToNull(value: string | undefined) {
  const normalized = normalizeWhitespace(value);

  return normalized || null;
}

function parseBooleanCell(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();

  return !["", "0", "false", "no", "n", "inactive", "✘"].includes(normalized);
}

function optionalCoordinate(
  value: string | undefined,
  minimum: number,
  maximum: number,
  label: string,
  issues: string[]
) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    issues.push(`Warehouse ${label} is invalid: ${value ?? ""}.`);
    return null;
  }

  return number;
}

function validateUnique<T extends Record<string, unknown>>(
  values: T[],
  field: keyof T,
  issues: string[]
) {
  const seen = new Map<string, number>();

  for (const value of values) {
    const key = String(value[field] ?? "").toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const [key, count] of seen) {
    if (!key) {
      issues.push(`Generated ${String(field)} is blank.`);
    } else if (count > 1) {
      issues.push(`Generated ${String(field)} is duplicated (${count} rows): ${key}.`);
    }
  }
}

function roundUp(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trimEnd();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function hash32(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
