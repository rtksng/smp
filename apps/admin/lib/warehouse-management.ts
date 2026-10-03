import { z } from "zod";
import { AdminApiClientError, type QueryParams } from "./admin-api";
import { INVENTORY_MOVEMENTS_PATH, INVENTORY_OVERVIEW_PATH } from "./inventory-management";
import { ADMIN_PERMISSION } from "./permissions";

export const WAREHOUSE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const WAREHOUSES_PATH = "/warehouses";
export const WAREHOUSE_CREATE_PATH = "/warehouses/create";
export const WAREHOUSE_STAFF_PATH = "/warehouses/staff";
export const WAREHOUSE_DETAIL_PRODUCTS_PAGE_SIZE = 20;
export const WAREHOUSE_DETAIL_PARTNERS_PAGE_SIZE = 10;
export const WAREHOUSE_NEAR_EXPIRY_DAYS = 30;
const WAREHOUSE_LOOKUP_PAGE_SIZE = 100;
// Matches the API's inventory search limit.
const WAREHOUSE_PRODUCT_SEARCH_MAX_LENGTH = 160;
const WAREHOUSE_DETAIL_PATH_PATTERN =
  /^\/warehouses\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type WarehouseStaffRole = {
  code: string;
  id: string;
  name: string;
};

export type WarehouseStaffAssignment = {
  adminUserId: string;
  email: string;
  firstName: string;
  id: string;
  lastName: string | null;
  // Optional so staff rows still render against an API that predates roles on this list.
  role?: WarehouseStaffRole | null;
  warehouseId: string;
};

export type WarehouseStaffCandidate = {
  adminUserId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: WarehouseStaffRole;
};

export type WarehouseQuickLink = {
  href: string;
  label: string;
};

export type WarehouseFilters = {
  search: string;
  state: string;
  status: "" | WarehouseStatus;
  warehouseId: string;
};

export type WarehouseFilterView = "create" | "list" | "staff";

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
  adminUserId: z.string().trim().uuid("Select an admin user to assign.")
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

export function createWarehouseFiltersFromRouteParams(
  params: Record<string, string | string[] | undefined>
): WarehouseFilters {
  return createWarehouseFiltersFromSearchParams({
    get: (key) => {
      const value = params[key];
      return (Array.isArray(value) ? value[0] : value) ?? null;
    }
  });
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

export function buildWarehouseQuery(
  filters: WarehouseFilters,
  page = 1,
  limit = WAREHOUSE_LOOKUP_PAGE_SIZE
): QueryParams {
  return {
    limit,
    page,
    search: filters.search || undefined,
    state: filters.state || undefined,
    status: filters.status || undefined,
    warehouseId: filters.warehouseId || undefined
  };
}

/** Reads every matching warehouse so KPIs, the paged table, and staff pickers share one result. */
export async function loadWarehouseResults(
  fetchPage: (query: QueryParams) => Promise<WarehouseListResponse>,
  filters: WarehouseFilters
): Promise<WarehouseListResponse> {
  const first = await fetchPage(buildWarehouseQuery(filters, 1));

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

export function buildWarehouseEditPath(warehouseId: string, returnToPath?: string | null) {
  const params = new URLSearchParams({ edit: warehouseId });

  if (returnToPath) {
    params.set("returnTo", returnToPath);
  }

  return `${WAREHOUSE_CREATE_PATH}?${params.toString()}`;
}

export function buildWarehouseDetailPath(warehouseId: string) {
  return `${WAREHOUSES_PATH}/${encodeURIComponent(warehouseId)}`;
}

export function isWarehouseDetailPath(path: string) {
  return WAREHOUSE_DETAIL_PATH_PATTERN.test(path);
}

/** Links a related admin screen pre-filtered to one warehouse. */
export function buildWarehouseScopedHref(
  path: string,
  warehouseId: string,
  extraParams: Record<string, string> = {}
) {
  const params = new URLSearchParams({ ...extraParams, warehouseId });

  return `${path}?${params.toString()}`;
}

export function buildWarehouseStaffPath(warehouseId: string) {
  return buildWarehouseScopedHref(WAREHOUSE_STAFF_PATH, warehouseId);
}

const WAREHOUSE_QUICK_LINKS: Array<{
  extraParams?: Record<string, string>;
  label: string;
  path: string;
  permission: string;
}> = [
  { label: "Stock overview", path: INVENTORY_OVERVIEW_PATH, permission: ADMIN_PERMISSION.InventoryRead },
  {
    extraParams: { lowStock: "true" },
    label: "Low stock",
    path: INVENTORY_OVERVIEW_PATH,
    permission: ADMIN_PERMISSION.InventoryRead
  },
  {
    extraParams: { nearExpiry: "true", nearExpiryDays: String(WAREHOUSE_NEAR_EXPIRY_DAYS) },
    label: "Near expiry",
    path: INVENTORY_OVERVIEW_PATH,
    permission: ADMIN_PERMISSION.InventoryRead
  },
  { label: "Stock movements", path: INVENTORY_MOVEMENTS_PATH, permission: ADMIN_PERMISSION.InventoryRead },
  { label: "Orders", path: "/orders", permission: ADMIN_PERMISSION.OrdersRead },
  { label: "Deliveries", path: "/delivery/assignments", permission: ADMIN_PERMISSION.DeliveryRead },
  { label: "Manage staff", path: WAREHOUSE_STAFF_PATH, permission: ADMIN_PERMISSION.WarehouseStaffManage }
];

export function buildWarehouseQuickLinks(
  warehouseId: string,
  hasPermission: (permission: string) => boolean
): WarehouseQuickLink[] {
  return WAREHOUSE_QUICK_LINKS.filter((link) => hasPermission(link.permission)).map((link) => ({
    href: buildWarehouseScopedHref(link.path, warehouseId, link.extraParams),
    label: link.label
  }));
}

export function normalizeWarehouseProductSearch(search: string) {
  return search.trim().slice(0, WAREHOUSE_PRODUCT_SEARCH_MAX_LENGTH);
}

export function buildWarehouseStockQuery(
  warehouseId: string,
  page: number,
  search: string
): QueryParams {
  return {
    limit: WAREHOUSE_DETAIL_PRODUCTS_PAGE_SIZE,
    page,
    search: normalizeWarehouseProductSearch(search) || undefined,
    warehouseId
  };
}

export function buildWarehousePartnerQuery(warehouseId: string, page: number): QueryParams {
  return {
    limit: WAREHOUSE_DETAIL_PARTNERS_PAGE_SIZE,
    page,
    warehouseId
  };
}

export function getWarehouseDetailError(error: unknown) {
  if (error instanceof AdminApiClientError && error.status === 403) {
    return {
      message: "You are not assigned to this warehouse. Ask a super admin to add you to its staff.",
      title: "Warehouse unavailable"
    };
  }

  if (error instanceof AdminApiClientError && (error.status === 400 || error.status === 404)) {
    return {
      message: "This warehouse does not exist or has been deleted.",
      title: "Warehouse not found"
    };
  }

  return {
    message: error instanceof Error && error.message ? error.message : "Unable to load this warehouse.",
    title: "Warehouse unavailable"
  };
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

  if (!returnToPath) {
    return null;
  }

  return returnToPath === WAREHOUSES_PATH || isWarehouseDetailPath(returnToPath)
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
  if (view === "staff") {
    return {
      searchPlaceholder: "Warehouse for staff assignment",
      submitLabel: "Apply staff filters"
    };
  }

  return {
    searchPlaceholder: "Warehouse name, code, city",
    submitLabel: "Apply warehouse filters"
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

export function formatWarehouseCoordinates(latitude: number | null, longitude: number | null) {
  return latitude === null || longitude === null ? "Not set" : `${latitude}, ${longitude}`;
}

export function formatWarehouseStaffCandidate(candidate: WarehouseStaffCandidate) {
  const name = [candidate.firstName, candidate.lastName].filter(Boolean).join(" ");

  return `${name} (${candidate.email}) - ${candidate.role.name}`;
}

export function getWarehouseAnalytics(warehouses: AdminWarehouse[]) {
  return {
    active: warehouses.filter((warehouse) => warehouse.status === "ACTIVE").length,
    inactive: warehouses.filter((warehouse) => warehouse.status === "INACTIVE").length,
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
