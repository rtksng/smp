import type { BulkAction } from "@/components/admin/bulk-actions";
import type { AdminApiClient } from "./admin-api";
import { BulkSkip } from "./bulk-actions";
import {
  canAssignDelivery,
  canCancelOrder,
  getNextOrderStatuses,
  type AdminOrder
} from "./order-management";
import type { AdminProduct } from "./product-form";
import type { AdminProductFeedback, ProductFeedbackStatus } from "./support-management";

type Api = Pick<AdminApiClient, "request" | "requestResponse">;

export function orderBulkActions(
  api: Api,
  permissions: { update: boolean; cancel: boolean },
  note: string
): BulkAction<AdminOrder>[] {
  const actions: BulkAction<AdminOrder>[] = [];
  if (permissions.update) {
    for (const [status, label] of [
      ["CONFIRMED", "Confirm orders"],
      ["PACKED", "Mark orders packed"]
    ] as const) {
      const skipReason = (order: AdminOrder) =>
        getNextOrderStatuses(order.status).includes(status)
          ? null
          : `Cannot move ${order.status.toLowerCase().replaceAll("_", " ")} to ${status.toLowerCase()}.`;
      actions.push({
        id: status,
        label,
        description:
          label === "Confirm orders"
            ? "Move created orders to confirmed."
            : "Move confirmed orders to packed.",
        skipReason,
        execute: async (order) => {
          const current = await api.request<AdminOrder>(`/admin/orders/${order.id}`);
          const reason = skipReason(current);
          if (reason) throw new BulkSkip(reason);
          return api.request(`/admin/orders/${order.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status })
          });
        }
      });
    }
  }
  if (permissions.cancel) {
    const skipReason = (order: AdminOrder) =>
      canCancelOrder(order.status) ? null : "This order can no longer be cancelled.";
    actions.push({
      id: "cancel",
      label: "Cancel orders",
      destructive: true,
      description: `Cancel eligible orders and apply the existing stock/payment workflow. Reason: ${note.trim() || "enter a reason below"}.`,
      validationError: note.trim() ? null : "Enter a cancellation reason.",
      skipReason,
      execute: async (order) => {
        const current = await api.request<AdminOrder>(`/admin/orders/${order.id}`);
        const reason = skipReason(current);
        if (reason) throw new BulkSkip(reason);
        return api.request(`/admin/orders/${order.id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: note.trim() })
        });
      }
    });
  }
  actions.push({
    id: "invoices",
    label: "Download invoices",
    description: "Prepare existing invoices as PDFs in one ZIP download.",
    skipReason: (order) =>
      order.invoice ? null : "No invoice has been generated yet.",
    execute: async (order) => {
      const response = await api.requestResponse(`/admin/orders/${order.id}/invoice`, {
        query: { format: "pdf" }
      });
      if (!response.ok) throw new Error(`Invoice request failed (${response.status}).`);
      if (!response.headers.get("content-type")?.includes("application/pdf"))
        throw new Error("The server did not return a PDF invoice.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
        throw new Error("The invoice PDF is invalid.");
      return bytes;
    },
    artifact: async (results) => {
      const successful = results.filter((result) => result.status === "succeeded");
      if (!successful.length) return null;
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      for (const result of successful) {
        const name = result.item.orderNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
        files[`${name}-${result.item.id}.pdf`] = result.value as Uint8Array;
      }
      return {
        blob: new Blob([new Uint8Array(zipSync(files, { level: 0 }))], {
          type: "application/zip"
        }),
        filename: "invoices.zip"
      };
    }
  });
  return actions;
}

export type ProductBulkValues = {
  brandId: string;
  categoryId: string;
  subcategoryId: string;
  taxRate: string;
};

export function productBulkActions(
  api: Api,
  values: ProductBulkValues,
  labels: { brand: string; category: string; subcategory: string },
  requiresSubcategory: boolean
): BulkAction<AdminProduct>[] {
  const update = (product: AdminProduct, payload: object) =>
    api.request(`/admin/products/${product.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  return [
    ...(["ACTIVE", "INACTIVE"] as const).map(
      (status): BulkAction<AdminProduct> => ({
        id: status,
        label: status === "ACTIVE" ? "Activate products" : "Deactivate products",
        destructive: status === "INACTIVE",
        description: `Set selected products to ${status.toLowerCase()}.`,
        skipReason: (product) =>
          product.status === status ? `Already ${status.toLowerCase()}.` : null,
        execute: async (product) => {
          const current = await api.request<AdminProduct>(
            `/admin/products/${product.id}`
          );
          if (current.status === status)
            throw new BulkSkip(`Already ${status.toLowerCase()}.`);
          return update(product, { status });
        }
      })
    ),
    {
      id: "brand",
      label: "Change brand",
      description: `Set the brand to ${labels.brand || "the chosen brand"}.`,
      validationError: values.brandId ? null : "Choose a brand.",
      skipReason: (product) =>
        product.brandId === values.brandId ? "Already uses this brand." : null,
      execute: (product) => update(product, { brandId: values.brandId })
    },
    {
      id: "category",
      label: "Change category",
      description: `Set category to ${labels.category || "the chosen category"} and subcategory to ${labels.subcategory || "none"}.`,
      validationError: !values.categoryId
        ? "Choose a category."
        : requiresSubcategory && !values.subcategoryId
          ? "Choose a subcategory."
          : null,
      skipReason: (product) =>
        product.categoryId === values.categoryId &&
        (product.subcategoryId ?? "") === values.subcategoryId
          ? "Already uses this category and subcategory."
          : null,
      execute: (product) =>
        update(product, {
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId || null
        })
    },
    {
      id: "tax",
      label: "Change tax rate",
      description: `Set the tax rate to ${values.taxRate || "the entered rate"}%.`,
      validationError:
        /^\d+(\.\d{1,2})?$/.test(values.taxRate) && Number(values.taxRate) <= 100
          ? null
          : "Enter a tax rate from 0 to 100 (up to two decimal places).",
      skipReason: (product) =>
        Number(product.taxRate) === Number(values.taxRate)
          ? "Already uses this tax rate."
          : null,
      execute: (product) => update(product, { taxRate: Number(values.taxRate) })
    }
  ];
}

export function feedbackBulkActions(
  api: Api,
  view: "reviews" | "questions",
  note: string
): BulkAction<AdminProductFeedback>[] {
  const statuses: ProductFeedbackStatus[] =
    view === "reviews" ? ["PUBLISHED", "REJECTED", "HIDDEN"] : ["HIDDEN"];
  return statuses.map((status) => ({
    id: status,
    label:
      status === "PUBLISHED"
        ? "Publish reviews"
        : status === "REJECTED"
          ? "Reject reviews"
          : `Hide ${view}`,
    description: `Mark selected ${view} as ${status.toLowerCase()}.${note.trim() ? ` Note: ${note.trim()}` : ""}`,
    destructive: status !== "PUBLISHED",
    skipReason: (item) =>
      item.type !== (view === "reviews" ? "REVIEW" : "QUESTION")
        ? "This action does not apply to this feedback type."
        : item.status === status
          ? `Already ${status.toLowerCase()}.`
          : null,
    execute: (item) =>
      api.request(`/admin/product-feedback/${view}/${item.id}/moderation`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(note.trim() ? { moderationNote: note.trim() } : {})
        })
      })
  }));
}

export function deliveryBulkAction(
  api: Api,
  values: { deliveryPartnerId: string; pickupWarehouseId: string; note: string },
  partnerName: string,
  warehouseName: string
): BulkAction<AdminOrder> {
  const skipReason = (order: AdminOrder) =>
    !canAssignDelivery(order.status)
      ? "Only confirmed or packed orders can be assigned."
      : null;
  return {
    id: "assign",
    label: "Assign delivery",
    description: `Assign orders to ${partnerName || "the selected partner"}. Pickup: ${warehouseName || "each order's warehouse"}.${values.note.trim() ? ` Note: ${values.note.trim()}` : ""}`,
    validationError:
      values.deliveryPartnerId && partnerName
        ? null
        : "Choose an active delivery partner.",
    skipReason,
    execute: async (order) => {
      const current = await api.request<AdminOrder>(`/admin/orders/${order.id}`);
      const reason = skipReason(current);
      if (reason) throw new BulkSkip(reason);
      return api.request("/admin/delivery/assign", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.id,
          deliveryPartnerId: values.deliveryPartnerId,
          ...(values.pickupWarehouseId
            ? { pickupWarehouseId: values.pickupWarehouseId }
            : {}),
          ...(values.note.trim() ? { note: values.note.trim() } : {})
        })
      });
    }
  };
}
