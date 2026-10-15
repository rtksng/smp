import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WarehouseDashboard } from "./warehouse-dashboard";
import { AdminApiClientError } from "../../lib/admin-api";
import type { WarehouseDashboard as WarehouseDashboardReport } from "../../lib/warehouse-dashboard";

const session = vi.hoisted(() => ({
  denied: new Set<string>(),
  isSuperAdmin: false,
  request: vi.fn()
}));

vi.mock("../../lib/admin-session", () => ({
  useAdminSession: () => ({
    api: { request: session.request },
    hasPermission: (permission: string) => !session.denied.has(permission),
    isSuperAdmin: session.isSuperAdmin
  })
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, "aria-label": label }: { children: ReactNode; value: string; onValueChange: (value: string) => void; "aria-label"?: string }) => (
    <select aria-label={label} onChange={(event) => onValueChange(event.target.value)} value={value}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const pune = { city: "Pune", code: "PUN-01", id: "warehouse-pune", name: "Pune Central", state: "Maharashtra", status: "ACTIVE" };
const mumbai = { city: "Mumbai", code: "MUM-01", id: "warehouse-mumbai", name: "Mumbai Hub", state: "Maharashtra", status: "ACTIVE" };
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function buildReport(overrides: Partial<WarehouseDashboardReport> = {}): WarehouseDashboardReport {
  return {
    dispatch: {
      awaitingPickup: 2,
      deliveredToday: 9,
      failedToday: 1,
      inTransit: 3,
      oldestReadySince: minutesAgo(200),
      readyToDispatch: 4
    },
    filters: { dateFrom: "2026-09-16", dateTo: "2026-10-15", warehouseId: null },
    fulfillment: {
      cancelled: 2,
      delivered: 38,
      deliveryAttempts: 40,
      deliverySuccessRate: 95,
      fulfillmentRate: 95,
      inProgress: 6,
      ordersPlaced: 46
    },
    generatedAt: new Date().toISOString(),
    queues: {
      activeDeliveries: [
        {
          assignedAt: minutesAgo(50),
          id: "assignment-1",
          orderId: "order-9",
          orderNumber: "SMP-1009",
          partnerMobile: "+919000000001",
          partnerName: "Ravi Driver",
          status: "OUT_FOR_DELIVERY",
          updatedAt: minutesAgo(5),
          warehouseName: "Pune Central"
        }
      ],
      dispatch: [
        {
          attempts: 1,
          createdAt: minutesAgo(200),
          customer: { businessName: "Sunrise Clinic", fullName: "Asha Rao", mobileNumber: "+919811111111" },
          grandTotal: 1250,
          id: "order-1",
          itemCount: 3,
          orderNumber: "SMP-1001",
          payment: { codAmount: 1250, method: "COD", status: "PENDING" },
          placedAt: minutesAgo(200),
          shippingAddress: { city: "Pune", pincode: "411001", state: "Maharashtra" },
          status: "PACKED",
          warehouse: { code: pune.code, id: pune.id, name: pune.name },
          warehouseId: pune.id
        }
      ],
      lowStock: [
        {
          availableQuantity: 0,
          id: "stock-1",
          lowStockThreshold: 10,
          productId: "product-1",
          productName: "Surgical Gloves",
          sku: "GLV-01",
          status: "OUT_OF_STOCK",
          variantId: "variant-1",
          variantName: "Size M",
          warehouseId: pune.id,
          warehouseName: pune.name
        }
      ],
      riders: [
        {
          activeDeliveries: 1,
          fullName: "Ravi Driver",
          id: "partner-1",
          isOnline: true,
          lastSeenAt: minutesAgo(1),
          mobileNumber: "+919000000001",
          vehicleNumber: "MH12AB1234"
        },
        {
          activeDeliveries: 0,
          fullName: "Kiran Rider",
          id: "partner-2",
          isOnline: false,
          lastSeenAt: null,
          mobileNumber: "+919000000002",
          vehicleNumber: null
        }
      ]
    },
    riders: { assigned: 2, available: 0, onDelivery: 1, online: 1 },
    stock: {
      assignedProducts: 86,
      availableUnits: 12480,
      inStockItems: 80,
      lowStockItems: 5,
      nearExpiryBatches: 3,
      nearExpiryDays: 30,
      outOfStockItems: 2,
      reservedUnits: 340,
      trackedItems: 87
    },
    todayDate: "2026-10-15",
    warehouse: pune,
    warehouseOptions: [pune],
    ...overrides
  };
}

const clients: QueryClient[] = [];

function renderDashboard(initialWarehouseId = "") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <WarehouseDashboard initialWarehouseId={initialWarehouseId} />
    </QueryClientProvider>
  );
}

function kpi(label: string) {
  const metrics = screen.getByRole("region", { name: "Key warehouse metrics" });
  const tile = within(metrics).getByText(label).closest(".dashboardKpi");

  if (!(tile instanceof HTMLElement)) {
    throw new Error(`Missing KPI tile ${label}`);
  }

  return tile;
}

beforeEach(() => {
  session.request.mockResolvedValue(buildReport());
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  session.denied.clear();
  session.isSuperAdmin = false;
  session.request.mockReset();
});

describe("Warehouse dashboard", () => {
  it("leads with the four headline figures for the signed-in warehouse", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: "Pune Central" })).toBeInTheDocument();
    expect(screen.getByText("Pune Central", { selector: "strong" })).toBeInTheDocument();
    expect(kpi("Active stock")).toHaveTextContent("12,480");
    expect(kpi("Active stock")).toHaveTextContent("Units available across 86 products");
    expect(kpi("Pending dispatches")).toHaveTextContent("4");
    expect(kpi("Pending dispatches")).toHaveTextContent("Oldest has waited 3h 20m");
    expect(kpi("Assigned riders")).toHaveTextContent("2");
    // Orders are waiting and nobody is free, so the tile says so in words, not only colour.
    expect(kpi("Assigned riders")).toHaveTextContent("No free rider is online for the waiting orders");
    expect(kpi("Fulfilment rate")).toHaveTextContent("95%");
    expect(kpi("Fulfilment rate")).toHaveTextContent("38 delivered of 40 closed orders, last 30 days");

    const [path, options] = session.request.mock.calls[0]!;
    expect(path).toBe("/admin/reports/warehouse-dashboard");
    expect(options.query).toEqual({
      dateFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      warehouseId: undefined
    });
  });

  it("turns each figure and queue into a next step on the right screen", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Pune Central" });

    expect(kpi("Active stock")).toHaveAttribute("href", `/inventory?warehouseId=${pune.id}`);
    expect(kpi("Pending dispatches")).toHaveAttribute("href", `/delivery/assign?warehouseId=${pune.id}`);
    expect(screen.getByRole("link", { name: "Assign a rider to SMP-1001" })).toHaveAttribute(
      "href",
      `/delivery/assign?orderId=order-1&warehouseId=${pune.id}`
    );
    expect(screen.getByRole("link", { name: "Receive stock for Surgical Gloves (Size M)" })).toHaveAttribute(
      "href",
      `/inventory/actions?action=receive&productId=product-1&variantId=variant-1&warehouseId=${pune.id}`
    );
    expect(screen.getByRole("link", { name: "SMP-1009" })).toHaveAttribute(
      "href",
      "/delivery/assignments?search=SMP-1009"
    );
    expect(screen.getByRole("link", { name: "1 delivery failed today" })).toHaveAttribute(
      "href",
      `/delivery/assignments?status=FAILED&warehouseId=${pune.id}`
    );

    const stockHealth = screen.getByRole("region", { name: "Stock health" });
    expect(within(stockHealth).getByRole("img")).toHaveAccessibleName("In stock: 80, Low stock: 5, Out of stock: 2");
    expect(within(stockHealth).getByRole("link", { name: "Out of stock: 2. Open in inventory" })).toHaveAttribute(
      "href",
      `/inventory?stockStatus=OUT_OF_STOCK&warehouseId=${pune.id}`
    );

    const queue = screen.getByRole("region", { name: /Ready to dispatch/ });
    expect(within(queue).getByText("Collect ₹1,250 cash · Pune 411001")).toBeInTheDocument();
    expect(within(queue).getByText("Redelivery: 1 earlier attempt did not complete")).toBeInTheDocument();
    expect(within(queue).getByText("Waiting 3h 20m")).toBeInTheDocument();

    const riders = screen.getByRole("region", { name: /Riders/ });
    expect(within(riders).getByText("1 active delivery")).toBeInTheDocument();
    expect(within(riders).getByText("Not seen online yet")).toBeInTheDocument();
  });

  it("shows figures without action links the admin may not use", async () => {
    session.denied = new Set(["delivery.assign", "inventory.update", "inventory.read"]);
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Pune Central" });

    expect(kpi("Pending dispatches").tagName).toBe("DIV");
    expect(kpi("Active stock").tagName).toBe("DIV");
    expect(screen.queryByRole("link", { name: /Assign a rider/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Receive stock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open in inventory/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SMP-1009" })).toBeInTheDocument();
  });

  it("lets an admin with several warehouses focus on one", async () => {
    session.request.mockImplementation(async (_path: string, options: { query: { warehouseId?: string } }) =>
      options.query.warehouseId === mumbai.id
        ? buildReport({ warehouse: mumbai, warehouseOptions: [mumbai, pune] })
        : buildReport({ warehouse: null, warehouseOptions: [mumbai, pune] })
    );
    renderDashboard();

    expect(await screen.findByRole("heading", { level: 1, name: "All my warehouses" })).toBeInTheDocument();
    expect(screen.getByText("2 warehouses")).toBeInTheDocument();
    // With several warehouses in view, queue rows say which warehouse they belong to.
    expect(within(screen.getByRole("region", { name: /Needs restock/ })).getByText("SKU GLV-01 · Pune Central")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Warehouse"), { target: { value: mumbai.id } });

    expect(await screen.findByRole("heading", { level: 1, name: "Mumbai Hub" })).toBeInTheDocument();
    expect(session.request).toHaveBeenLastCalledWith("/admin/reports/warehouse-dashboard", {
      query: expect.objectContaining({ warehouseId: mumbai.id })
    });
  });

  it("changes only the fulfilment period when another range is picked", async () => {
    renderDashboard();
    await screen.findByRole("heading", { level: 1, name: "Pune Central" });
    // A single warehouse needs no warehouse picker.
    expect(screen.queryByLabelText("Warehouse")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Fulfilment period"), { target: { value: "7" } });

    await waitFor(() => expect(session.request).toHaveBeenCalledTimes(2));
    const { dateFrom, dateTo } = session.request.mock.calls[1]![1].query as { dateFrom: string; dateTo: string };
    expect((Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000).toBe(6);
    expect(await screen.findByText("38 delivered of 40 closed orders, last 7 days")).toBeInTheDocument();
  });

  it("tells staff without a warehouse who can add them", async () => {
    session.request.mockResolvedValue(buildReport({ warehouse: null, warehouseOptions: [] }));
    renderDashboard();

    expect(await screen.findByText("You are not assigned to a warehouse")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Key warehouse metrics" })).not.toBeInTheDocument();
  });

  it("offers a way back when the linked warehouse is out of reach", async () => {
    session.request.mockImplementation(async (_path: string, options: { query: { warehouseId?: string } }) => {
      if (options.query.warehouseId) {
        throw new AdminApiClientError("Admin is not assigned to this warehouse.", 403);
      }
      return buildReport();
    });
    renderDashboard(mumbai.id);

    expect(await screen.findByRole("alert")).toHaveTextContent("Admin is not assigned to this warehouse.");
    fireEvent.click(screen.getByRole("button", { name: "Show all my warehouses" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Pune Central" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
