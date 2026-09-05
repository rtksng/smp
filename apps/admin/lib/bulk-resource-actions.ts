import type { BulkAction } from "@/components/admin/bulk-actions";
import type { AdminApiClient } from "./admin-api";
import { BulkSkip } from "./bulk-actions";
import {
  buildCustomerStatusPayload,
  resolveCustomerStatus,
  type AdminCustomer,
  type CustomerStatus
} from "./customer-management";
import {
  getQuoteRequestStatusOptions,
  type AdminQuoteRequest
} from "./support-management";
import type { InventoryStock, StockBatch } from "./inventory-management";

type Api = Pick<AdminApiClient, "request">;

export function activeResourceBulkActions<T extends { id: string; isActive: boolean }>(
  api: Api,
  resource: "brands" | "categories" | "coupons" | "delivery-charge-rules"
): BulkAction<T>[] {
  const label =
    resource === "delivery-charge-rules" ? "delivery charge rules" : resource;
  const actions: BulkAction<T>[] = [true, false].map((isActive) => ({
    id: isActive ? "activate" : "deactivate",
    label: `${isActive ? "Activate" : "Deactivate"} ${label}`,
    description: `Set selected ${label} to ${isActive ? "active" : "inactive"}.${resource === "categories" ? " A hidden parent also hides its children from the public catalog; their own status and hierarchy stay unchanged." : ""}`,
    destructive: !isActive,
    skipReason: (item) =>
      item.isActive === isActive
        ? `Already ${isActive ? "active" : "inactive"}.`
        : null,
    execute: (item) =>
      api.request(`/admin/${resource}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive })
      })
  }));
  if (resource === "coupons" || resource === "delivery-charge-rules") {
    actions.push({
      id: "archive",
      label: `Archive ${label}`,
      destructive: true,
      description: `Archive selected ${label}. They will be removed from the list and can no longer apply at checkout.`,
      skipReason: () => null,
      execute: (item) =>
        api.request(`/admin/${resource}/${encodeURIComponent(item.id)}`, {
          method: "DELETE"
        })
    });
  }
  return actions;
}

export function quoteBulkActions(api: Api): BulkAction<AdminQuoteRequest>[] {
  return (["CONTACTED", "CLOSED"] as const).map((status) => {
    const skipReason = (item: AdminQuoteRequest) =>
      item.status === status
        ? `Already ${status.toLowerCase()}.`
        : getQuoteRequestStatusOptions(item).includes(status)
          ? null
          : `Cannot move ${item.status.toLowerCase()} to ${status.toLowerCase()}.`;
    return {
      id: status,
      label: status === "CONTACTED" ? "Mark quotes contacted" : "Close quote requests",
      description: `Mark eligible quote requests as ${status.toLowerCase()}.`,
      destructive: status === "CLOSED",
      skipReason,
      execute: async (item) => {
        const current = await api.request<AdminQuoteRequest>(
          `/admin/quote-requests/${item.id}`
        );
        const reason = skipReason(current);
        if (reason) throw new BulkSkip(reason);
        return api.request(`/admin/quote-requests/${item.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
      }
    };
  });
}

export function customerBulkActions(
  api: Api,
  note: string
): BulkAction<AdminCustomer>[] {
  return (["ACTIVE", "INACTIVE", "BLOCKED"] as CustomerStatus[]).map((status) => {
    const skipReason = (item: AdminCustomer) =>
      resolveCustomerStatus(item) === status
        ? `Already ${status.toLowerCase()}.`
        : null;
    return {
      id: status,
      label: `${status === "ACTIVE" ? "Activate" : status === "BLOCKED" ? "Block" : "Deactivate"} customers`,
      description: `Set selected customer accounts to ${status.toLowerCase()}.${status !== "ACTIVE" ? " These accounts will lose access." : ""}${note.trim() ? ` Note: ${note.trim()}` : ""}`,
      destructive: status !== "ACTIVE",
      validationError:
        status !== "ACTIVE" && !note.trim()
          ? "Enter a reason for this account status change."
          : null,
      skipReason,
      execute: async (item) => {
        const current = await api.request<AdminCustomer>(`/admin/customers/${item.id}`);
        const reason = skipReason(current);
        if (reason) throw new BulkSkip(reason);
        return api.request(`/admin/customers/${item.id}/status`, {
          method: "PATCH",
          body: JSON.stringify(buildCustomerStatusPayload(status, note))
        });
      }
    };
  });
}

export type BulkInventoryRow = InventoryStock | StockBatch;
export type BulkInventoryValues = {
  quantity: string;
  reason: string;
  toWarehouseId: string;
  batchNumbers: Record<string, string>;
};
export function inventoryBulkActions(
  api: Api,
  values: BulkInventoryValues,
  rows: BulkInventoryRow[],
  warehouseName: string
): BulkAction<BulkInventoryRow>[] {
  const batchNumber = (row: BulkInventoryRow) =>
    "batchNumber" in row ? row.batchNumber : (values.batchNumbers[row.id] ?? "").trim();
  const quantity = Number(values.quantity);
  const quantityValid =
    /^-?\d+$/.test(values.quantity) &&
    Number.isSafeInteger(quantity) &&
    quantity !== 0 &&
    Math.abs(quantity) <= 2_147_483_647;
  const batchError = rows.some((row) => !batchNumber(row))
    ? "Enter a batch number for every selected stock record."
    : null;
  const reasonError = values.reason.trim() ? null : "Enter a stock movement reason.";
  const available = (row: BulkInventoryRow) =>
    "availableQuantity" in row ? row.availableQuantity : row.quantity;
  const identity = (row: BulkInventoryRow) => ({
    productId: row.productId,
    variantId: row.variantId,
    batchNumber: batchNumber(row)
  });
  return [
    {
      id: "adjust",
      label: "Adjust selected stock",
      destructive: true,
      retryable: false,
      description: `Adjust each selected batch by ${values.quantity || "the entered"} units. Positive adds stock; negative removes stock. Reason: ${values.reason.trim() || "required"}.`,
      validationError: !quantityValid
        ? "Enter a non-zero whole number of units."
        : (batchError ?? reasonError),
      reviewDetail: (row) =>
        `Batch ${batchNumber(row)} · ${quantity > 0 ? "+" : ""}${quantity} units`,
      skipReason: (row) =>
        available(row) + quantity < 0
          ? "Insufficient available stock for this adjustment."
          : null,
      execute: (row) =>
        api.request("/admin/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({
            ...identity(row),
            warehouseId: row.warehouseId,
            quantityDelta: quantity,
            reason: values.reason.trim()
          })
        })
    },
    {
      id: "transfer",
      label: "Transfer selected stock",
      destructive: true,
      retryable: false,
      description: `Transfer ${values.quantity || "the entered"} units from each selected batch to ${warehouseName || "the chosen warehouse"}. Reason: ${values.reason.trim() || "required"}.`,
      validationError:
        !quantityValid || quantity < 1
          ? "Enter a positive whole number of units."
          : !values.toWarehouseId || !warehouseName
            ? "Choose an active destination warehouse."
            : (batchError ?? reasonError),
      reviewDetail: (row) =>
        `Batch ${batchNumber(row)} · ${quantity} units to ${warehouseName}`,
      skipReason: (row) =>
        row.warehouseId === values.toWarehouseId
          ? "Source and destination warehouses must differ."
          : available(row) < quantity
            ? "Insufficient available stock for this transfer."
            : null,
      execute: (row) =>
        api.request("/admin/inventory/transfer", {
          method: "POST",
          body: JSON.stringify({
            ...identity(row),
            fromWarehouseId: row.warehouseId,
            toWarehouseId: values.toWarehouseId,
            quantity,
            notes: values.reason.trim()
          })
        })
    }
  ];
}
