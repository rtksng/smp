import { HeroUIProvider } from "@heroui/system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryManagementPage } from "./inventory-management";

const mocks = vi.hoisted(() => ({
  isSuperAdmin: false,
  request: vi.fn(),
  search: ""
}));

vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({
    api: { request: mocks.request },
    hasPermission: () => true,
    isSuperAdmin: mocks.isSuperAdmin
  }),
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("../admin-shell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.search)
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled, "aria-label": label }: { children: ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean; "aria-label"?: string }) => (
    <select aria-label={label} disabled={disabled} onChange={(event) => onValueChange(event.target.value)} value={value}>
      <option value="">Select</option>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const pune = { code: "PUN-01", id: "11111111-1111-4111-8111-111111111111", name: "Pune Central", status: "ACTIVE" };
const mumbai = { code: "MUM-01", id: "22222222-2222-4222-8222-222222222222", name: "Mumbai Hub", status: "ACTIVE" };
const gloves = {
  expirySensitive: true,
  id: "33333333-3333-4333-8333-333333333333",
  mrp: 120,
  name: "Surgical Gloves",
  sellingPrice: 100,
  sku: "GLV-01",
  status: "ACTIVE",
  variants: [],
  warehouseIds: [pune.id, mumbai.id],
  warehouses: [pune, mumbai]
};
const masks = {
  ...gloves,
  expirySensitive: false,
  id: "44444444-4444-4444-8444-444444444444",
  name: "Face Masks",
  sku: "MSK-01",
  warehouseIds: [mumbai.id],
  warehouses: [mumbai]
};
const page = <T,>(items: T[]) => ({
  items,
  pagination: { hasNextPage: false, hasPreviousPage: false, limit: 100, page: 1, total: items.length, totalPages: 1 }
});
const batches = [
  { batchNumber: "GLV-A", expiryDate: "2027-03-01", id: "batch-a", mrp: 120, productId: gloves.id, purchasePrice: 60, quantity: 8, sellingPrice: 100, variantId: null, warehouseId: pune.id },
  { batchNumber: "GLV-B", expiryDate: null, id: "batch-b", mrp: 120, productId: gloves.id, purchasePrice: 60, quantity: 0, sellingPrice: 100, variantId: null, warehouseId: pune.id }
];
const stockLine = { availableQuantity: 8, id: "stock-1", lowStockThreshold: 10, productId: gloves.id, reservedQuantity: 2, stockStatus: "LOW_STOCK", variantId: null, warehouseId: pune.id };

let warehouses = [pune];
const posts: Array<{ body: Record<string, unknown>; path: string }> = [];
const clients: QueryClient[] = [];

beforeEach(() => {
  warehouses = [pune];
  mocks.request.mockImplementation(async (path: string, init?: { body?: string; method?: string; query?: Record<string, unknown> }) => {
    if (init?.method === "POST") {
      posts.push({ body: JSON.parse(String(init.body)), path });
      return {};
    }
    if (path === "/admin/warehouses") return page(warehouses);
    if (path === "/admin/products") {
      return page([gloves, masks].filter((product) => product.warehouseIds.includes(String(init?.query?.warehouseId))));
    }
    if (path === `/admin/products/${gloves.id}`) return gloves;
    if (path === `/admin/products/${masks.id}`) return masks;
    if (path === "/admin/inventory") return page(init?.query?.warehouseId === pune.id ? [stockLine] : []);
    if (path === "/admin/inventory/batches") return init?.query?.warehouseId === pune.id ? batches : [];
    throw new Error(`Unexpected request ${path}`);
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  mocks.isSuperAdmin = false;
  mocks.request.mockReset();
  mocks.search = "";
  posts.length = 0;
});

function renderActions() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  clients.push(client);
  render(
    <HeroUIProvider disableAnimation>
      <QueryClientProvider client={client}>
        <InventoryManagementPage view="actions" />
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

async function chooseGloves() {
  const product = screen.getByRole("combobox", { name: "Product" });
  await within(product).findByRole("option", { name: "Surgical Gloves (GLV-01)" });
  fireEvent.change(product, { target: { value: gloves.id } });
  await screen.findByRole("group", { name: "Current stock" });
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function confirmAction(name: string) {
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name }));
  await waitFor(() => expect(posts).toHaveLength(1));
}

describe("inventory stock actions", () => {
  it("receives stock into the only warehouse of a staff member, filling prices and threshold", async () => {
    renderActions();
    // Staff with one warehouse always work in it.
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Warehouse" })).toHaveValue(pune.id));
    await chooseGloves();
    expect(within(screen.getByRole("group", { name: "Current stock" })).getByText("low stock")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Low-stock threshold")).toHaveValue("10"));
    expect(screen.getByLabelText("Selling price")).toHaveValue("100");
    expect(screen.getByLabelText("MRP")).toHaveValue("120");

    fill("Batch number", "GLV-C");
    fill("Units received", "25");
    fill("Purchase price per unit", "60");
    fireEvent.click(screen.getByRole("button", { name: "Receive stock" }));
    expect(await screen.findByText("This product is expiry tracked, so the batch needs an expiry date.")).toBeInTheDocument();

    fill("Expiry date", "2027-06-30");
    fireEvent.click(screen.getByRole("button", { name: "Receive stock" }));
    expect(
      await screen.findByText("Receive 25 units of Surgical Gloves into Pune Central under batch GLV-C?")
    ).toBeInTheDocument();
    await confirmAction("Receive stock");

    expect(posts[0]).toEqual({
      body: {
        batchNumber: "GLV-C",
        expiryDate: "2027-06-30",
        lowStockThreshold: 10,
        mrp: 120,
        productId: gloves.id,
        purchasePrice: 60,
        quantity: 25,
        sellingPrice: 100,
        variantId: null,
        warehouseId: pune.id
      },
      path: "/admin/inventory/stock-in"
    });
    expect(await screen.findByText("Received 25 units of Surgical Gloves.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View in movement log" })).toHaveAttribute(
      "href",
      `/inventory/movements?productId=${gloves.id}&warehouseId=${pune.id}`
    );
  });

  it("removes damaged units from a batch with stock and never more than it holds", async () => {
    renderActions();
    fireEvent.click(await screen.findByRole("radio", { name: /Remove stock/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Warehouse" })).toHaveValue(pune.id));
    await chooseGloves();

    // Empty batches have nothing to remove, so they are not offered.
    const batch = screen.getByRole("combobox", { name: "Batch" });
    await within(batch).findByRole("option", { name: /GLV-A · 8 units/ });
    expect(within(batch).queryByRole("option", { name: /GLV-B/ })).not.toBeInTheDocument();
    fireEvent.change(batch, { target: { value: "GLV-A" } });
    fill("Units to remove", "9");
    fireEvent.change(screen.getByRole("combobox", { name: "Reason" }), { target: { value: "DAMAGED" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove stock" }));
    expect(await screen.findByText("Batch GLV-A has only 8 units.")).toBeInTheDocument();

    fill("Units to remove", "3");
    fill("Notes", "Torn packs");
    fireEvent.click(screen.getByRole("button", { name: "Remove stock" }));
    await confirmAction("Remove stock");

    expect(posts[0]).toEqual({
      body: {
        batchNumber: "GLV-A",
        notes: "Torn packs",
        productId: gloves.id,
        quantity: 3,
        reason: "DAMAGED",
        variantId: null,
        warehouseId: pune.id
      },
      path: "/admin/inventory/stock-out"
    });
  });

  it("turns a shelf count into the difference the system should record", async () => {
    renderActions();
    fireEvent.click(await screen.findByRole("radio", { name: /Correct a count/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Warehouse" })).toHaveValue(pune.id));
    await chooseGloves();

    const batch = screen.getByRole("combobox", { name: "Batch" });
    await within(batch).findByRole("option", { name: /GLV-A · 8 units/ });
    fireEvent.change(batch, { target: { value: "GLV-A" } });
    fill("Units counted", "8");
    fill("Reason", "Cycle count");
    fireEvent.click(screen.getByRole("button", { name: "Correct a count" }));
    expect(
      await screen.findByText("Batch GLV-A already shows 8 units, so there is nothing to correct.")
    ).toBeInTheDocument();

    fill("Units counted", "5");
    expect(screen.getByText("System shows 8. Change: −3 units.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Correct a count" }));
    await confirmAction("Save count");

    expect(posts[0]).toEqual({
      body: {
        batchNumber: "GLV-A",
        productId: gloves.id,
        quantityDelta: -3,
        reason: "Cycle count",
        variantId: null,
        warehouseId: pune.id
      },
      path: "/admin/inventory/adjust"
    });
  });

  it("transfers only to another warehouse that also stocks the product", async () => {
    mocks.isSuperAdmin = true;
    warehouses = [pune, mumbai];
    mocks.search = `warehouseId=${pune.id}`;
    renderActions();
    fireEvent.click(await screen.findByRole("radio", { name: /Transfer stock/ }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "From warehouse" })).toHaveValue(pune.id));
    await chooseGloves();

    const destination = screen.getByRole("combobox", { name: "To warehouse" });
    expect(
      within(destination).getAllByRole("option").map((option) => option.textContent).filter((label) => label !== "Select")
    ).toEqual(["Mumbai Hub (MUM-01)"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Batch" }), { target: { value: "GLV-A" } });
    fill("Units to move", "4");
    fireEvent.change(destination, { target: { value: mumbai.id } });
    fireEvent.click(screen.getByRole("button", { name: "Transfer stock" }));
    expect(await screen.findByText("Move 4 units of Surgical Gloves from Pune Central to Mumbai Hub?")).toBeInTheDocument();
    await confirmAction("Transfer stock");

    expect(posts[0]).toEqual({
      body: {
        batchNumber: "GLV-A",
        fromWarehouseId: pune.id,
        productId: gloves.id,
        quantity: 4,
        toWarehouseId: mumbai.id,
        variantId: null
      },
      path: "/admin/inventory/transfer"
    });
  });

  it("offers only products assigned to the warehouse and stops a linked product that is not", async () => {
    mocks.search = `productId=${masks.id}`;
    renderActions();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Warehouse" })).toHaveValue(pune.id));

    expect(
      await screen.findByText("Face Masks is not assigned to Pune Central. Ask the super admin to assign it.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Current stock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive stock" })).not.toBeInTheDocument();
    const product = screen.getByRole("combobox", { name: "Product" });
    await within(product).findByRole("option", { name: "Surgical Gloves (GLV-01)" });
    expect(within(product).queryByRole("option", { name: /Face Masks/ })).not.toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/admin/products",
      expect.objectContaining({ query: expect.objectContaining({ warehouseId: pune.id }) })
    );
  });
});
