import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  deliveryBulkAction,
  feedbackBulkActions,
  orderBulkActions,
  productBulkActions
} from "./bulk-module-actions";
import { AdminApiClientError } from "./admin-api";
import { processBulkRows } from "./bulk-actions";
import type { DispatchQueueOrder } from "./delivery-management";
import type { AdminOrder } from "./order-management";
import type { AdminProduct } from "./product-form";
import type { AdminProductFeedback } from "./support-management";

const order = (id: string, status: AdminOrder["status"] = "CREATED") =>
  ({
    id,
    orderNumber: `QA-${id}`,
    status,
    warehouseId: "w1",
    invoice: null
  }) as AdminOrder;
const dispatchOrder = (id: string, status: DispatchQueueOrder["status"] = "PACKED") =>
  ({ id, orderNumber: `QA-${id}`, status, warehouseId: "w1" }) as DispatchQueueOrder;
const product = {
  id: "p1",
  status: "ACTIVE",
  brandId: "b1",
  categoryId: "c1",
  subcategoryId: "s1",
  taxRate: 18
} as AdminProduct;
const api = () => ({ request: vi.fn(), requestResponse: vi.fn() });
const productValues = {
  brandId: "b2",
  categoryId: "c2",
  subcategoryId: "",
  taxRate: "12.5"
};
const labels = { brand: "Brand", category: "Category", subcategory: "" };

describe("module bulk contracts", () => {
  it("hides order writes without their separate permissions", () => {
    expect(
      orderBulkActions(api(), { update: false, cancel: false }, "").map(
        (action) => action.id
      )
    ).toEqual(["invoices"]);
    expect(
      orderBulkActions(api(), { update: false, cancel: true }, "").map(
        (action) => action.id
      )
    ).toEqual(["cancel", "invoices"]);
  });

  it("rechecks order status and skips an order changed after selection", async () => {
    const client = api();
    client.request.mockResolvedValue(order("1", "CONFIRMED"));
    const action = orderBulkActions(client, { update: true, cancel: false }, "")[0]!;
    const result = await processBulkRows([order("1")], action);
    expect(result[0]!.status).toBe("skipped");
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it("confirms and packs through the existing status endpoint", async () => {
    const client = api();
    client.request
      .mockResolvedValueOnce(order("1"))
      .mockResolvedValueOnce(order("1", "CONFIRMED"));
    await orderBulkActions(client, { update: true, cancel: false }, "")[0]!.execute(
      order("1")
    );
    expect(client.request).toHaveBeenLastCalledWith("/admin/orders/1/status", {
      method: "PATCH",
      body: '{"status":"CONFIRMED"}'
    });
    client.request.mockResolvedValue(order("1", "CONFIRMED"));
    await orderBulkActions(client, { update: true, cancel: false }, "")[1]!.execute(
      order("1", "CONFIRMED")
    );
    expect(client.request).toHaveBeenLastCalledWith("/admin/orders/1/status", {
      method: "PATCH",
      body: '{"status":"PACKED"}'
    });
  });

  it("requires a cancellation reason and rejects delivered orders", async () => {
    const client = api();
    const blank = orderBulkActions(client, { update: false, cancel: true }, "")[0]!;
    expect(blank.validationError).toBeTruthy();
    const action = orderBulkActions(
      client,
      { update: false, cancel: true },
      "  Duplicate QA order  "
    )[0]!;
    expect(action.skipReason(order("1", "DELIVERED"))).toBeTruthy();
    client.request.mockResolvedValue(order("1"));
    await action.execute(order("1"));
    expect(client.request).toHaveBeenLastCalledWith("/admin/orders/1/cancel", {
      method: "POST",
      body: '{"reason":"Duplicate QA order"}'
    });
  });

  it("packages only successful PDF invoices and surfaces download failures", async () => {
    const client = api();
    const pdf = new TextEncoder().encode("%PDF-1.4\nQA invoice");
    client.requestResponse
      .mockResolvedValueOnce(
        new Response(pdf, { headers: { "content-type": "application/pdf" } })
      )
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }));
    const action = orderBulkActions(client, { update: false, cancel: false }, "")[0]!;
    const rows = [order("1"), order("2"), order("3")];
    rows[0]!.invoice = {} as AdminOrder["invoice"];
    rows[1]!.invoice = {} as AdminOrder["invoice"];
    const results = await processBulkRows(rows, action);
    expect(results.map((result) => result.status)).toEqual([
      "succeeded",
      "failed",
      "skipped"
    ]);
    const artifact = await action.artifact!(results);
    const buffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(artifact!.blob);
    });
    const files = unzipSync(new Uint8Array(buffer));
    expect(Object.keys(files)).toEqual(["QA-1-1.pdf"]);
    expect(Array.from(files["QA-1-1.pdf"]!)).toEqual(Array.from(pdf));
  });

  it("changes only requested product fields and clears the old subcategory explicitly", async () => {
    const client = api();
    const actions = productBulkActions(client, productValues, labels, false);
    await actions.find((action) => action.id === "category")!.execute(product);
    expect(client.request).toHaveBeenLastCalledWith("/admin/products/p1", {
      method: "PATCH",
      body: '{"categoryId":"c2","subcategoryId":null}'
    });
    await actions.find((action) => action.id === "tax")!.execute(product);
    expect(client.request).toHaveBeenLastCalledWith("/admin/products/p1", {
      method: "PATCH",
      body: '{"taxRate":12.5}'
    });
    await actions.find((action) => action.id === "brand")!.execute(product);
    expect(client.request).toHaveBeenLastCalledWith("/admin/products/p1", {
      method: "PATCH",
      body: '{"brandId":"b2"}'
    });
  });

  it("requires a child category and validates tax input", () => {
    expect(
      productBulkActions(api(), productValues, labels, true).find(
        (action) => action.id === "category"
      )!.validationError
    ).toBeTruthy();
    for (const taxRate of ["", "-1", "101", "NaN", "1e2", "12.345"]) {
      expect(
        productBulkActions(api(), { ...productValues, taxRate }, labels, false).find(
          (action) => action.id === "tax"
        )!.validationError
      ).toBeTruthy();
    }
  });

  it("moderates reviews with the backend moderationNote field and exposes only hide for questions", async () => {
    const client = api();
    const action = feedbackBulkActions(client, "reviews", " QA checked ")[0]!;
    await action.execute({
      id: "r1",
      type: "REVIEW",
      status: "PENDING_REVIEW"
    } as AdminProductFeedback);
    expect(client.request).toHaveBeenCalledWith(
      "/admin/product-feedback/reviews/r1/moderation",
      { method: "PATCH", body: '{"status":"PUBLISHED","moderationNote":"QA checked"}' }
    );
    expect(
      action.skipReason({ type: "QUESTION" } as AdminProductFeedback)
    ).toBeTruthy();
    expect(feedbackBulkActions(client, "questions", "").map((item) => item.id)).toEqual(
      ["HIDDEN"]
    );
  });

  it("uses the pickup override for eligible orders and skips assigned orders", async () => {
    const client = api();
    client.request.mockResolvedValue({});
    const action = deliveryBulkAction(
      client,
      { deliveryPartnerId: "d1", pickupWarehouseId: "w1", note: "Dispatch QA" },
      "QA Partner",
      "QA Warehouse"
    );
    const results = await processBulkRows(
      [
        dispatchOrder("1", "PACKED"),
        { ...dispatchOrder("2", "CONFIRMED"), warehouseId: "w2" },
        dispatchOrder("3", "ASSIGNED")
      ],
      action
    );
    expect(results.map((result) => result.status)).toEqual([
      "succeeded",
      "succeeded",
      "skipped"
    ]);
    expect(
      action.skipReason({ ...dispatchOrder("4", "CONFIRMED"), warehouseId: null })
    ).toBeNull();
    // Queue rows come from the dispatch queue, so no order read access is needed to assign them.
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(client.request).toHaveBeenLastCalledWith("/admin/delivery/assign", {
      method: "POST",
      body: '{"orderId":"2","deliveryPartnerId":"d1","pickupWarehouseId":"w1","note":"Dispatch QA"}'
    });
  });

  it("skips orders dispatched since the queue loaded but reports other refusals", async () => {
    const client = api();
    client.request.mockImplementation(async (_path, init) => {
      const { orderId } = JSON.parse(String(init?.body)) as { orderId: string };

      if (orderId === "taken") {
        throw new AdminApiClientError("Order is no longer available for assignment.", 409);
      }
      if (orderId === "moved") {
        throw new AdminApiClientError(
          "Order can be assigned only after it is confirmed or packed.",
          400
        );
      }
      throw new AdminApiClientError(
        "Delivery partner is not assigned to the pickup warehouse.",
        400
      );
    });
    const action = deliveryBulkAction(
      client,
      { deliveryPartnerId: "d1", pickupWarehouseId: "", note: "" },
      "QA Partner",
      ""
    );
    const results = await processBulkRows(
      [dispatchOrder("taken"), dispatchOrder("moved"), dispatchOrder("elsewhere")],
      action
    );

    expect(results.map((result) => [result.status, result.message])).toEqual([
      ["skipped", "This order is no longer waiting for dispatch."],
      ["skipped", "This order is no longer waiting for dispatch."],
      ["failed", "Delivery partner is not assigned to the pickup warehouse."]
    ]);
  });
});
