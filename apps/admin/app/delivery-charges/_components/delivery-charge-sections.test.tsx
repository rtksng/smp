import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeliveryChargeCreatePage, DeliveryChargeRulesPage } from "./delivery-charge-sections";
import type { AdminDeliveryChargeRule } from "../../../lib/delivery-charge-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";

const { request, hasPermission } = vi.hoisted(() => ({ request: vi.fn(), hasPermission: vi.fn() }));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission })
}));
vi.mock("../../admin-shell", () => ({ AdminShell: () => null }));

const rule: AdminDeliveryChargeRule = {
  id: "rule-1", name: "Delhi delivery", charge: 75.5, isActive: false,
  pincode: "110001", priority: 2, minOrderAmount: null, maxOrderAmount: null,
  freeDeliveryThreshold: null, warehouseId: null, warehouse: null,
  createdAt: "2026-09-03T10:00:00.000Z", updatedAt: "2026-09-03T10:00:00.000Z"
};
const clients: QueryClient[] = [];
function listResponse(items: AdminDeliveryChargeRule[], page = 1, total = items.length) {
  return {
    items,
    pagination: { page, limit: 20, total, totalPages: Math.ceil(total / 20), hasNextPage: page * 20 < total, hasPreviousPage: page > 1 }
  };
}
function renderPage(view: "rules" | "new") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{view === "new" ? <DeliveryChargeCreatePage /> : <DeliveryChargeRulesPage />}</QueryClientProvider>);
}
function fill(name: string, value: string, role: "textbox" | "spinbutton" = "textbox") {
  fireEvent.change(screen.getByRole(role, { name }), { target: { value } });
}

beforeEach(() => {
  hasPermission.mockReset().mockReturnValue(true);
  request.mockReset().mockImplementation(async (path: string) => path === "/admin/warehouses" ? { items: [] } : listResponse([]));
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
});

describe("Delivery charge admin flow", () => {
  it("loads and refreshes rules without a forbidden warehouse lookup for a settings-only role", async () => {
    hasPermission.mockImplementation((permission: string) => permission === ADMIN_PERMISSION.SettingsManage);
    request.mockImplementation(async (path: string) => {
      if (path === "/admin/warehouses") throw new Error("Warehouse access forbidden");
      return listResponse([rule]);
    });

    renderPage("rules");
    expect(await screen.findByRole("button", { name: "Edit Delhi delivery" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(request.mock.calls.filter(([path]) => path === "/admin/delivery-charge-rules")).toHaveLength(2));
    expect(hasPermission).toHaveBeenCalledWith(ADMIN_PERMISSION.WarehouseRead);
    expect(request.mock.calls.some(([path]) => path === "/admin/warehouses")).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("displays and preserves a saved warehouse scope when it is absent from active warehouse options", async () => {
    const scopedRule: AdminDeliveryChargeRule = {
      ...rule,
      warehouseId: "warehouse-retired",
      warehouse: { id: "warehouse-retired", code: "OLD-01", name: "Retired warehouse" }
    };
    request.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/admin/warehouses") {
        return { items: [{ id: "warehouse-active", code: "DEL-02", name: "Active warehouse" }] };
      }
      if (options?.method === "PATCH") return { ...scopedRule, charge: 80.25 };
      return listResponse([scopedRule]);
    });

    renderPage("rules");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Delhi delivery" }));
    const editPanel = screen.getByRole("complementary");
    expect(within(editPanel).getByRole("button", { name: /Warehouse/ })).toHaveTextContent("OLD-01 Retired warehouse");
    fill("Delivery charge", "80.25", "spinbutton");
    fireEvent.click(within(editPanel).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Delivery charge rule updated.")).toBeInTheDocument();
    const [path, options] = request.mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(path).toBe("/admin/delivery-charge-rules/rule-1");
    expect(JSON.parse(options.body)).toMatchObject({ charge: 80.25, warehouseId: "warehouse-retired" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("prevents changing or archiving edits during a save and restores controls after success", async () => {
    const secondRule = { ...rule, id: "rule-2", name: "Mumbai delivery" };
    let resolvePatch!: (savedRule: AdminDeliveryChargeRule) => void;
    const pendingPatch = new Promise<AdminDeliveryChargeRule>((resolve) => { resolvePatch = resolve; });
    request.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === "/admin/warehouses") return { items: [] };
      if (options?.method === "PATCH") return pendingPatch;
      return listResponse([rule, secondRule]);
    });

    renderPage("rules");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Delhi delivery" }));
    fill("Delivery charge", "90.50", "spinbutton");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled());

    const editPanel = screen.getByRole("complementary");
    const editOtherRule = screen.getByRole("button", { name: "Edit Mumbai delivery" });
    const archiveRule = screen.getByRole("button", { name: "Archive Delhi delivery" });
    const closeEditor = within(editPanel).getByRole("button", { name: "Close" });
    expect(editOtherRule).toBeDisabled();
    expect(archiveRule).toBeDisabled();
    expect(closeEditor).toBeDisabled();
    expect(within(editPanel).getByRole("button", { name: "Cancel edit" })).toBeDisabled();
    fireEvent.click(editOtherRule);
    fireEvent.click(archiveRule);
    fireEvent.click(closeEditor);
    expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveValue("Delhi delivery");
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => { resolvePatch({ ...rule, charge: 90.5 }); });
    expect(await screen.findByText("Delivery charge rule updated.")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Mumbai delivery" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive Delhi delivery" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit Mumbai delivery" }));
    expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveValue("Mumbai delivery");
  });

  it("blocks a missing charge before creating a rule", async () => {
    renderPage("new");
    fill("Rule name", "Delivery without amount");
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(await screen.findByText("Enter a delivery charge of 0 or above.")).toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("accepts decimal amounts, retains failed edits, and recovers after a save retry", async () => {
    let attempts = 0;
    request.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === "POST") {
        if (++attempts === 1) throw new Error("Unable to save this rule");
        return rule;
      }
      return path === "/admin/warehouses" ? { items: [] } : listResponse([]);
    });
    renderPage("new");
    fill("Rule name", "Delhi delivery");
    fill("Delivery charge", "75.50", "spinbutton");
    fill("Minimum order amount", "100.25", "spinbutton");
    fireEvent.click(screen.getByRole("checkbox", { name: "Active for checkout" }));
    expect(screen.getByRole("spinbutton", { name: "Delivery charge" })).toBeValid();
    expect(screen.getByRole("spinbutton", { name: "Minimum order amount" })).toBeValid();
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save this rule");
    expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveValue("Delhi delivery");
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
    expect(await screen.findByText("Delivery charge rule created.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveValue("");
    const [, options] = request.mock.calls.find(([, options]) => options?.method === "POST")!;
    expect(JSON.parse(options.body)).toMatchObject({ charge: 75.5, minOrderAmount: 100.25, isActive: false });
  });

  it("keeps invalid filters in the drawer and applies or resets valid filters", async () => {
    renderPage("rules");
    await screen.findByText("No delivery charge rules found");
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    let drawer = await screen.findByRole("dialog", { name: "Delivery charge filters" });
    fireEvent.change(within(drawer).getByRole("textbox", { name: "110001" }), { target: { value: "123" } });
    const requestCount = request.mock.calls.length;
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply filters" }));
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("Pincode must be exactly 6 digits.");
    expect(request).toHaveBeenCalledTimes(requestCount);
    fireEvent.change(within(drawer).getByRole("textbox", { name: "110001" }), { target: { value: "110001" } });
    fireEvent.change(within(drawer).getByRole("textbox", { name: "Rule name" }), { target: { value: "Delhi" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Apply filters" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/admin/delivery-charge-rules", { query: expect.objectContaining({ page: 1, pincode: "110001", search: "Delhi" }) }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delivery charge filters" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    drawer = await screen.findByRole("dialog", { name: "Delivery charge filters" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Reset" }));
    expect(within(drawer).getByRole("textbox", { name: "110001" })).toHaveValue("");
    expect(within(drawer).getByRole("textbox", { name: "Rule name" })).toHaveValue("");
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/admin/delivery-charge-rules", { query: expect.objectContaining({ page: 1, pincode: undefined, search: undefined }) }));
  });

  it("returns to the preceding page after archiving the last rule on the last page", async () => {
    let archived = false;
    request.mockImplementation(async (path: string, options?: { method?: string; query?: { page?: number } }) => {
      if (path === "/admin/warehouses") return { items: [] };
      if (options?.method === "DELETE") { archived = true; return rule; }
      const page = options?.query?.page ?? 1;
      return listResponse(page === 2 ? archived ? [] : [{ ...rule, name: "Last rule" }] : [rule], page, archived ? 20 : 21);
    });
    renderPage("rules");
    await screen.findByRole("button", { name: "Edit Delhi delivery" });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive Last rule" }));
    const confirmation = await screen.findByRole("dialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Archive rule" }));
    expect(await screen.findByRole("button", { name: "Edit Delhi delivery" })).toBeInTheDocument();
    expect(screen.queryByText("No delivery charge rules found")).toBeNull();
    expect(request.mock.calls.filter(([, options]) => options?.method === "DELETE")).toHaveLength(1);
  });
});
