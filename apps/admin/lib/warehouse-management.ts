import { z } from "zod";
import type { QueryParams } from "./admin-api";

export const WAREHOUSE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const WAREHOUSE_ANALYTICS_PATH = "/warehouses";
export const WAREHOUSE_CREATE_PATH = "/warehouses/create";
export const WAREHOUSE_LIST_PATH = "/warehouses/list";

export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number];

export type AdminWarehouse = {
  address: string;
  city: string;
  code: string;
  contactNumber: string;
  contactPerson: string;
  createdAt: Date | string;
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  pincode: string;
  state: string;
  status: WarehouseStatus;
  updatedAt: Date | string;
};

export type WarehouseListResponse = {
  items: AdminWarehouse[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

export type WarehouseStaffAssignment = {
  adminUserId: string;
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  warehouseId: string;
};

export type WarehouseFilters = {
  search: string;
  state: string;
  status: "" | WarehouseStatus;
  warehouseId: string;
};

export type WarehouseFilterView = "analytics" | "create" | "list" | "staff";

export type WarehouseFilterContent = {
  searchPlaceholder: string;
  submitLabel: string;
};

export type WarehousePayload = {
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
  status: WarehouseStatus;
};

const warehouseCodePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const contactNumberPattern = /^(?=(?:\D*\d){8,15}\D*$)[0-9+()\-\s]{8,20}$/;
const pincodePattern = /^[0-9]{6}$/;

const requiredText = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} is too long.`);

const optionalCoordinate = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value), {
      message: `${label} must be a valid number.`
    })
    .refine(
      (value) => value === "" || (Number(value) >= min && Number(value) <= max),
      {
        message: `${label} must be between ${min} and ${max}.`
      }
    )
    .refine(
      (value) =>
        value === "" ||
        decimalPlaces(value) <= 7,
      {
        message: `${label} can have at most 7 decimal places.`
      }
    );

export const warehouseFormSchema = z.object({
  address: requiredText("Address", 500),
  city: requiredText("City", 120),
  code: requiredText("Warehouse code", 32)
    .transform((value) => value.toUpperCase())
    .refine((value) => warehouseCodePattern.test(value), {
      message:
        "Warehouse code must start with a letter or number and use uppercase letters, numbers, underscores, or hyphens."
    }),
  contactNumber: requiredText("Contact number", 20).regex(
    contactNumberPattern,
    "Enter a valid contact number."
  ),
  contactPerson: requiredText("Contact person", 120),
  latitude: optionalCoordinate("Latitude", -90, 90),
  longitude: optionalCoordinate("Longitude", -180, 180),
  name: requiredText("Warehouse name", 160),
  pincode: requiredText("Pincode", 6).regex(
    pincodePattern,
    "Pincode must be exactly 6 digits."
  ),
  state: requiredText("State", 120),
  status: z.enum(WAREHOUSE_STATUSES)
});

export const warehouseStaffFormSchema = z.object({
  adminUserId: z.string().trim().uuid("Enter a valid admin user ID.")
});

export type WarehouseFormValues = z.input<typeof warehouseFormSchema>;
export type ParsedWarehouseFormValues = z.output<typeof warehouseFormSchema>;
export type WarehouseStaffFormValues = z.infer<typeof warehouseStaffFormSchema>;

export function createEmptyWarehouseFormValues(): WarehouseFormValues {
  return {
    address: "",
    city: "",
    code: "",
    contactNumber: "",
    contactPerson: "",
    latitude: "",
    longitude: "",
    name: "",
    pincode: "",
    state: "",
    status: "ACTIVE"
  };
}

export function createEmptyWarehouseFilters(): WarehouseFilters {
  return {
    search: "",
    state: "",
    status: "",
    warehouseId: ""
  };
}

export function warehouseToFormValues(warehouse: AdminWarehouse): WarehouseFormValues {
  return {
    address: warehouse.address,
    city: warehouse.city,
    code: warehouse.code,
    contactNumber: warehouse.contactNumber,
    contactPerson: warehouse.contactPerson,
    latitude: numberToString(warehouse.latitude),
    longitude: numberToString(warehouse.longitude),
    name: warehouse.name,
    pincode: warehouse.pincode,
    state: warehouse.state,
    status: warehouse.status
  };
}

export function createWarehouseFiltersFromSearchParams(searchParams: {
  get: (key: string) => string | null;
}): WarehouseFilters {
  const status = searchParams.get("status");

  return {
    search: searchParams.get("search") ?? "",
    state: searchParams.get("state") ?? "",
    status: (WAREHOUSE_STATUSES as readonly string[]).includes(status ?? "")
      ? status as WarehouseStatus
      : "",
    warehouseId: searchParams.get("warehouseId")?.trim() ?? ""
  };
}

export function buildWarehousePayload(
  values: ParsedWarehouseFormValues | WarehouseFormValues
): WarehousePayload {
  return {
    address: values.address.trim(),
    city: values.city.trim(),
    code: values.code.trim().toUpperCase(),
    contactNumber: values.contactNumber.trim(),
    contactPerson: values.contactPerson.trim(),
    latitude: coordinateOrNull(values.latitude),
    longitude: coordinateOrNull(values.longitude),
    name: values.name.trim(),
    pincode: values.pincode.trim(),
    state: values.state.trim(),
    status: values.status
  };
}

export function buildWarehouseQuery(filters: WarehouseFilters, page = 1): QueryParams {
  return {
    limit: 100,
    page,
    search: filters.search || undefined,
    state: filters.state || undefined,
    status: filters.status || undefined,
    warehouseId: filters.warehouseId || undefined
  };
}

export async function loadWarehouseResults(
  fetchPage: (query: QueryParams) => Promise<WarehouseListResponse>,
  filters: WarehouseFilters,
  page: number,
  allPages: boolean
): Promise<WarehouseListResponse> {
  const first = await fetchPage(buildWarehouseQuery(filters, allPages ? 1 : page));
  if (!allPages) return first;

  const items = [...first.items];
  let current = first;
  while (current.pagination.hasNextPage) {
    current = await fetchPage(buildWarehouseQuery(filters, current.pagination.page + 1));
    items.push(...current.items);
  }
  return { ...first, items };
}

export function buildWarehouseCreatePath(returnToPath?: string | null) {
  if (!returnToPath) {
    return WAREHOUSE_CREATE_PATH;
  }

  const params = new URLSearchParams({ returnTo: returnToPath });

  return `${WAREHOUSE_CREATE_PATH}?${params.toString()}`;
}

export function buildWarehouseEditPath(warehouseId: string) {
  const params = new URLSearchParams({ edit: warehouseId });

  return `${WAREHOUSE_CREATE_PATH}?${params.toString()}`;
}

export function getWarehouseEditId(
  value: string | string[] | null | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const editId = rawValue?.trim();

  return editId ? editId : null;
}

export function getWarehouseReturnToPath(
  value: string | string[] | null | undefined
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const returnToPath = rawValue?.trim();

  return returnToPath === WAREHOUSE_ANALYTICS_PATH ||
    returnToPath === WAREHOUSE_LIST_PATH
    ? returnToPath
    : null;
}

export function shouldShowWarehouseFilters(
  view: WarehouseFilterView
) {
  return view !== "create";
}

export function getWarehouseFilterContent(
  view: WarehouseFilterView
): WarehouseFilterContent {
  if (view === "analytics") {
    return {
      searchPlaceholder: "Name, code, city",
      submitLabel: "Apply analytics filters"
    };
  }

  if (view === "staff") {
    return {
      searchPlaceholder: "Warehouse for staff assignment",
      submitLabel: "Apply staff filters"
    };
  }

  return {
    searchPlaceholder: "Warehouse name, code, city",
    submitLabel: "Apply table filters"
  };
}

export function getWarehouseStatusAction(
  currentStatus: WarehouseStatus | null | undefined,
  nextStatus: WarehouseStatus
) {
  if (!currentStatus || currentStatus === nextStatus) {
    return null;
  }

  return nextStatus === "ACTIVE" ? "activate" : "deactivate";
}

export function formatWarehouseStatus(status: WarehouseStatus) {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

export function getWarehouseAnalytics(warehouses: AdminWarehouse[]) {
  return {
    active: warehouses.filter((warehouse) => warehouse.status === "ACTIVE").length,
    inactive: warehouses.filter((warehouse) => warehouse.status === "INACTIVE").length,
    states: new Set(warehouses.map((warehouse) => warehouse.state.trim()).filter(Boolean)).size,
    visible: warehouses.length
  };
}

function coordinateOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}

function numberToString(value: number | null) {
  return value === null ? "" : String(value);
}

function decimalPlaces(value: string) {
  const [, decimal = ""] = value.split(".");

  return decimal.length;
}
