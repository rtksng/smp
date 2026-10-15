import { HeroUIProvider } from "@heroui/system";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm, ProductManagementPage } from "./product-management";
import type { AdminProduct } from "../../lib/product-form";
import type { AdminWarehouse } from "../../lib/warehouse-management";

const mocks = vi.hoisted(() => ({ isSuperAdmin: true, request: vi.fn() }));

vi.mock("@/lib/admin-session", () => ({
  useAdminSession: () => ({
    api: { request: mocks.request, requestResponse: vi.fn() },
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
  useSearchParams: () => new URLSearchParams()
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

const pune = { city: "Pune", code: "PUN-01", id: "warehouse-pune", name: "Pune Central", state: "Maharashtra", status: "ACTIVE" } as AdminWarehouse;
const mumbai = { city: "Mumbai", code: "MUM-01", id: "warehouse-mumbai", name: "Mumbai Hub", state: "Maharashtra", status: "ACTIVE" } as AdminWarehouse;
const product = {
  basePrice: 90,
  brand: { id: "brand-1", name: "Acme", slug: "acme" },
  brandId: "brand-1",
  category: { id: "category-1", name: "Gloves", slug: "gloves" },
  categoryId: "category-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  description: "Powder-free nitrile gloves.",
  disposable: true,
  documents: [],
  expirySensitive: true,
  id: "product-1",
  images: [],
  inStock: true,
  material: null,
  medicalSpecialty: null,
  metaDescription: null,
  metaTitle: null,
  mrp: 120,
  name: "Surgical Gloves",
  packSize: null,
  searchTags: [],
  sellingPrice: 100,
  shortDescription: "Nitrile gloves.",
  sku: "GLV-01",
  slug: "surgical-gloves",
  status: "ACTIVE",
  sterile: true,
  subcategory: null,
  subcategoryId: null,
  taxRate: 12,
  unit: "box",
  updatedAt: "2026-10-01T00:00:00.000Z",
  stock: { availableQuantity: 4, reservedQuantity: 0, status: "LOW_STOCK" },
  variants: [],
  warehouseIds: [pune.id],
  warehouses: [{ code: pune.code, id: pune.id, name: pune.name, status: "ACTIVE" }]
} as unknown as AdminProduct;
const paginated = <T,>(items: T[], total = items.length) => ({
  items,
  pagination: { hasNextPage: false, hasPreviousPage: false, limit: 20, page: 1, total, totalPages: 1 }
});
const clients: QueryClient[] = [];

function mount(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  clients.push(client);
  render(
    <HeroUIProvider disableAnimation>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </HeroUIProvider>
  );
}

function productListQueries() {
  return mocks.request.mock.calls
    .filter(([path, init]) => path === "/admin/products" && init?.query?.limit !== 1)
    .map(([, init]) => init.query as Record<string, unknown>);
}

beforeEach(() => {
  mocks.request.mockImplementation(async (path: string, init?: { query?: Record<string, unknown> }) => {
    if (path === "/admin/products") {
      return init?.query?.limit === 1 ? paginated([], init.query.stockStatus ? 2 : 9) : paginated([product]);
    }
    if (path === "/admin/warehouses") return paginated([pune, mumbai]);
    return [];
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  mocks.isSuperAdmin = true;
  mocks.request.mockReset();
});

describe("product list scoped by warehouse", () => {
  it("searches and filters by stock status and warehouse straight from the toolbar", async () => {
    mount(<ProductManagementPage view="list" />);

    expect(await screen.findByText("Surgical Gloves")).toBeInTheDocument();
    expect(screen.getByText("Pune Central")).toBeInTheDocument();
    const toolbar = screen.getByRole("group", { name: "Filter by stock" });

    fireEvent.click(within(toolbar).getByRole("button", { name: "Low stock" }));
    await waitFor(() => expect(productListQueries().at(-1)).toMatchObject({ stockStatus: "LOW_STOCK" }));
    expect(within(toolbar).getByRole("button", { name: "Low stock" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByRole("textbox", { name: "Search products by name or SKU" }), {
      target: { value: "GLV" }
    });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() =>
      expect(productListQueries().at(-1)).toMatchObject({ search: "GLV", stockStatus: "LOW_STOCK" })
    );

    const warehouse = screen.getByRole("combobox", { name: "Warehouse" });
    const unassigned = within(warehouse).getByRole("option", { name: "Not assigned to any warehouse" });
    fireEvent.change(warehouse, { target: { value: (unassigned as HTMLOptionElement).value } });
    await waitFor(() => expect(productListQueries().at(-1)).toMatchObject({ unassigned: true }));
    fireEvent.change(warehouse, { target: { value: mumbai.id } });
    await waitFor(() => expect(productListQueries().at(-1)).toMatchObject({ warehouseId: mumbai.id }));
    expect(productListQueries().at(-1)?.unassigned).toBeUndefined();
  });

  it("tells warehouse staff that they see only their warehouses' products", async () => {
    mocks.isSuperAdmin = false;
    mount(<ProductManagementPage view="list" />);

    expect(await screen.findByText("Surgical Gloves")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You see the products assigned to your warehouses. Stock figures cover those warehouses only."
      )
    ).toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Warehouse" })).queryByRole("option", { name: "Not assigned to any warehouse" })).not.toBeInTheDocument();
  });
});

describe("product warehouse assignment", () => {
  const formProps = {
    brands: [],
    canSave: true,
    categories: [],
    isLookupLoading: false,
    isSaving: false,
    onSave: vi.fn(async () => undefined),
    onUploadError: vi.fn(),
    warehouseLookup: { isLoading: false, warehouses: [pune, mumbai] }
  };

  it("starts a staff member's new product in all of their warehouses and needs at least one", async () => {
    mount(<ProductForm {...formProps} editingProduct={null} isSuperAdmin={false} />);

    const choices = screen.getByRole("group", { name: "Product warehouses" });
    await waitFor(() => expect(within(choices).getByRole("checkbox", { name: "Pune Central (PUN-01)" })).toBeChecked());
    expect(within(choices).getByRole("checkbox", { name: "Mumbai Hub (MUM-01)" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByText("Choose at least one of your warehouses.")).toBeInTheDocument();
  });

  it("lets the super admin leave a new product unassigned, with a clear warning", async () => {
    mount(<ProductForm {...formProps} editingProduct={null} isSuperAdmin />);

    const choices = screen.getByRole("group", { name: "Product warehouses" });
    expect(within(choices).getByRole("checkbox", { name: "Pune Central (PUN-01)" })).not.toBeChecked();
    expect(
      screen.getByText("Not assigned to any warehouse yet, so no warehouse can see, stock, or sell it.")
    ).toBeInTheDocument();

    fireEvent.click(within(choices).getByRole("checkbox", { name: "Mumbai Hub (MUM-01)" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Not assigned to any warehouse yet, so no warehouse can see, stock, or sell it.")
      ).not.toBeInTheDocument()
    );
  });

  it("shows an existing product's warehouses when editing", async () => {
    mount(<ProductForm {...formProps} editingProduct={product} isSuperAdmin />);

    const choices = screen.getByRole("group", { name: "Product warehouses" });
    await waitFor(() => expect(within(choices).getByRole("checkbox", { name: "Pune Central (PUN-01)" })).toBeChecked());
    expect(within(choices).getByRole("checkbox", { name: "Mumbai Hub (MUM-01)" })).not.toBeChecked();
  });
});
