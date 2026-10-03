import { z } from "zod";
import type { QueryParams } from "./admin-api";

export const INVENTORY_OVERVIEW_PATH = "/inventory";
export const INVENTORY_ACTIONS_PATH = "/inventory/actions";
export const INVENTORY_MOVEMENTS_PATH = "/inventory/movements";

export const INVENTORY_TABS = [
  {
    href: INVENTORY_OVERVIEW_PATH,
    label: "Overview",
    value: "overview"
  },
  {
    href: INVENTORY_ACTIONS_PATH,
    label: "Stock actions",
    value: "actions"
  },
  {
    href: INVENTORY_MOVEMENTS_PATH,
    label: "Movements",
    value: "movements"
  }
] as const;

export type InventoryView = (typeof INVENTORY_TABS)[number]["value"];

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER",
  "RETURN"
] as const;

export const RETURN_STOCK_DISPOSITIONS = ["RESTOCK", "QUARANTINE", "SCRAP"] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export type ReturnStockDisposition = (typeof RETURN_STOCK_DISPOSITIONS)[number];

export type InventoryFilters = {
  lowStock: boolean;
  movementType: "" | StockMovementType;
  nearExpiry: boolean;
  nearExpiryDays: string;
  productId: string;
  search: string;
  warehouseId: string;
};

export type InventoryRequestType = "batch" | "stock";

export type InventoryListRequest = {
  endpoint: string;
  query: QueryParams;
  type: InventoryRequestType;
};

export type InventoryStockProduct = {
  id: string;
  name: string;
  sku: string;
  status: string;
};

export type InventoryStockVariant = {
  id: string;
  name: string;
  sku: string;
};

export type InventoryStock = {
  availableQuantity: number;
  id: string;
  lowStockThreshold: number;
  // Stock list endpoints name the product; stock mutation responses do not.
  product?: InventoryStockProduct;
  productId: string;
  reservedQuantity: number;
  variant?: InventoryStockVariant | null;
  variantId: string | null;
  warehouseId: string;
};

export type InventoryStockLevel = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type StockBatch = {
  batchNumber: string;
  expiryDate: Date | string | null;
  id: string;
  mrp: number;
  productId: string;
  purchasePrice: number;
  quantity: number;
  sellingPrice: number;
  variantId: string | null;
  warehouseId: string;
};

export type StockMovement = {
  createdAt: Date | string;
  id: string;
  notes: string | null;
  productId: string;
  quantity: number;
  referenceId: string | null;
  referenceType: string | null;
  type: StockMovementType;
  variantId: string | null;
  warehouseId: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

const uuidField = (label: string) =>
  z.string().trim().uuid(`Select a valid ${label.toLowerCase()}.`);

const optionalUuidField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || z.string().uuid().safeParse(value).success, {
      message: `Select a valid ${label.toLowerCase()}.`
    });

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} is too long.`);

const optionalText = (label: string, maxLength: number) =>
  z.string().trim().max(maxLength, `${label} is too long.`);

const amountString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
      message: `Enter a valid ${label.toLowerCase()}.`
    });

const positiveIntegerString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => /^[1-9]\d*$/.test(value), {
      message: `${label} must be a positive whole number.`
    });

const optionalWholeNumberString = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: `${label} must be a whole number.`
    });

const signedIntegerString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => /^-?\d+$/.test(value), {
      message: `${label} must be a whole number.`
    })
    .refine((value) => Number(value) !== 0, {
      message: `${label} cannot be zero.`
    });

export const inventoryFiltersSchema = z.object({
  lowStock: z.boolean(),
  movementType: z.union([z.literal(""), z.enum(STOCK_MOVEMENT_TYPES)]),
  nearExpiry: z.boolean(),
  nearExpiryDays: z
    .string()
    .trim()
    .refine(
      (value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 365,
      "Expiry window must be a whole number between 1 and 365 days."
    ),
  productId: z.string().trim(),
  search: z.string().trim().max(160, "Search is too long."),
  warehouseId: z.string().trim()
});

export const stockInFormSchema = z.object({
  batchNumber: requiredText("Batch number", 120),
  expiryDate: z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      message: "Expiry date must be valid."
    }),
  lowStockThreshold: optionalWholeNumberString("Low-stock threshold"),
  mrp: amountString("MRP"),
  notes: optionalText("Notes", 1000).optional().default(""),
  productId: uuidField("Product"),
  purchasePrice: amountString("Purchase price"),
  quantity: positiveIntegerString("Quantity"),
  sellingPrice: amountString("Selling price"),
  variantId: optionalUuidField("Variant"),
  warehouseId: uuidField("Warehouse")
});

export const adjustStockFormSchema = z.object({
  batchNumber: requiredText("Batch number", 120),
  lowStockThreshold: optionalWholeNumberString("Low-stock threshold"),
  productId: uuidField("Product"),
  quantityDelta: signedIntegerString("Quantity delta"),
  reason: requiredText("Reason", 1000),
  variantId: optionalUuidField("Variant"),
  warehouseId: uuidField("Warehouse")
});

export const transferStockFormSchema = z
  .object({
    batchNumber: requiredText("Batch number", 120),
    fromWarehouseId: uuidField("Source warehouse"),
    notes: optionalText("Notes", 1000),
    productId: uuidField("Product"),
    quantity: positiveIntegerString("Quantity"),
    toWarehouseId: uuidField("Destination warehouse"),
    variantId: optionalUuidField("Variant")
  })
  .refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
    message: "Source and destination warehouses must differ.",
    path: ["toWarehouseId"]
  });

export const returnDispositionFormSchema = z.object({
  disposition: z.enum(RETURN_STOCK_DISPOSITIONS),
  note: optionalText("Note", 1000).optional().default(""),
  orderId: uuidField("Order"),
  orderItemId: uuidField("Order item"),
  quantity: positiveIntegerString("Quantity")
});

export type InventoryFilterValues = z.infer<typeof inventoryFiltersSchema>;
export type StockInFormValues = z.infer<typeof stockInFormSchema>;
export type AdjustStockFormValues = z.infer<typeof adjustStockFormSchema>;
export type TransferStockFormValues = z.infer<typeof transferStockFormSchema>;
export type ReturnDispositionFormValues = z.infer<typeof returnDispositionFormSchema>;

export function createEmptyInventoryFilters(): InventoryFilters {
  return {
    lowStock: false,
    movementType: "",
    nearExpiry: false,
    nearExpiryDays: "30",
    productId: "",
    search: "",
    warehouseId: ""
  };
}

export function createEmptyStockInFormValues() {
  return {
    batchNumber: "",
    expiryDate: "",
    lowStockThreshold: "0",
    mrp: "",
    notes: "",
    productId: "",
    purchasePrice: "",
    quantity: "",
    sellingPrice: "",
    variantId: "",
    warehouseId: ""
  };
}

export function createInventoryFiltersFromSearchParams(searchParams: {
  get: (key: string) => string | null;
}): InventoryFilters {
  const days = inventoryFiltersSchema.shape.nearExpiryDays.safeParse(
    searchParams.get("nearExpiryDays") ?? "30"
  );
  const nearExpiry = searchParams.get("nearExpiry") === "true";

  return {
    lowStock: !nearExpiry && searchParams.get("lowStock") === "true",
    movementType:
      z.enum(STOCK_MOVEMENT_TYPES).safeParse(searchParams.get("movementType")).data ??
      "",
    nearExpiry,
    nearExpiryDays: days.success ? days.data : "30",
    productId: searchParams.get("productId") ?? "",
    search: searchParams.get("search") ?? "",
    warehouseId: searchParams.get("warehouseId") ?? ""
  };
}

export function createEmptyAdjustStockFormValues() {
  return {
    batchNumber: "",
    lowStockThreshold: "",
    productId: "",
    quantityDelta: "",
    reason: "",
    variantId: "",
    warehouseId: ""
  };
}

export function createEmptyTransferStockFormValues() {
  return {
    batchNumber: "",
    fromWarehouseId: "",
    notes: "",
    productId: "",
    quantity: "",
    toWarehouseId: "",
    variantId: ""
  };
}

export function createEmptyReturnDispositionFormValues(
  orderId = "",
  orderItemId = ""
): ReturnDispositionFormValues {
  return {
    disposition: "RESTOCK",
    note: "",
    orderId,
    orderItemId,
    quantity: "1"
  };
}

export function buildInventoryRequest(
  filters: InventoryFilters,
  options: { days?: number; limit?: number; page?: number } = {}
): InventoryListRequest {
  const query: QueryParams = {
    limit: options.limit ?? 100,
    page: options.page,
    productId: filters.productId || undefined,
    search: filters.search || undefined,
    warehouseId: filters.warehouseId || undefined
  };

  if (filters.nearExpiry) {
    return {
      endpoint: "/admin/inventory/near-expiry",
      query: {
        ...query,
        days: options.days ?? Number(filters.nearExpiryDays)
      },
      type: "batch"
    };
  }

  return {
    endpoint: filters.lowStock ? "/admin/inventory/low-stock" : "/admin/inventory",
    query,
    type: "stock"
  };
}

export function buildStockMovementQuery(
  filters: InventoryFilters,
  page = 1,
  limit = 20
): QueryParams {
  return {
    ...buildInventoryRequest(
      {
        ...filters,
        lowStock: false,
        nearExpiry: false
      },
      { limit, page }
    ).query,
    type: filters.movementType || undefined
  };
}

export async function loadAllPaginatedItems<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>
) {
  const first = await fetchPage(1);
  const items = [...first.items];
  let currentPage = first.pagination.page;
  let hasNextPage = first.pagination.hasNextPage;

  while (hasNextPage) {
    const next = await fetchPage(currentPage + 1);
    items.push(...next.items);
    currentPage = next.pagination.page;
    hasNextPage = next.pagination.hasNextPage;
  }

  return items;
}

export function buildStockInPayload(values: StockInFormValues) {
  return {
    batchNumber: values.batchNumber.trim(),
    expiryDate: blankToNull(values.expiryDate),
    lowStockThreshold:
      values.lowStockThreshold === "" ? undefined : Number(values.lowStockThreshold),
    mrp: Number(values.mrp),
    notes: blankToUndefined(values.notes),
    productId: values.productId,
    purchasePrice: Number(values.purchasePrice),
    quantity: Number(values.quantity),
    sellingPrice: Number(values.sellingPrice),
    variantId: blankToNull(values.variantId),
    warehouseId: values.warehouseId
  };
}

export function buildAdjustStockPayload(values: AdjustStockFormValues) {
  return {
    batchNumber: values.batchNumber.trim(),
    lowStockThreshold:
      values.lowStockThreshold === "" ? undefined : Number(values.lowStockThreshold),
    productId: values.productId,
    quantityDelta: Number(values.quantityDelta),
    reason: values.reason.trim(),
    variantId: blankToNull(values.variantId),
    warehouseId: values.warehouseId
  };
}

export function buildTransferStockPayload(values: TransferStockFormValues) {
  return {
    batchNumber: values.batchNumber.trim(),
    fromWarehouseId: values.fromWarehouseId,
    notes: blankToUndefined(values.notes),
    productId: values.productId,
    quantity: Number(values.quantity),
    toWarehouseId: values.toWarehouseId,
    variantId: blankToNull(values.variantId)
  };
}

export function buildReturnDispositionPayload(values: ReturnDispositionFormValues) {
  return {
    items: [
      {
        disposition: values.disposition,
        note: blankToUndefined(values.note),
        orderItemId: values.orderItemId,
        quantity: Number(values.quantity)
      }
    ],
    orderId: values.orderId
  };
}

export function isLowStock(
  stock: Pick<InventoryStock, "availableQuantity" | "lowStockThreshold">
) {
  return stock.availableQuantity <= stock.lowStockThreshold;
}

export function getStockLevel(
  stock: Pick<InventoryStock, "availableQuantity" | "lowStockThreshold">
): InventoryStockLevel {
  if (stock.availableQuantity <= 0) {
    return "OUT_OF_STOCK";
  }

  return isLowStock(stock) ? "LOW_STOCK" : "IN_STOCK";
}

export function isNearExpiry(
  expiryDate: Date | string | null,
  now = new Date(),
  windowDays = 30
) {
  if (!expiryDate) {
    return false;
  }

  const expiryTime = new Date(expiryDate).getTime();

  if (Number.isNaN(expiryTime)) {
    return false;
  }

  const nowTime = now.getTime();
  const cutoff = nowTime + windowDays * 24 * 60 * 60 * 1000;

  return expiryTime >= nowTime && expiryTime <= cutoff;
}

export function formatMovementType(type: StockMovementType | string) {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function blankToUndefined(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
}
