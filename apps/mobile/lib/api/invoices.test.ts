import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCustomerApiAuth } from "./customer-client";
import { canDownloadOrderInvoice, fetchOrderInvoicePdf, shareOrderInvoice } from "./invoices";
import type { Order } from "./schemas";

const native = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => undefined),
  write: vi.fn()
}));

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    write = native.write;
    constructor(directory: string, filename: string) { this.uri = `${directory}/${filename}`; }
  },
  Paths: { cache: "file:///app-cache" }
}));
vi.mock("expo-sharing", () => native);

beforeEach(() => {
  vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.example.com/api/v1");
  setCustomerApiAuth({
    clearSession: vi.fn(),
    getAccessToken: () => "current-test-session",
    refreshAccessToken: vi.fn(async () => "refreshed-test-session")
  });
});

afterEach(() => {
  setCustomerApiAuth(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function pdfResponse() {
  return new Response("%PDF-1.7 invoice", { headers: { "Content-Type": "application/pdf" } });
}

function orderFixture(): Order {
  return {
    id: "order-1", orderNumber: "SMP-001", createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z", placedAt: "2026-09-07T00:00:00.000Z",
    status: "CONFIRMED", paymentMethod: "COD", paymentStatus: "PENDING",
    deliveryTracking: [], refunds: [], shippingAddress: null, statusHistory: [], warehouseId: null,
    totals: { subtotal: 500, tax: 90, deliveryCharge: 50, discount: 0, grandTotal: 640 },
    items: [{ id: "item-1", productId: "product-1", name: "Forceps", quantity: 1,
      sku: "FORCEPS-001", stockBatchId: null, taxAmount: 90, taxRate: 18, total: 590,
      unitPrice: 500, variantId: null, warehouseId: null }]
  };
}

describe("customer invoice availability", () => {
  it("matches confirmed COD and paid online eligibility", () => {
    const order = orderFixture();
    order.status = "CONFIRMED";
    order.paymentMethod = "COD";
    expect(canDownloadOrderInvoice(order)).toBe(true);
    order.paymentMethod = "ONLINE";
    order.paymentStatus = "PENDING";
    expect(canDownloadOrderInvoice(order)).toBe(false);
    order.paymentStatus = "PAID";
    expect(canDownloadOrderInvoice(order)).toBe(true);
    order.status = "CANCELLED";
    expect(canDownloadOrderInvoice(order)).toBe(false);
    order.status = "CREATED";
    expect(canDownloadOrderInvoice(order)).toBe(false);
    order.status = "DELIVERED";
    order.items = [];
    expect(canDownloadOrderInvoice(order)).toBe(false);
  });
});

describe("authenticated invoice download and native share", () => {
  it("retries an expired session and preserves the binary PDF without putting authorization in the URL", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(pdfResponse());
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await fetchOrderInvoicePdf("order/1");

    expect(new TextDecoder().decode(bytes)).toBe("%PDF-1.7 invoice");
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      "https://api.example.com/api/v1/orders/order%2F1/invoice?format=pdf",
      expect.objectContaining({ headers: { Accept: "application/pdf", Authorization: "Bearer current-test-session" } })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      "https://api.example.com/api/v1/orders/order%2F1/invoice?format=pdf",
      expect.objectContaining({ headers: { Accept: "application/pdf", Authorization: "Bearer refreshed-test-session" } })
    );
  });

  it("writes and shares a private cache PDF using the OS share sheet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => pdfResponse()));
    const order = orderFixture();
    order.status = "CONFIRMED";
    order.paymentMethod = "COD";
    order.orderNumber = "SMP/2026/1";

    await shareOrderInvoice(order);

    expect(native.write).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(native.shareAsync).toHaveBeenCalledWith("file:///app-cache/invoice-SMP-2026-1.pdf", {
      dialogTitle: "Invoice SMP/2026/1", mimeType: "application/pdf", UTI: "com.adobe.pdf"
    });
  });

  it("does not write or share a successful response containing an error page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Error</html>", {
      headers: { "Content-Type": "text/html" }
    })));
    await expect(fetchOrderInvoicePdf("order-1")).rejects.toMatchObject({ code: "INVALID_INVOICE" });
    expect(native.write).not.toHaveBeenCalled();
    expect(native.shareAsync).not.toHaveBeenCalled();
  });

  it("surfaces API errors without writing private files", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      success: false, error: { code: "FORBIDDEN", message: "Invoice is not available." }
    }), { status: 403 })));
    await expect(fetchOrderInvoicePdf("order-1")).rejects.toMatchObject({
      status: 403, message: "Invoice is not available."
    });
    expect(native.write).not.toHaveBeenCalled();
  });
});
