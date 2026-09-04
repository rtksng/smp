import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WarehouseManagementPage } from "./warehouse-management";

const { request, push, access } = vi.hoisted(() => ({ request: vi.fn(), push: vi.fn(), access: { allowed: true } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../../admin-shell", () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission: () => access.allowed }),
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
  PermissionGate: ({ children, fallback }: { children: ReactNode; fallback: ReactNode }) => access.allowed ? children : fallback
}));

const warehouse = {
  id: "warehouse-1", name: "QA warehouse", code: "1", address: "Plot 1", city: "Pune", state: "Maharashtra",
  pincode: "411001", contactPerson: "QA Contact", contactNumber: "9000000000", latitude: null, longitude: null,
  status: "INACTIVE", createdAt: "2026-09-04", updatedAt: "2026-09-04"
};
const adminId = "daaa9716-a744-4a6e-9015-9e9da8ea5912";
const assignment = { id: "assignment-1", adminUserId: adminId, warehouseId: warehouse.id, firstName: "QA", lastName: "Staff", email: "qa@example.test" };
const response = (page = 1, totalPages = 1) => ({ items: [{ ...warehouse, id: `warehouse-${page}` }], pagination: { page, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1, limit: 100, total: totalPages * 100 } });
const clients: QueryClient[] = [];

function mount(view: "create" | "list" | "staff", edit = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><WarehouseManagementPage view={view} initialEditWarehouseId={edit ? warehouse.id : null} /></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  access.allowed = true;
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method) return warehouse;
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
  await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouses/list"));
  const mutations = request.mock.calls.filter(([, options]) => options?.method);
  expect(mutations).toHaveLength(1);
  expect(mutations[0]?.[0]).toBe(`/admin/warehouses/${warehouse.id}`);
  expect(JSON.parse(mutations[0]?.[1].body)).toMatchObject({ name: "Edited warehouse", code: "1", status: "INACTIVE" });
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
  await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouses/list"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("opens later warehouse list pages", async () => {
  request.mockImplementation(async (_path: string, options: { query: { page: number } }) => response(options.query.page, 2));
  mount("list");
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/warehouses", expect.objectContaining({ query: expect.objectContaining({ page: 2 }) })));
});

it("handles invalid staff, backend rejection, successful assignment and removal", async () => {
  let assigned = false;
  let reject = true;
  request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "POST") {
      if (reject) throw new Error("Admin user was not found.");
      assigned = true;
      return assignment;
    }
    if (options?.method === "DELETE") { assigned = false; return; }
    if (path.endsWith("/staff")) return assigned ? [assignment] : [];
    return response();
  });
  mount("staff");
  const input = await screen.findByRole("textbox", { name: "Admin user ID" });
  fireEvent.change(input, { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("valid admin user ID");
  expect(request.mock.calls.filter(([, options]) => options?.method)).toHaveLength(0);
  fireEvent.change(input, { target: { value: adminId } });
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin user was not found.");
  reject = false;
  fireEvent.click(screen.getByRole("button", { name: "Assign staff" }));
  expect(await screen.findByText("qa@example.test")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByText("qa@example.test")).not.toBeInTheDocument());
  expect(request).toHaveBeenCalledWith(`/admin/warehouses/${warehouse.id}/staff/${adminId}`, { method: "DELETE" });
});

it("does not fetch staff assignments without staff-management permission", async () => {
  access.allowed = false;
  mount("staff");
  expect(await screen.findByText("Staff management unavailable")).toBeInTheDocument();
  expect(request.mock.calls.some(([path]) => path.endsWith("/staff"))).toBe(false);
});
