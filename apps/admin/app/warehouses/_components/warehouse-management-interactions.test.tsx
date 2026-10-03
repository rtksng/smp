import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { WarehouseFilters } from "../../../lib/warehouse-management";
import { WarehouseManagementPage } from "./warehouse-management";

const { request, push, access } = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn(), access: { allowed: true } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../admin-shell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission: () => access.allowed }),
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
  PermissionGate: ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) => access.allowed ? children : fallback
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled, "aria-label": label }: { children: ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean; "aria-label"?: string }) => <select aria-label={label} disabled={disabled} value={value} onChange={(event) => onValueChange(event.target.value)}><option value="">Select</option>{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null
}));

const warehouse = {
  id: "warehouse-1", name: "QA warehouse", code: "1", address: "Plot 1", city: "Pune", state: "Maharashtra",
  pincode: "411001", contactPerson: "QA Contact", contactNumber: "9000000000", latitude: null, longitude: null,
  status: "INACTIVE", createdAt: "2026-09-04", updatedAt: "2026-09-04"
};
const adminId = "daaa9716-a744-4a6e-9015-9e9da8ea5912";
const assignment = { id: "assignment-1", adminUserId: adminId, warehouseId: warehouse.id, firstName: "QA", lastName: "Staff", email: "qa@example.test" };
const candidate = { adminUserId: adminId, firstName: "QA", lastName: "Staff", email: "qa@example.test", role: { code: "WAREHOUSE_MANAGER", id: "role-1", name: "Warehouse manager" } };
const candidateLabel = "QA Staff (qa@example.test) - Warehouse manager";
const response = (page = 1, totalPages = 1) => ({ items: [{ ...warehouse, id: `warehouse-${page}` }], pagination: { page, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1, limit: 100, total: totalPages * 100 } });
const clients: QueryClient[] = [];

function mount(view: "create" | "list" | "staff", edit = false, initialFilters: WarehouseFilters | null = null, returnToPath: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><WarehouseManagementPage view={view} initialEditWarehouseId={edit ? warehouse.id : null} initialFilters={initialFilters} returnToPath={returnToPath} /></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  access.allowed = true;
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method) return warehouse;
    if (path.endsWith("/staff/candidates")) return [];
    if (path.endsWith("/staff")) return [];
    return path === "/admin/warehouses" ? response() : warehouse;
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.resetAllMocks(); });

it("keeps an unsaved edit during background refresh and saves details and status with one request", async () => {
  const client = mount("create", true);
  const name = await screen.findByRole("textbox", { name: "Warehouse name" });
  await waitFor(() => expect(name).toHaveValue("QA warehouse"));
  fireEvent.change(name, { target: { value: "Edited warehouse" } });
  await act(async () => { client.setQueryData(["admin", "warehouses", warehouse.id], { ...warehouse, name: "Server refresh" }); });
  expect(name).toHaveValue("Edited warehouse");
  fireEvent.click(screen.getByRole("button", { name: "Save warehouse" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouses"));
  const mutations = request.mock.calls.filter(([, options]) => options?.method);
  expect(mutations).toHaveLength(1);
  expect(mutations[0]?.[0]).toBe(`/admin/warehouses/${warehouse.id}`);
  expect(JSON.parse(mutations[0]?.[1].body)).toMatchObject({ name: "Edited warehouse", code: "1", status: "INACTIVE" });
});

it("returns to the warehouse detail page after an edit opened from it", async () => {
  mount("create", true, null, "/warehouses/warehouse-1");
  const name = await screen.findByRole("textbox", { name: "Warehouse name" });
  await waitFor(() => expect(name).toHaveValue("QA warehouse"));
  expect(screen.getByRole("link", { name: "Back to warehouses" })).toHaveAttribute("href", "/warehouses/warehouse-1");
  fireEvent.click(screen.getByRole("button", { name: "Save warehouse" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouses/warehouse-1"));
});

it("opens each listed warehouse's detail page from its name and View action", async () => {
  mount("list");
  expect(await screen.findByRole("link", { name: "View QA warehouse" })).toHaveAttribute("href", "/warehouses/warehouse-1");
  expect(screen.getByRole("link", { name: "QA warehouse" })).toHaveAttribute("href", "/warehouses/warehouse-1");
});

it("preselects the warehouse passed to the staff page", async () => {
  mount("staff", false, { search: "", state: "", status: "", warehouseId: "warehouse-1" });
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/warehouses/warehouse-1/staff"));
  expect(request).toHaveBeenCalledWith("/admin/warehouses", expect.objectContaining({ query: expect.objectContaining({ warehouseId: "warehouse-1" }) }));
  expect(screen.getByRole("heading", { name: "QA warehouse" })).toBeInTheDocument();
});

it("shows a save error and lets a corrected retry clear it", async () => {
  let fail = true;
  request.mockImplementation(async (_path: string, options?: { method?: string }) => {
    if (options?.method && fail) throw new Error("Warehouse code already exists.");
    return warehouse;
  });
  mount("create", true);
  await screen.findByRole("textbox", { name: "Warehouse name" });
  fireEvent.click(screen.getByRole("button", { name: "Save warehouse" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Warehouse code already exists.");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Save warehouse" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouses"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows KPIs for every warehouse above the table and pages the table in the browser", async () => {
  const named = (from: number, count: number) => Array.from({ length: count }, (_, index) => ({ ...warehouse, id: `warehouse-${from + index}`, name: `Warehouse ${from + index}`, status: "ACTIVE" }));
  request.mockImplementation(async (_path: string, options: { query: { page: number } }) => options.query.page === 1
    ? { items: named(1, 15), pagination: { page: 1, limit: 100, total: 25, totalPages: 2, hasNextPage: true, hasPreviousPage: false } }
    : { items: named(16, 10), pagination: { page: 2, limit: 100, total: 25, totalPages: 2, hasNextPage: false, hasPreviousPage: true } });
  mount("list");
  expect(await screen.findByText("Warehouse 20")).toBeInTheDocument();
  expect(screen.queryByText("Warehouse 21")).not.toBeInTheDocument();
  expect(screen.getByText("Visible after filter").nextElementSibling).toHaveTextContent("25");
  expect(screen.queryByText("Warehouse footprint by state")).not.toBeInTheDocument();
  expect(request.mock.calls.map(([, options]) => options.query.page)).toEqual([1, 2]);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Warehouse 21")).toBeInTheDocument();
  expect(screen.queryByText("Warehouse 1")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledTimes(2);
});

it("applies filters from links such as search results on the main screen", async () => {
  mount("list", false, { search: "", state: "", status: "", warehouseId: "warehouse-7" });
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/warehouses", expect.objectContaining({ query: expect.objectContaining({ warehouseId: "warehouse-7" }) })));
});

it("assigns staff picked by name, email and role, surfaces rejections, and offers removed staff again", async () => {
  let assigned = false;
  let reject = true;
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "POST") {
      if (reject) throw new Error("Admin user was not found.");
      assigned = true;
      return assignment;
    }
    if (options?.method === "DELETE") { assigned = false; return; }
    if (path.endsWith("/staff/candidates")) return assigned ? [] : [candidate];
    if (path.endsWith("/staff")) return assigned ? [assignment] : [];
    return response();
  });
  mount("staff");
  const picker = await screen.findByLabelText("Admin user");
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Select an admin user to assign.");
  expect(request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(0);
  await screen.findByRole("option", { name: candidateLabel });
  fireEvent.change(picker, { target: { value: adminId } });
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin user was not found.");
  reject = false;
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByText("qa@example.test")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(`/admin/warehouses/${warehouse.id}/staff`, { body: JSON.stringify({ adminUserId: adminId }), method: "POST" });
  await waitFor(() => expect(screen.queryByRole("option", { name: candidateLabel })).not.toBeInTheDocument());
  expect(picker).toBeDisabled();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByText("qa@example.test")).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledWith(`/admin/warehouses/${warehouse.id}/staff/${adminId}`, { method: "DELETE" });
  expect(await screen.findByRole("option", { name: candidateLabel })).toBeInTheDocument();
});

it("does not fetch staff assignments or candidates without staff-management permission", async () => {
  access.allowed = false;
  mount("staff");
  expect(await screen.findByText("Staff management unavailable")).toBeInTheDocument();
  expect(request.mock.calls.some(([path]) => path.includes("/staff"))).toBe(false);
});
