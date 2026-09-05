import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminDeliveryChargeRule,
  PaginatedDeliveryChargeResponse
} from "../../../lib/delivery-charge-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import { DeliveryChargeEditPage } from "./delivery-charge-edit-page";

const { request, hasPermission, push, success } = vi.hoisted(() => ({
  request: vi.fn(),
  hasPermission: vi.fn(),
  push: vi.fn(),
  success: vi.fn()
}));

vi.mock("../../../lib/admin-session", () => ({
  useAdminSession: () => ({ api: { request }, hasPermission })
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));
vi.mock("../../../lib/notifications", () => ({
  notify: { success }
}));

const rule: AdminDeliveryChargeRule = {
  charge: 75.5,
  createdAt: "2026-09-03T10:00:00.000Z",
  freeDeliveryThreshold: 3000,
  id: "rule-1",
  isActive: false,
  maxOrderAmount: 5000,
  minOrderAmount: 100,
  name: "Retired warehouse delivery",
  pincode: "248001",
  priority: 80,
  updatedAt: "2026-09-03T10:00:00.000Z",
  warehouse: {
    code: "OLD-01",
    id: "warehouse-retired",
    name: "Retired warehouse"
  },
  warehouseId: "warehouse-retired"
};

function listResponse(
  items: AdminDeliveryChargeRule[],
  page = 1,
  hasNextPage = false
): PaginatedDeliveryChargeResponse {
  return {
    items,
    pagination: {
      hasNextPage,
      hasPreviousPage: page > 1,
      limit: 100,
      page,
      total: hasNextPage || page > 1 ? 101 : items.length,
      totalPages: hasNextPage || page > 1 ? 2 : 1
    }
  };
}

function renderEditor(ruleId = rule.id) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <DeliveryChargeEditPage ruleId={ruleId} />
    </QueryClientProvider>
  );
  return client;
}

describe("DeliveryChargeEditPage", () => {
  beforeEach(() => {
    request.mockReset();
    hasPermission.mockReset().mockReturnValue(true);
    push.mockReset();
    success.mockReset();
  });

  it("loads any result page, preserves an inactive retired warehouse, and saves on the dedicated route", async () => {
    hasPermission.mockImplementation(
      (permission: string) => permission === ADMIN_PERMISSION.SettingsManage
    );
    const savedRule = { ...rule, charge: 80.25 };
    request.mockImplementation(
      async (
        path: string,
        options?: { method?: string; query?: { page?: number } }
      ) => {
        if (options?.method === "PATCH") return savedRule;
        if (path === "/admin/warehouses") {
          throw new Error("Warehouse access forbidden");
        }
        return options?.query?.page === 1
          ? listResponse([{ ...rule, id: "another-rule" }], 1, true)
          : listResponse([rule], 2);
      }
    );
    const client = renderEditor();

    expect(await screen.findByRole("textbox", { name: "Rule name" })).toHaveValue(
      "Retired warehouse delivery"
    );
    expect(screen.getByRole("button", { name: /Warehouse/ })).toHaveTextContent(
      "OLD-01 Retired warehouse"
    );
    expect(screen.getByRole("checkbox", { name: "Active for checkout" })).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Back to rules" })).toHaveAttribute(
      "href",
      "/delivery-charges/rules"
    );
    fireEvent.change(screen.getByRole("spinbutton", { name: "Delivery charge" }), {
      target: { value: "80.25" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/delivery-charges/rules"));
    const [path, options] = request.mock.calls.find(
      ([, requestOptions]) => requestOptions?.method === "PATCH"
    )!;
    expect(path).toBe("/admin/delivery-charge-rules/rule-1");
    expect(JSON.parse(options.body)).toEqual({
      charge: 80.25,
      freeDeliveryThreshold: 3000,
      isActive: false,
      maxOrderAmount: 5000,
      minOrderAmount: 100,
      name: "Retired warehouse delivery",
      pincode: "248001",
      priority: 80,
      warehouseId: "warehouse-retired"
    });
    expect(success).toHaveBeenCalledWith("Delivery charge rule updated.");
    expect(hasPermission).toHaveBeenCalledWith(ADMIN_PERMISSION.WarehouseRead);
    expect(request.mock.calls.some(([requestPath]) => requestPath === "/admin/warehouses")).toBe(false);
    expect(
      client.getQueryData(["admin", "delivery-charge-rules", "detail", rule.id])
    ).toEqual(savedRule);
  });

  it("keeps the draft after a failed update and lets the admin cancel back to the list", async () => {
    request.mockImplementation(
      async (path: string, options?: { method?: string }) => {
        if (path === "/admin/warehouses") {
          return {
            items: [{ code: "ACT-01", id: "warehouse-active", name: "Active warehouse" }]
          };
        }
        if (options?.method === "PATCH") {
          throw new Error("Unable to update this rule");
        }
        return listResponse([rule]);
      }
    );
    renderEditor();

    const name = await screen.findByRole("textbox", { name: "Rule name" });
    fireEvent.change(name, { target: { value: "Corrected delivery rule" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to update this rule"
    );
    expect(name).toHaveValue("Corrected delivery rule");
    expect(push).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(push).toHaveBeenCalledWith("/delivery-charges/rules");
  });

  it("shows an unavailable state when no result page contains the requested rule", async () => {
    request.mockImplementation(async (path: string) =>
      path === "/admin/warehouses" ? { items: [] } : listResponse([rule])
    );
    renderEditor("missing-rule");

    expect(await screen.findByText("Delivery charge rule unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back to rules" })).toHaveAttribute(
      "href",
      "/delivery-charges/rules"
    );
    expect(push).not.toHaveBeenCalled();
  });
});
