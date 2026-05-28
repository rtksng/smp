import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerProfile,
  listCustomerAddresses,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
  type CustomerAddress
} from "./customer-profile";
import {
  canDownloadOrderInvoice,
  getOrder,
  listCustomerOrders,
  type Order
} from "./orders";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("account API helpers", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("gets and updates the authenticated customer profile", async () => {
    const profile = {
      businessName: "Rao Medical Supplies",
      email: "billing@example.com",
      gstNumber: "27ABCDE1234F1Z5",
      id: "customer_1",
      mobileNumber: "+919876543210",
      name: "Dr Asha Rao"
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(profile))
      .mockResolvedValueOnce(jsonResponse({ ...profile, businessName: null }));

    await expect(getCustomerProfile()).resolves.toEqual(profile);
    await updateCustomerProfile({
      businessName: null,
      email: "billing@example.com",
      gstNumber: "27abcde1234f1z5",
      name: "Dr Asha Rao"
    });

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/me", undefined],
      ["https://api.example.com/api/v1/me", "PATCH"]
    ]);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        businessName: null,
        email: "billing@example.com",
        gstNumber: "27ABCDE1234F1Z5",
        name: "Dr Asha Rao"
      })
    );
  });

  it("supports listing, creating, editing, defaulting, and deleting addresses", async () => {
    const address = accountAddress();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([address]))
      .mockResolvedValueOnce(jsonResponse(address, 201))
      .mockResolvedValueOnce(jsonResponse({ ...address, city: "Pune" }))
      .mockResolvedValueOnce(jsonResponse({ ...address, isDefault: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await listCustomerAddresses();
    await createCustomerAddress({
      addressLine1: "12 Surgical Street",
      addressLine2: null,
      city: "Mumbai",
      fullName: "Dr Asha Rao",
      landmark: null,
      phone: "+919876543210",
      pincode: "400001",
      state: "Maharashtra",
      type: "CLINIC"
    });
    await updateCustomerAddress("address_1", {
      ...address,
      city: "Pune"
    });
    await setDefaultCustomerAddress("address_1");
    await deleteCustomerAddress("address_1");

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/me/addresses", undefined],
      ["https://api.example.com/api/v1/me/addresses", "POST"],
      ["https://api.example.com/api/v1/me/addresses/address_1", "PATCH"],
      ["https://api.example.com/api/v1/me/addresses/address_1/default", "PATCH"],
      ["https://api.example.com/api/v1/me/addresses/address_1", "DELETE"]
    ]);
  });

  it("lists and loads customer orders through account endpoints", async () => {
    const order = accountOrder({
      paymentMethod: "COD",
      paymentStatus: "PENDING",
      status: "CREATED"
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          items: [order],
          pagination: {
            hasNextPage: false,
            hasPreviousPage: false,
            limit: 20,
            page: 1,
            total: 1,
            totalPages: 1
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse(order));

    await expect(listCustomerOrders()).resolves.toMatchObject({
      items: [{ id: "order_1", orderNumber: "ORD-20260525-ABC12345" }]
    });
    await expect(getOrder("order_1")).resolves.toMatchObject({
      id: "order_1"
    });

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/orders/my?limit=20&page=1", undefined],
      ["https://api.example.com/api/v1/orders/order_1", undefined]
    ]);
  });

  it("shows invoice downloads only for invoiceable orders", () => {
    expect(
      canDownloadOrderInvoice(
        accountOrder({
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          status: "CONFIRMED"
        })
      )
    ).toBe(true);
    expect(
      canDownloadOrderInvoice(
        accountOrder({
          paymentMethod: "ONLINE",
          paymentStatus: "PAID",
          status: "PACKED"
        })
      )
    ).toBe(true);
    expect(
      canDownloadOrderInvoice(
        accountOrder({
          paymentMethod: "ONLINE",
          paymentStatus: "PENDING",
          status: "CONFIRMED"
        })
      )
    ).toBe(false);
    expect(
      canDownloadOrderInvoice(
        accountOrder({
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          status: "CREATED"
        })
      )
    ).toBe(false);
  });
});

function accountAddress(): CustomerAddress {
  return {
    addressLine1: "12 Surgical Street",
    addressLine2: null,
    city: "Mumbai",
    createdAt: "2026-05-25T10:00:00.000Z",
    fullName: "Dr Asha Rao",
    id: "address_1",
    isDefault: false,
    landmark: null,
    latitude: null,
    longitude: null,
    phone: "+919876543210",
    pincode: "400001",
    state: "Maharashtra",
    type: "CLINIC",
    updatedAt: "2026-05-25T10:00:00.000Z"
  };
}

function accountOrder({
  paymentMethod,
  paymentStatus,
  status
}: {
  paymentMethod: Order["paymentMethod"];
  paymentStatus: Order["paymentStatus"];
  status: Order["status"];
}): Order {
  return {
    createdAt: "2026-05-25T10:00:00.000Z",
    id: "order_1",
    items: [
      {
        id: "item_1",
        name: "Curved Artery Forceps",
        productId: "product_1",
        quantity: 2,
        sku: "FORCEPS-001",
        stockBatchId: null,
        taxAmount: 50.4,
        taxRate: 18,
        total: 330.4,
        unitPrice: 140,
        variantId: null,
        warehouseId: null
      }
    ],
    orderNumber: "ORD-20260525-ABC12345",
    paymentMethod,
    paymentStatus,
    placedAt: "2026-05-25T10:00:00.000Z",
    shippingAddress: {
      city: "Mumbai",
      country: "India",
      fullName: "Dr Asha Rao",
      id: "address_1",
      line1: "12 Surgical Street",
      line2: null,
      mobileNumber: "+919876543210",
      pincode: "400001",
      state: "Maharashtra"
    },
    status,
    statusHistory: [
      {
        changedById: null,
        createdAt: "2026-05-25T10:00:00.000Z",
        id: "history_1",
        note: null,
        status: "CREATED"
      }
    ],
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: 330.4,
      subtotal: 280,
      tax: 50.4
    },
    updatedAt: "2026-05-25T10:00:00.000Z",
    warehouseId: null
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      data,
      meta: {
        method: "GET",
        path: "/api/v1/test",
        timestamp: "2026-05-25T10:00:00.000Z"
      },
      success: true
    }),
    { status }
  );
}
