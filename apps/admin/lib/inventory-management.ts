import { z } from "zod";
import type { QueryParams } from "./admin-api";

export const STOCK_MOVEMENT_TYPES = [
  "IN",
  "OUT",
  "ADJUSTMENT",
  "TRANSFER",
  "RETURN"
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type InventoryFilters = {
  lowStock: boolean;
  nearExpiry: boolean;
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

export type InventoryStock = {
  availableQuantity: number;
  id: string;
  lowStockThreshold: number;
  productId: string;
  reservedQuantity: number;
  variantId: string | null;
  warehouseId: string;
};

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
  id: string;
  productId: string;
  quantity: number;
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
  nearExpiry: z.boolean(),
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
  batchNumber: optionalText("Batch number", 120),
  lowStockThreshold: optionalWholeNumberString("Low-stock threshold"),
  productId: uuidField("Product"),
  quantityDelta: signedIntegerString("Quantity delta"),
  reason: requiredText("Reason", 1000),
  variantId: optionalUuidField("Variant"),
  warehouseId: uuidField("Warehouse")
});

export const transferStockFormSchema = z
  .object({
    batchNumber: optionalText("Batch number", 120),
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

export type InventoryFilterValues = z.infer<typeof inventoryFiltersSchema>;
export type StockInFormValues = z.infer<typeof stockInFormSchema>;
export type AdjustStockFormValues = z.infer<typeof adjustStockFormSchema>;
export type TransferStockFormValues = z.infer<typeof transferStockFormSchema>;

export function createEmptyInventoryFilters(): InventoryFilters {
  return {
    lowStock: false,
    nearExpiry: false,
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
        days: options.days ?? 30
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
    batchNumber: blankToUndefined(values.batchNumber),
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
    batchNumber: blankToUndefined(values.batchNumber),
    fromWarehouseId: values.fromWarehouseId,
    notes: blankToUndefined(values.notes),
    productId: values.productId,
    quantity: Number(values.quantity),
    toWarehouseId: values.toWarehouseId,
    variantId: blankToNull(values.variantId)
  };
}

export function isLowStock(stock: Pick<InventoryStock, "availableQuantity" | "lowStockThreshold">) {
  return stock.availableQuantity <= stock.lowStockThreshold;
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
