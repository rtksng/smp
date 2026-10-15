import { z } from "zod";
import type { QueryParams } from "./admin-api";

export const INVENTORY_OVERVIEW_PATH = "/inventory";
export const INVENTORY_ACTIONS_PATH = "/inventory/actions";
export const INVENTORY_MOVEMENTS_PATH = "/inventory/movements";

export const INVENTORY_TABS = [
  {
    href: INVENTORY_OVERVIEW_PATH,
    label: "Stock levels",
    value: "overview"
  },
  {
    href: INVENTORY_ACTIONS_PATH,
    label: "Stock actions",
    value: "actions"
  },
  {
    href: INVENTORY_MOVEMENTS_PATH,
    label: "Movement log",
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

/**
 * Position of one stock line. Out of stock: nothing available. Low stock: some
 * available but at or below the line's threshold. In stock: above the threshold.
 */
export const INVENTORY_STOCK_STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

export const INVENTORY_STOCK_STATUS_LABELS = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock"
} as const;

export const STOCK_OUT_REASONS = [
  "DAMAGED",
  "EXPIRED",
  "INTERNAL_USE",
  "SAMPLE",
  "RETURNED_TO_SUPPLIER",
  "LOST",
  "OTHER"
] as const;

export const STOCK_OUT_REASON_LABELS: Record<(typeof STOCK_OUT_REASONS)[number], string> = {
  DAMAGED: "Damaged",
  EXPIRED: "Expired",
  INTERNAL_USE: "Internal use",
  LOST: "Lost or missing",
  OTHER: "Other",
  RETURNED_TO_SUPPLIER: "Returned to supplier",
  SAMPLE: "Sample or demo"
};

export const RETURN_DISPOSITION_LABELS: Record<(typeof RETURN_STOCK_DISPOSITIONS)[number], string> = {
  QUARANTINE: "Quarantined",
  RESTOCK: "Restocked",
  SCRAP: "Scrapped"
};

/** The four stock actions, each with one plain-language job. */
export const STOCK_ACTIONS = [
  {
    description: "Add units from a supplier delivery to a new or existing batch.",
    label: "Receive stock",
    value: "receive"
  },
  {
    description: "Take out damaged, expired, sample, or used units.",
    label: "Remove stock",
    value: "remove"
  },
  {
    description: "Set a batch to the quantity you physically counted.",
    label: "Correct a count",
    value: "count"
  },
  {
    description: "Move units from one warehouse to another.",
    label: "Transfer stock",
    value: "transfer"
  }
] as const;

/** Movement log filters; transfers appear as an inward and an outward line. */
export const MOVEMENT_FILTERS = [
  { label: "All movements", value: "" },
  { label: "Inward", value: "IN" },
  { label: "Outward", value: "OUT" },
  { label: "Count corrections", value: "ADJUSTMENT" },
  { label: "Returns", value: "RETURN" }
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export type ReturnStockDisposition = (typeof RETURN_STOCK_DISPOSITIONS)[number];
export type InventoryStockStatus = (typeof INVENTORY_STOCK_STATUSES)[number];
export type StockOutReason = (typeof STOCK_OUT_REASONS)[number];
export type StockAction = (typeof STOCK_ACTIONS)[number]["value"];

export type InventoryFilters = {
  /** Needs restock: every line at or below its threshold, low or out of stock. */
  lowStock: boolean;
  movementType: "" | StockMovementType;
  nearExpiry: boolean;
  nearExpiryDays: string;
  productId: string;
  search: string;
  /** One exact stock position; ignored while lowStock or nearExpiry is on. */
  stockStatus: "" | InventoryStockStatus;
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

export type InventoryProductRef = {
  id: string;
  name: string;
  sku: string;
};

export type InventoryWarehouseRef = {
  code: string;
  id: string;
  name: string;
};

export type InventoryStock = {
  availableQuantity: number;
  id: string;
  lowStockThreshold: number;
  // Stock list endpoints name the product and warehouse; stock mutation responses do not.
  product?: InventoryStockProduct;
  productId: string;
  reservedQuantity: number;
  stockStatus?: InventoryStockStatus;
  variant?: InventoryStockVariant | null;
  variantId: string | null;
  warehouse?: InventoryWarehouseRef;
  warehouseId: string;
};

export type InventoryStockLevel = InventoryStockStatus;

export type StockBatch = {
  batchNumber: string;
  expiryDate: Date | string | null;
  id: string;
  mrp: number;
  product?: InventoryProductRef;
  productId: string;
  purchasePrice: number;
  quantity: number;
  sellingPrice: number;
  variant?: InventoryProductRef | null;
  variantId: string | null;
  warehouse?: InventoryWarehouseRef;
  warehouseId: string;
};

export type StockMovement = {
  batchNumber?: string | null;
  createdAt: Date | string;
  createdBy?: { id: string; name: string } | null;
  id: string;
  /** Signed change to on-hand stock; older API responses leave it out. */
  netQuantity?: number;
  notes: string | null;
  product?: InventoryProductRef;
  productId: string;
  quantity: number;
  /** Stock-out reason, or the disposition chosen for a returned item. */
  reason?: string | null;
  referenceId: string | null;
  referenceType: string | null;
  type: StockMovementType;
  variant?: InventoryProductRef | null;
  variantId: string | null;
  warehouse?: InventoryWarehouseRef;
  warehouseId: string;
};

export type InventorySummary = {
  assignedProducts: number;
  availableUnits: number;
  inStockItems: number;
  lowStockItems: number;
  nearExpiryBatches: number;
  nearExpiryDays: number;
  outOfStockItems: number;
  reservedUnits: number;
  trackedItems: number;
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
  stockStatus: z.union([z.literal(""), z.enum(INVENTORY_STOCK_STATUSES)]),
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

export const stockOutFormSchema = z.object({
  batchNumber: requiredText("Batch", 120),
  notes: optionalText("Notes", 1000),
  productId: uuidField("Product"),
  quantity: positiveIntegerString("Quantity"),
  reason: z.enum(STOCK_OUT_REASONS, { message: "Choose why the stock is leaving." }),
  variantId: optionalUuidField("Variant"),
  warehouseId: uuidField("Warehouse")
});

/** A physical count; the change is worked out against the batch's current quantity. */
export const stockCountFormSchema = z.object({
  batchNumber: requiredText("Batch", 120),
  countedQuantity: z
    .string()
    .trim()
    .min(1, "Counted quantity is required.")
    .refine((value) => /^\d+$/.test(value), {
      message: "Counted quantity must be a whole number."
    }),
  lowStockThreshold: optionalWholeNumberString("Low-stock threshold"),
  productId: uuidField("Product"),
  reason: requiredText("Reason", 1000),
  variantId: optionalUuidField("Variant"),
  warehouseId: uuidField("Warehouse")
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
export type StockOutFormValues = z.infer<typeof stockOutFormSchema>;
export type StockCountFormValues = z.infer<typeof stockCountFormSchema>;
export type ReturnDispositionFormValues = z.infer<typeof returnDispositionFormSchema>;

export function createEmptyInventoryFilters(): InventoryFilters {
  return {
    lowStock: false,
    movementType: "",
    nearExpiry: false,
    nearExpiryDays: "30",
    productId: "",
    search: "",
    stockStatus: "",
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
  const lowStock = !nearExpiry && searchParams.get("lowStock") === "true";
  const stockStatus =
    z.enum(INVENTORY_STOCK_STATUSES).safeParse(searchParams.get("stockStatus")).data ?? "";

  // Only one stock view applies at a time: expiry first, then needs-restock, then one status.
  return {
    lowStock,
    movementType:
      z.enum(STOCK_MOVEMENT_TYPES).safeParse(searchParams.get("movementType")).data ??
      "",
    nearExpiry,
    nearExpiryDays: days.success ? days.data : "30",
    productId: searchParams.get("productId") ?? "",
    search: searchParams.get("search") ?? "",
    stockStatus: nearExpiry || lowStock ? "" : stockStatus,
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

  if (filters.lowStock) {
    return { endpoint: "/admin/inventory/low-stock", query, type: "stock" };
  }

  return {
    endpoint: "/admin/inventory",
    query: filters.stockStatus ? { ...query, stockStatus: filters.stockStatus } : query,
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
        nearExpiry: false,
        stockStatus: ""
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

export function buildStockOutPayload(values: StockOutFormValues) {
  return {
    batchNumber: values.batchNumber.trim(),
    notes: blankToUndefined(values.notes),
    productId: values.productId,
    quantity: Number(values.quantity),
    reason: values.reason,
    variantId: blankToNull(values.variantId),
    warehouseId: values.warehouseId
  };
}

/**
 * Turns a physical count into the signed adjustment the API records, or null when
 * the count already matches the batch.
 */
export function buildStockCountPayload(values: StockCountFormValues, batchQuantity: number) {
  const quantityDelta = Number(values.countedQuantity) - batchQuantity;

  if (quantityDelta === 0) {
    return null;
  }

  return {
    batchNumber: values.batchNumber.trim(),
    lowStockThreshold:
      values.lowStockThreshold === "" ? undefined : Number(values.lowStockThreshold),
    productId: values.productId,
    quantityDelta,
    reason: values.reason.trim(),
    variantId: blankToNull(values.variantId),
    warehouseId: values.warehouseId
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

/** How a movement changed on-hand stock: + for inward, - for outward. */
export function getMovementNetQuantity(
  movement: Pick<StockMovement, "netQuantity" | "quantity" | "reason" | "type">
) {
  if (typeof movement.netQuantity === "number") {
    return movement.netQuantity;
  }

  switch (movement.type) {
    case "OUT":
      return -movement.quantity;
    case "RETURN":
      return movement.reason === "RESTOCK" ? movement.quantity : 0;
    default:
      return movement.quantity;
  }
}

export function formatSignedQuantity(value: number) {
  if (value > 0) {
    return `+${value.toLocaleString("en-IN")}`;
  }

  // A true minus sign reads better than a hyphen next to digits.
  return value < 0 ? `−${Math.abs(value).toLocaleString("en-IN")}` : "0";
}

/** Names what happened in words, rather than the raw movement type. */
export function describeMovement(
  movement: Pick<StockMovement, "reason" | "referenceType" | "type">
) {
  switch (movement.referenceType) {
    case "STOCK_IN":
      return "Received";
    case "STOCK_OUT":
      return `Removed: ${
        STOCK_OUT_REASON_LABELS[movement.reason as StockOutReason] ?? "Other"
      }`;
    case "STOCK_ADJUSTMENT":
      return "Count correction";
    case "STOCK_TRANSFER":
      return movement.type === "OUT" ? "Transfer out" : "Transfer in";
    case "RETURN_DISPOSITION":
      return `Return: ${
        RETURN_DISPOSITION_LABELS[movement.reason as ReturnStockDisposition] ?? "Recorded"
      }`;
    default:
      return formatMovementType(movement.type);
  }
}

export function formatStockItemName(item: {
  product?: { name: string } | null;
  productId: string;
  variant?: { name: string } | null;
}) {
  const productName = item.product?.name ?? item.productId;

  return item.variant ? `${productName} - ${item.variant.name}` : productName;
}

/** Builds a stock-actions link that opens one action with its product already chosen. */
export function buildStockActionHref(
  action: StockAction,
  params: {
    batchNumber?: string;
    productId?: string;
    reason?: StockOutReason;
    variantId?: string | null;
    warehouseId?: string;
  } = {}
) {
  const searchParams = new URLSearchParams({ action });

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  return `${INVENTORY_ACTIONS_PATH}?${searchParams.toString()}`;
}

export function getStockActionFromSearchParams(value: string | null): StockAction {
  return STOCK_ACTIONS.find((action) => action.value === value)?.value ?? "receive";
}

/** Whole days until a batch expires, negative once it has expired. */
export function daysUntilExpiry(expiryDate: Date | string | null, now = new Date()) {
  if (!expiryDate) {
    return null;
  }

  const expiry = new Date(expiryDate).getTime();

  return Number.isNaN(expiry) ? null : Math.ceil((expiry - now.getTime()) / 86_400_000);
}

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function blankToUndefined(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
}
