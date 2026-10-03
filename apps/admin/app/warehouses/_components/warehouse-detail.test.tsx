import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminApiClientError } from "../../../lib/admin-api";
import { WarehouseDetailContent } from "./warehouse-detail";

const access = vi.hoisted(() => ({
  permissions: new Set<string>(),
  request: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAdminSession: () => ({
    api: { request: access.request },
    hasPermission: (permission: string) => access.permissions.has(permission)
  })
}));

vi.mock("../../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));

type RequestOptions = { query?: Record<string, unknown> };
type Route = (options: RequestOptions) => unknown;

const warehouseId = "7d9f8f33-d348-4a89-94e8-907be76a91c6";
const detailPath = `/admin/warehouses/${warehouseId}`;
const ALL_PERMISSIONS = [
  "warehouse.read",
  "warehouse.manage",
  "warehouse.staff.manage",
  "inventory.read",
  "products.read",
  "orders.read",
  "delivery.read"
];
const warehouse = {
  address: "Plot 1, Surgical Park",
  city: "Pune",
  code: "PUN-01",
  contactNumber: "9000000000",
  contactPerson: "QA Contact",
  createdAt: "2026-09-01T10:00:00.000Z",
  id: warehouseId,
  latitude: 18.52,
  longitude: 73.85,
  name: "Pune Central",
  pincode: "411001",
  state: "Maharashtra",
  status: "ACTIVE",
  updatedAt: "2026-09-02T10:00:00.000Z"
};
const staff = [
  {
    adminUserId: "admin-2",
    email: "manager@example.test",
    firstName: "Asha",
    id: "assignment-2",
    lastName: "Rao",
    role: { code: "WAREHOUSE_MANAGER", id: "role-1", name: "Warehouse manager" },
    warehouseId
  }
];
const partner = {
  createdAt: "2026-09-01T10:00:00.000Z",
  documents: [],
  email: null,
  fullName: "Ravi Driver",
  id: "partner-1",
  isOnline: true,
  lastSeenAt: null,
  mobileNumber: "+919111111111",
  status: "ACTIVE",
  updatedAt: "2026-09-01T10:00:00.000Z",
  vehicleNumber: "MH12AB1234",
  wallet: { balance: 0, currency: "INR", totalEarnings: 0 }
};
const clients: QueryClient[] = [];

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  access.permissions.clear();
  access.request.mockReset();
});

describe("Warehouse detail", () => {
  it("shows the warehouse, its KPIs, products, staff and delivery partners to a full-access admin", async () => {
    grant(ALL_PERMISSIONS);
    mockApi();
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Pune Central" })).toBeInTheDocument();
    const details = screen.getByRole("region", { name: "Warehouse details" });
    expect(within(details).getByText("PUN-01")).toBeInTheDocument();
    expect(within(details).getByText("18.52, 73.85")).toBeInTheDocument();
    expect(within(details).getByText(warehouseId)).toBeInTheDocument();
    await waitFor(() => expect(metricValue("Products")).toBe("3"));
    expect(metricValue("Low stock")).toBe("2");
    expect(metricValue("Expiring in 30 days")).toBe("4");
    await waitFor(() => expect(metricValue("Assigned staff")).toBe("1"));
    await waitFor(() => expect(metricValue("Delivery partners")).toBe("1"));

    const products = screen.getByRole("region", { name: "Products" });
    expect(await within(products).findByText("Product 1")).toBeInTheDocument();
    expect(within(products).getByText("SKU-1")).toBeInTheDocument();
    expect(within(products).getByText("Size 6")).toBeInTheDocument();
    expect(within(products).getByText("in stock")).toBeInTheDocument();
    expect(within(products).getByText("low stock")).toBeInTheDocument();
    expect(within(products).getByText("out of stock")).toBeInTheDocument();

    const staffRegion = screen.getByRole("region", { name: "Staff" });
    expect(await within(staffRegion).findByText("Asha Rao")).toBeInTheDocument();
    expect(within(staffRegion).getByText("Warehouse manager")).toBeInTheDocument();

    const partners = screen.getByRole("region", { name: "Delivery partners" });
    expect(await within(partners).findByText("Ravi Driver")).toBeInTheDocument();
    expect(within(partners).getByText("Online")).toBeInTheDocument();
    expect(within(partners).getByText("MH12AB1234")).toBeInTheDocument();
  });

  it("links products, partners, shortcuts and edit to the right filtered screens", async () => {
    grant(ALL_PERMISSIONS);
    mockApi();
    renderDetail();

    const products = await screen.findByRole("region", { name: "Products" });
    expect(await within(products).findByRole("link", { name: "Product 1" })).toHaveAttribute(
      "href",
      "/products/product-1/edit"
    );
    expect(within(products).getByRole("link", { name: "View stock for Product 1" })).toHaveAttribute(
      "href",
      `/inventory?productId=product-1&warehouseId=${warehouseId}`
    );
    expect(
      within(products).getByRole("link", { name: "View stock movements for Product 1" })
    ).toHaveAttribute("href", `/inventory/movements?productId=product-1&warehouseId=${warehouseId}`);

    const partners = screen.getByRole("region", { name: "Delivery partners" });
    expect(await within(partners).findByRole("link", { name: "View Ravi Driver" })).toHaveAttribute(
      "href",
      "/delivery/partners/partner-1"
    );
    expect(
      within(partners).getByRole("link", { name: "Deliveries by Ravi Driver from this warehouse" })
    ).toHaveAttribute("href", `/delivery/assignments?deliveryPartnerId=partner-1&warehouseId=${warehouseId}`);

    const shortcuts = screen.getByRole("navigation", { name: "Warehouse shortcuts" });
    expect(within(shortcuts).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      `/inventory?warehouseId=${warehouseId}`,
      `/inventory?lowStock=true&warehouseId=${warehouseId}`,
      `/inventory?nearExpiry=true&nearExpiryDays=30&warehouseId=${warehouseId}`,
      `/inventory/movements?warehouseId=${warehouseId}`,
      `/orders?warehouseId=${warehouseId}`,
      `/delivery/assignments?warehouseId=${warehouseId}`,
      `/warehouses/staff?warehouseId=${warehouseId}`
    ]);
    expect(
      within(screen.getByRole("region", { name: "Staff" })).getByRole("link", { name: "Manage staff" })
    ).toHaveAttribute("href", `/warehouses/staff?warehouseId=${warehouseId}`);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/warehouses/create?edit=${warehouseId}&returnTo=%2Fwarehouses%2F${warehouseId}`
    );
    expect(screen.getByRole("link", { name: "Back to warehouses" })).toHaveAttribute("href", "/warehouses");
  });

  it("searches and pages the warehouse's products without reloading the KPI totals", async () => {
    grant(["warehouse.read", "inventory.read", "products.read"]);
    mockApi({
      "/admin/inventory": ({ query }) =>
        query?.limit === 1
          ? listPage([stock(1)], 1, 45, 1)
          : listPage([stock(query?.page === 2 ? 21 : 1)], Number(query?.page), 45)
    });
    renderDetail();

    const products = await screen.findByRole("region", { name: "Products" });
    await within(products).findByText("Product 1");
    fireEvent.change(within(products).getByRole("textbox", { name: "Search products" }), {
      target: { value: "  forceps " }
    });
    fireEvent.click(within(products).getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(access.request).toHaveBeenCalledWith(
        "/admin/inventory",
        expect.objectContaining({ query: { limit: 20, page: 1, search: "forceps", warehouseId } })
      )
    );
    fireEvent.click(await within(products).findByRole("button", { name: "Next" }));
    expect(await within(products).findByText("Product 21")).toBeInTheDocument();
    expect(access.request).toHaveBeenCalledWith(
      "/admin/inventory",
      expect.objectContaining({ query: { limit: 20, page: 2, search: "forceps", warehouseId } })
    );
    expect(
      access.request.mock.calls.filter(
        ([path, options]) => path === "/admin/inventory" && options?.query?.limit === 1
      )
    ).toHaveLength(1);
  });

  it("loads only what an inventory manager may see", async () => {
    grant(["warehouse.read", "inventory.read", "products.read"]);
    mockApi();
    renderDetail();

    const products = await screen.findByRole("region", { name: "Products" });
    expect(await within(products).findByText("Product 1")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Staff" })).getByText("Staff unavailable")
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Delivery partners" })).getByText(
        "Delivery partners unavailable"
      )
    ).toBeInTheDocument();
    expect(shortcutLabels()).toEqual(["Stock overview", "Low stock", "Near expiry", "Stock movements"]);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    await waitFor(() => expect(metricValue("Low stock")).toBe("2"));
    expect(requestedPaths()).toEqual(
      new Set([detailPath, "/admin/inventory", "/admin/inventory/low-stock", "/admin/inventory/near-expiry"])
    );
  });

  it("loads only what a delivery manager may see", async () => {
    grant(["warehouse.read", "delivery.read", "orders.read"]);
    mockApi();
    renderDetail();

    const partners = await screen.findByRole("region", { name: "Delivery partners" });
    expect(await within(partners).findByText("Ravi Driver")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Products" })).getByText("Products unavailable")
    ).toBeInTheDocument();
    expect(shortcutLabels()).toEqual(["Orders", "Deliveries"]);
    expect(requestedPaths()).toEqual(new Set([detailPath, "/admin/delivery-partners"]));
  });

  it("shows one clear message and loads nothing else when the admin is not assigned", async () => {
    grant(ALL_PERMISSIONS);
    access.request.mockRejectedValue(
      new AdminApiClientError("Admin is not assigned to this warehouse.", 403)
    );
    renderDetail();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Warehouse unavailable" })
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("You are not assigned to this warehouse.");
    expect(screen.queryByRole("region", { name: "Products" })).not.toBeInTheDocument();
    expect(access.request).toHaveBeenCalledTimes(1);
  });

  it("says the warehouse was not found for a missing or malformed id", async () => {
    grant(ALL_PERMISSIONS);
    access.request.mockRejectedValue(new AdminApiClientError("Warehouse was not found.", 404));
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1, name: "Warehouse not found" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This warehouse does not exist or has been deleted.");
  });

  it("keeps other sections working when one fails and shows empty states", async () => {
    grant(ALL_PERMISSIONS);
    mockApi({
      "/admin/delivery-partners": () => listPage([], 1, 0, 10),
      "/admin/inventory": () => {
        throw new Error("Inventory is temporarily unavailable.");
      }
    });
    renderDetail();

    const products = await screen.findByRole("region", { name: "Products" });
    expect(await within(products).findByRole("alert")).toHaveTextContent(
      "Inventory is temporarily unavailable."
    );
    expect(await within(screen.getByRole("region", { name: "Staff" })).findByText("Asha Rao")).toBeInTheDocument();
    expect(
      await within(screen.getByRole("region", { name: "Delivery partners" })).findByText(
        "No delivery partners yet"
      )
    ).toBeInTheDocument();
    await waitFor(() => expect(metricValue("Products")).toBe("-"));
    expect(metricValue("Delivery partners")).toBe("0");
  });

  it("refresh reloads only the sections the admin may load", async () => {
    grant(["warehouse.read", "inventory.read"]);
    mockApi();
    renderDetail();

    await within(await screen.findByRole("region", { name: "Products" })).findByText("Product 1");
    await waitFor(() => expect(countCalls("/admin/inventory/near-expiry")).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(countCalls(detailPath)).toBe(2));
    await waitFor(() => expect(countCalls("/admin/inventory/near-expiry")).toBe(2));
    expect(requestedPaths()).toEqual(
      new Set([detailPath, "/admin/inventory", "/admin/inventory/low-stock", "/admin/inventory/near-expiry"])
    );
  });

  it("shows product names as plain text without the products permission", async () => {
    grant(["warehouse.read", "inventory.read"]);
    mockApi();
    renderDetail();

    const products = await screen.findByRole("region", { name: "Products" });
    expect(await within(products).findByText("Product 1")).toBeInTheDocument();
    expect(within(products).queryByRole("link", { name: "Product 1" })).not.toBeInTheDocument();
    expect(within(products).getByRole("link", { name: "View stock for Product 1" })).toBeInTheDocument();
  });
});

function grant(permissions: string[]) {
  permissions.forEach((permission) => access.permissions.add(permission));
}

function mockApi(overrides: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    [detailPath]: () => warehouse,
    [`${detailPath}/staff`]: () => staff,
    "/admin/delivery-partners": () => listPage([partner], 1, 1, 10),
    "/admin/inventory": ({ query }) =>
      query?.limit === 1
        ? listPage([stock(1)], 1, 3, 1)
        : listPage(
            [
              stock(1),
              stock(2, { availableQuantity: 2 }),
              stock(3, {
                availableQuantity: 0,
                variant: { id: "variant-3", name: "Size 6", sku: "SKU-3-6" },
                variantId: "variant-3"
              })
            ],
            Number(query?.page ?? 1),
            3
          ),
    "/admin/inventory/low-stock": () => listPage([stock(2)], 1, 2, 1),
    "/admin/inventory/near-expiry": () => listPage([], 1, 4, 1),
    ...overrides
  };

  access.request.mockImplementation(async (path: string, options: RequestOptions = {}) => {
    const route = routes[path];

    if (!route) {
      throw new Error(`Unexpected request: ${path}`);
    }

    return route(options);
  });
}

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <WarehouseDetailContent warehouseId={warehouseId} />
    </QueryClientProvider>
  );
}

function stock(index: number, overrides: Record<string, unknown> = {}) {
  return {
    availableQuantity: 10,
    id: `stock-${index}`,
    lowStockThreshold: 5,
    product: { id: `product-${index}`, name: `Product ${index}`, sku: `SKU-${index}`, status: "ACTIVE" },
    productId: `product-${index}`,
    reservedQuantity: 1,
    variant: null,
    variantId: null,
    warehouseId,
    ...overrides
  };
}

function listPage(items: unknown[], page: number, total: number, limit = 20) {
  return {
    items,
    pagination: {
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
      limit,
      page,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

function metricValue(label: string) {
  return screen.getByText(label, { selector: ".metricCardContent span" }).nextElementSibling?.textContent;
}

function shortcutLabels() {
  return within(screen.getByRole("navigation", { name: "Warehouse shortcuts" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

function requestedPaths() {
  return new Set(access.request.mock.calls.map(([path]) => path));
}

function countCalls(path: string) {
  return access.request.mock.calls.filter(([calledPath]) => calledPath === path).length;
}
