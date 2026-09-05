import type { AdminApiClient, QueryParams } from "@/lib/admin-api";
import type { AdminBrand, AdminCategory } from "@/lib/catalog-management";
import type { AdminCustomer } from "@/lib/customer-management";
import type { AdminDeliveryChargeRule } from "@/lib/delivery-charge-management";
import type { InventoryStock, StockBatch } from "@/lib/inventory-management";
import type { AdminProduct } from "@/lib/product-form";
import type { AdminCoupon, AdminQuoteRequest } from "@/lib/support-management";
import type { AdminWarehouse } from "@/lib/warehouse-management";

export const fixtureId = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const date = "2026-09-05T10:00:00.000Z";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Isolated transport fixture for UI workflows. No external API or database access. */
export function createBulkResourceFixture() {
  const brands: AdminBrand[] = [true, true, false].map((isActive, i) => ({
    id: fixtureId(10 + i),
    name: `QA brand ${i + 1}`,
    slug: `qa-brand-${i + 1}`,
    isActive,
    logoUrl: null
  }));
  const categories: AdminCategory[] = [true, true, false].map((isActive, i) => ({
    id: fixtureId(20 + i),
    name: `QA category ${i + 1}`,
    slug: `qa-category-${i + 1}`,
    isActive,
    sortOrder: i,
    parentId: null,
    children: []
  }));
  categories[0]!.children = [true, false].map((isActive, i) => ({
    id: fixtureId(25 + i),
    name: `QA child ${i + 1}`,
    slug: `qa-child-${i + 1}`,
    isActive,
    sortOrder: i,
    parentId: categories[0]!.id,
    children: []
  }));
  const coupons: AdminCoupon[] = [true, true, false].map((isActive, i) => ({
    id: fixtureId(30 + i),
    code: `QA-COUPON-${i + 1}`,
    isActive,
    type: "FIXED_AMOUNT",
    value: 25,
    minOrderAmount: 100,
    maxDiscount: null,
    usedCount: 0,
    usageLimit: null,
    startsAt: null,
    expiresAt: null
  }));
  const rules: AdminDeliveryChargeRule[] = [true, true, false].map((isActive, i) => ({
    id: fixtureId(40 + i),
    name: `QA rule ${i + 1}`,
    isActive,
    charge: 25 + i,
    priority: i,
    pincode: null,
    warehouseId: null,
    warehouse: null,
    minOrderAmount: 0,
    maxOrderAmount: null,
    freeDeliveryThreshold: null,
    createdAt: date,
    updatedAt: date
  }));
  const customers: AdminCustomer[] = ["ACTIVE", "ACTIVE", "BLOCKED"].map(
    (status, i) => ({
      id: fixtureId(50 + i),
      name: `QA customer ${i + 1}`,
      mobileNumber: `900000000${i}`,
      isActive: status === "ACTIVE",
      status: status as AdminCustomer["status"],
      addressCount: 0,
      businessName: null,
      createdAt: date,
      updatedAt: date,
      email: null,
      gstNumber: null,
      orderCount: 0
    })
  );
  const quotes: AdminQuoteRequest[] = ["NEW", "CONTACTED", "CLOSED"].map(
    (status, i) => ({
      id: fixtureId(60 + i),
      name: `QA quote ${i + 1}`,
      status: status as AdminQuoteRequest["status"],
      email: "qa@example.test",
      mobileNumber: "9000000000",
      organization: null,
      message: "Isolated QA enquiry",
      createdAt: date,
      convertedCartId: i === 2 ? fixtureId(90) : null,
      quotation: null,
      customerDecision: null
    })
  );
  const warehouses = [1, 2].map((i) => ({
    id: fixtureId(70 + i),
    name: `QA warehouse ${i}`,
    code: `QA-W${i}`,
    status: "ACTIVE"
  })) as AdminWarehouse[];
  const products = [1, 2, 3].map((i) => ({
    id: fixtureId(80 + i),
    name: `QA product ${i}`,
    sku: `QA-P${i}`,
    status: "ACTIVE",
    variants: []
  })) as unknown as AdminProduct[];
  const stocks: InventoryStock[] = [10, 5, 1].map((availableQuantity, i) => ({
    id: fixtureId(100 + i),
    availableQuantity,
    reservedQuantity: 0,
    lowStockThreshold: 2,
    productId: products[i]!.id,
    variantId: null,
    warehouseId: warehouses[0]!.id
  }));
  const batches: StockBatch[] = stocks.map((stock, i) => ({
    id: fixtureId(110 + i),
    batchNumber: `QA-BATCH-${i + 1}`,
    productId: stock.productId,
    variantId: stock.variantId,
    warehouseId: stock.warehouseId,
    quantity: stock.availableQuantity,
    expiryDate: new Date(Date.now() + 86400000 * 10).toISOString(),
    mrp: 100,
    purchasePrice: 60,
    sellingPrice: 80
  }));
  const movements: Array<Record<string, unknown>> = [];
  const calls: Array<{
    path: string;
    method: string;
    body?: Record<string, unknown>;
    query?: QueryParams;
  }> = [];
  const archived = new Set<string>();
  const failOnce = new Set<string>();
  const failAfterSave = new Set<string>();
  const allCategories = () =>
    categories.flatMap((category) => [category, ...category.children]);
  function paginated<T extends { id: string }>(items: T[], query?: QueryParams) {
    const filtered = items.filter((item) => !archived.has(item.id));
    const page = Number(query?.page ?? 1),
      limit = Number(query?.limit ?? 20);
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
        hasNextPage: page * limit < filtered.length,
        hasPreviousPage: page > 1
      }
    };
  }
  const request: AdminApiClient["request"] = async <T>(
    path: string,
    init?: Parameters<AdminApiClient["request"]>[1]
  ): Promise<T> => {
    const method = init?.method ?? "GET";
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : undefined;
    calls.push({ path, method, body, query: init?.query });
    if (method !== "GET" && failOnce.delete(path))
      throw new Error("Temporary QA service failure");
    let result: unknown;
    if (path === "/admin/brands" || path === "/brands") result = brands;
    else if (path === "/admin/categories" || path === "/categories")
      result = categories;
    else if (path === "/admin/warehouses") result = paginated(warehouses, init?.query);
    else if (path === "/admin/products") result = paginated(products, init?.query);
    else if (path === "/admin/coupons")
      result = paginated(
        coupons.filter((item) =>
          item.code
            .toLowerCase()
            .includes(String(init?.query?.search ?? "").toLowerCase())
        ),
        init?.query
      );
    else if (path === "/admin/delivery-charge-rules")
      result = paginated(
        rules.filter((item) =>
          item.name
            .toLowerCase()
            .includes(String(init?.query?.search ?? "").toLowerCase())
        ),
        init?.query
      );
    else if (path === "/admin/customers")
      result = paginated(
        customers.filter(
          (item) =>
            (!init?.query?.status || item.status === init.query.status) &&
            item.name
              .toLowerCase()
              .includes(String(init?.query?.search ?? "").toLowerCase())
        ),
        init?.query
      );
    else if (path === "/admin/quote-requests")
      result = paginated(
        quotes.filter(
          (item) => !init?.query?.status || item.status === init.query.status
        ),
        init?.query
      );
    else if (path === "/admin/inventory" || path === "/admin/inventory/low-stock")
      result = paginated(
        path.endsWith("low-stock")
          ? stocks.filter((item) => item.availableQuantity <= item.lowStockThreshold)
          : stocks,
        init?.query
      );
    else if (path === "/admin/inventory/near-expiry")
      result = paginated(batches, init?.query);
    else if (path === "/admin/inventory/movements")
      result = paginated(movements as Array<{ id: string }>, init?.query);
    else if (
      path === "/admin/inventory/adjust" ||
      path === "/admin/inventory/transfer"
    ) {
      const stock = stocks.find(
        (item) =>
          item.productId === body?.productId &&
          item.variantId === body?.variantId &&
          item.warehouseId === (body?.warehouseId ?? body?.fromWarehouseId)
      );
      const batch = batches.find(
        (item) =>
          item.productId === body?.productId &&
          item.variantId === body?.variantId &&
          item.warehouseId === stock?.warehouseId &&
          item.batchNumber === body?.batchNumber
      );
      if (!stock || !batch) throw new Error("Stock batch was not found.");
      const delta = path.endsWith("adjust")
        ? Number(body?.quantityDelta)
        : -Number(body?.quantity);
      if (stock.availableQuantity + delta < 0 || batch.quantity + delta < 0)
        throw new Error("Insufficient stock.");
      stock.availableQuantity += delta;
      batch.quantity += delta;
      if (path.endsWith("transfer")) {
        let destination = stocks.find(
          (item) =>
            item.productId === stock.productId &&
            item.warehouseId === body?.toWarehouseId
        );
        if (!destination) {
          destination = {
            ...stock,
            id: fixtureId(200 + stocks.length),
            warehouseId: String(body?.toWarehouseId),
            availableQuantity: 0
          };
          stocks.push(destination);
        }
        destination.availableQuantity -= delta;
      }
      movements.push({
        id: fixtureId(300 + movements.length),
        ...body,
        quantity: delta,
        createdAt: date,
        type: path.endsWith("adjust") ? "ADJUSTMENT" : "TRANSFER"
      });
      result = stock;
    } else {
      const [, , resource, id] = path.split("/");
      const collections = {
        brands,
        categories: allCategories(),
        coupons,
        "delivery-charge-rules": rules,
        customers,
        "quote-requests": quotes
      };
      const collection = collections[resource as keyof typeof collections];
      const item = collection?.find((record) => record.id === id);
      if (!item) throw new Error(`QA route or record missing: ${path}`);
      if (method === "DELETE") archived.add(item.id);
      if (method === "PATCH") {
        Object.assign(item, body);
        if (resource === "customers")
          Object.assign(item, { isActive: body?.status === "ACTIVE" });
      }
      result = item;
    }
    if (method !== "GET" && failAfterSave.delete(path))
      throw new Error("Connection lost after saving. Check inventory movements.");
    return clone(result) as T;
  };
  return {
    request,
    calls,
    brands,
    categories,
    coupons,
    rules,
    customers,
    quotes,
    warehouses,
    products,
    stocks,
    batches,
    movements,
    archived,
    failOnce,
    failAfterSave
  };
}
