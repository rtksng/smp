import { HeroUIProvider } from "@heroui/system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBulkResourceFixture, fixtureId } from "@/test/bulk-resource-fixture";
import { BrandManagementPage } from "./brands/_components/brand-management";
import { CategoryManagementPage } from "./categories/_components/category-management";
import { CouponListPage } from "./coupons/_components/coupon-sections";
import { DeliveryChargeRulesPage } from "./delivery-charges/_components/delivery-charge-sections";
import { CustomersLandingPage } from "./customers/_components/customer-sections";
import { QuoteRequestQueuePage } from "./quote-requests/_components/quote-request-sections";
import { InventoryManagementPage } from "./inventory/inventory-management";

const mocks = vi.hoisted(() => ({ request: vi.fn(), permissions: true, search: "" }));
vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({ api: mocks, hasPermission: () => mocks.permissions }),
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("./admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
    "aria-label": label
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    "aria-label"?: string;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null
}));
const clients: QueryClient[] = [];
let fixture: ReturnType<typeof createBulkResourceFixture>;
function mount(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  clients.push(client);
  return render(
    <HeroUIProvider disableAnimation>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </HeroUIProvider>
  );
}
const selectPage = () =>
  fireEvent.click(screen.getByRole("checkbox", { name: "Select current page" }));
const choose = (value: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: "Bulk action" }), {
    target: { value }
  });
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
async function process(count: number) {
  fireEvent.click(screen.getByRole("button", { name: "Review selected" }));
  expect(await screen.findByText(`${count} ready to process`)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", {
      name: `Process ${count} ${count === 1 ? "record" : "records"}`
    })
  );
  await screen.findByRole("heading", { name: "Processing results" });
}
async function done() {
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Processing results" })
    ).not.toBeInTheDocument()
  );
}
const writes = () => fixture.calls.filter((call) => call.method !== "GET");
beforeEach(() => {
  fixture = createBulkResourceFixture();
  mocks.permissions = true;
  mocks.search = "";
  mocks.request.mockImplementation(fixture.request);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.resetAllMocks();
});

describe("bulk workflows for the additional admin modules", () => {
  it.each([
    ["Brands", () => <BrandManagementPage view="list" />, "QA brand 1", "brands"],
    [
      "Categories",
      () => <CategoryManagementPage view="list" />,
      "QA category 1",
      "categories"
    ],
    ["Coupons", () => <CouponListPage />, "QA-COUPON-1", "coupons"],
    ["Delivery Charges", () => <DeliveryChargeRulesPage />, "QA rule 1", "rules"]
  ] as const)(
    "%s: selects, deactivates, skips, refreshes, activates, and archives where supported",
    async (_name, page, label, collection) => {
      mount(page());
      await screen.findByText(label);
      const original = JSON.stringify(
        fixture[collection].map(({ isActive: _active, ...rest }) => rest)
      );
      selectPage();
      choose("deactivate");
      expect(writes()).toHaveLength(0);
      await process(2);
      expect(fixture[collection].every((item) => !item.isActive)).toBe(true);
      expect(writes()).toHaveLength(2);
      expect(
        writes().every((call) => JSON.stringify(call.body) === '{"isActive":false}')
      ).toBe(true);
      expect(
        JSON.stringify(
          fixture[collection].map(({ isActive: _active, ...rest }) => rest)
        )
      ).toBe(original);
      await done();
      expect(screen.getByText("1 selected")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      selectPage();
      choose("activate");
      await process(3);
      await done();
      expect(fixture[collection].every((item) => item.isActive)).toBe(true);
      if (collection === "coupons" || collection === "rules") {
        selectPage();
        choose("archive");
        await process(3);
        await done();
        expect(fixture.archived.size).toBe(3);
        expect(screen.queryByText(label)).not.toBeInTheDocument();
        expect(screen.getByText("0 selected")).toBeInTheDocument();
      }
    },
    15000
  );

  it("updates child categories independently and keeps the parent hierarchy", async () => {
    mount(<CategoryManagementPage view="list" />);
    const rootName = await screen.findByText("QA category 1");
    const rootRow = rootName.closest("tr")!;
    fireEvent.click(within(rootRow).getByRole("button", { name: "Edit" }));
    await screen.findByText("QA child 1");
    selectPage();
    choose("deactivate");
    await process(1);
    await done();
    expect(fixture.categories[0]!.isActive).toBe(true);
    expect(
      fixture.categories[0]!.children.every(
        (item) => !item.isActive && item.parentId === fixture.categories[0]!.id
      )
    ).toBe(true);
    expect(writes()[0]!.path).toContain(fixtureId(25));
  });

  it("marks quote requests contacted and closes them while preserving converted references", async () => {
    mount(<QuoteRequestQueuePage />);
    await screen.findByText("QA quote 1");
    selectPage();
    choose("CONTACTED");
    await process(1);
    await done();
    expect(fixture.quotes.map((item) => item.status)).toEqual([
      "CONTACTED",
      "CONTACTED",
      "CLOSED"
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    selectPage();
    choose("CLOSED");
    await process(2);
    await done();
    expect(fixture.quotes.every((item) => item.status === "CLOSED")).toBe(true);
    expect(fixture.quotes[2]!.convertedCartId).toBe(fixtureId(90));
    expect(writes().every((call) => call.path.endsWith("/status"))).toBe(true);
  });

  it("requires an account reason and blocks, activates, and deactivates selected customers", async () => {
    mount(<CustomersLandingPage />);
    await screen.findByText("QA customer 1");
    selectPage();
    choose("BLOCKED");
    expect(screen.getByRole("button", { name: "Review selected" })).toBeDisabled();
    fill("Account status note", "QA account verification");
    await process(2);
    await done();
    expect(
      fixture.customers.every((item) => item.status === "BLOCKED" && !item.isActive)
    ).toBe(true);
    expect(writes()[0]!.body).toEqual({
      note: "QA account verification",
      status: "BLOCKED"
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    selectPage();
    choose("ACTIVE");
    await process(3);
    await done();
    expect(fixture.customers.every((item) => item.isActive)).toBe(true);
    selectPage();
    choose("INACTIVE");
    await process(3);
    await done();
    expect(
      fixture.customers.every((item) => item.status === "INACTIVE" && !item.isActive)
    ).toBe(true);
  });

  it("selects all 21 filtered customers across pages and processes each explicit ID once", async () => {
    const customer = fixture.customers[0]!;
    fixture.customers.splice(
      0,
      3,
      ...Array.from({ length: 21 }, (_, i) => ({
        ...customer,
        id: fixtureId(400 + i),
        name: `QA account ${i + 1}`
      }))
    );
    mount(<CustomersLandingPage />);
    await screen.findByText("QA account 1");
    fireEvent.click(screen.getByRole("button", { name: "Select all 21 filtered" }));
    await screen.findByText("21 selected");
    choose("INACTIVE");
    fill("Account status note", "QA only");
    await process(21);
    await done();
    expect(new Set(writes().map((call) => call.path)).size).toBe(21);
    expect(fixture.customers.every((item) => item.status === "INACTIVE")).toBe(true);
  }, 15000);

  it("shows a coupon failure and retries only that failed record", async () => {
    fixture.failOnce.add(`/admin/coupons/${fixture.coupons[1]!.id}`);
    mount(<CouponListPage />);
    await screen.findByText("QA-COUPON-1");
    selectPage();
    choose("deactivate");
    await process(2);
    expect(await screen.findByText("Temporary QA service failure")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review failed records" }));
    fireEvent.click(await screen.findByRole("button", { name: "Process 1 record" }));
    await screen.findByRole("heading", { name: "Processing results" });
    expect(
      writes().filter((call) => call.path.endsWith(fixture.coupons[0]!.id))
    ).toHaveLength(1);
    expect(
      writes().filter((call) => call.path.endsWith(fixture.coupons[1]!.id))
    ).toHaveLength(2);
    await done();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("adjusts and transfers explicit inventory batches with insufficient-stock skips and movement records", async () => {
    mount(<InventoryManagementPage view="overview" />);
    await screen.findByRole("heading", { name: "Current aggregate stock" });
    await screen.findByRole("checkbox", { name: "Select current page" });
    selectPage();
    choose("adjust");
    fill("Quantity change per batch", "-2");
    fill("Stock movement reason", "QA count correction");
    expect(screen.getByRole("button", { name: "Review selected" })).toBeDisabled();
    for (let i = 1; i <= 3; i++)
      fill(`Batch number for QA product ${i} / QA warehouse 1`, `QA-BATCH-${i}`);
    await process(2);
    await done();
    expect(fixture.stocks.slice(0, 3).map((item) => item.availableQuantity)).toEqual([
      8, 3, 1
    ]);
    expect(fixture.movements).toHaveLength(2);
    expect(
      fixture.stocks.every(
        (item) => item.lowStockThreshold === 2 && item.reservedQuantity === 0
      )
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    selectPage();
    choose("transfer");
    fill("Quantity per batch", "2");
    fireEvent.change(screen.getByRole("combobox", { name: "Destination warehouse" }), {
      target: { value: fixture.warehouses[1]!.id }
    });
    await process(2);
    await done();
    expect(fixture.stocks.slice(0, 3).map((item) => item.availableQuantity)).toEqual([
      6, 1, 1
    ]);
    expect(
      fixture.stocks
        .filter((item) => item.warehouseId === fixture.warehouses[1]!.id)
        .map((item) => item.availableQuantity)
    ).toEqual([2, 2]);
    expect(fixture.movements).toHaveLength(4);
  }, 15000);

  it("does not offer retry for stock changes when the connection fails after saving", async () => {
    fixture.failAfterSave.add("/admin/inventory/adjust");
    mount(<InventoryManagementPage view="overview" />);
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Select QA product 1 / QA warehouse 1"
      })
    );
    choose("adjust");
    fill("Quantity change per batch", "1");
    fill("Stock movement reason", "QA adjustment");
    fill("Batch number for QA product 1 / QA warehouse 1", "QA-BATCH-1");
    await process(1);
    expect(fixture.stocks[0]!.availableQuantity).toBe(11);
    expect(fixture.movements).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Review failed records" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Connection lost after saving. Check inventory movements.")
    ).toBeInTheDocument();
  });

  it("uses selected near-expiry batch numbers without asking for manual batch entry", async () => {
    mocks.search = "nearExpiry=true";
    mount(<InventoryManagementPage view="overview" />);
    await screen.findByRole("checkbox", { name: "Select QA-BATCH-1" });
    selectPage();
    choose("adjust");
    fill("Quantity change per batch", "1");
    fill("Stock movement reason", "QA batch count");
    expect(
      screen.queryByRole("textbox", { name: /Batch number for/ })
    ).not.toBeInTheDocument();
    await process(3);
    await done();
    expect(fixture.batches.map((item) => item.quantity)).toEqual([11, 6, 2]);
    expect(writes().map((call) => call.body?.batchNumber)).toEqual([
      "QA-BATCH-1",
      "QA-BATCH-2",
      "QA-BATCH-3"
    ]);
  });

  it("returns to a valid coupon page after archiving the last page", async () => {
    const coupon = fixture.coupons[0]!;
    fixture.coupons.splice(
      0,
      3,
      ...Array.from({ length: 21 }, (_, i) => ({
        ...coupon,
        id: fixtureId(500 + i),
        code: `QA-PAGED-${i + 1}`
      }))
    );
    mount(<CouponListPage />);
    await screen.findByText("QA-PAGED-1");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("QA-PAGED-21");
    selectPage();
    choose("archive");
    await process(1);
    await done();
    expect(await screen.findByText("QA-PAGED-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(fixture.archived.size).toBe(1);
  });

  it.each([
    ["Brands", () => <BrandManagementPage view="list" />],
    ["Categories", () => <CategoryManagementPage view="list" />],
    ["Customers", () => <CustomersLandingPage />],
    ["Inventory", () => <InventoryManagementPage view="overview" />]
  ] as const)(
    "%s: hides bulk mutation controls without update permission",
    async (_name, page) => {
      mocks.permissions = false;
      mount(page());
      await waitFor(() => expect(mocks.request).toHaveBeenCalled());
      expect(
        screen.queryByRole("checkbox", { name: "Select current page" })
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Bulk actions")).not.toBeInTheDocument();
    }
  );
});
