import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCartItem,
  buyNowCartItem,
  clearCart,
  getCart,
  updateCartItem
} from "./cart";
import { createCustomerAddress, listCustomerAddresses } from "./customer-profile";
import { createOrder } from "./orders";
import {
  createRazorpayOrder,
  getPaymentGatewayStatus,
  verifyRazorpayPayment
} from "./payments";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

describe("checkout flow API helpers", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com/api/v1";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    vi.restoreAllMocks();
  });

  it("fetches the authenticated customer cart", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: "cart_1",
        itemCount: 1,
        items: [
          {
            availableQuantity: 4,
            brand: {
              id: "brand_1",
              name: "SurgiPro",
              slug: "surgipro"
            },
            category: {
              id: "category_1",
              name: "Surgical Instruments",
              slug: "surgical-instruments"
            },
            createdAt: "2026-05-25T10:00:00.000Z",
            id: "cart_item_1",
            imageUrl: "https://cdn.example.com/forceps.jpg",
            isAvailable: true,
            name: "Curved Artery Forceps",
            productId: "product_1",
            productStatus: "ACTIVE",
            quantity: 2,
            sku: "FORCEPS-001",
            slug: "curved-artery-forceps",
            subcategory: {
              id: "subcategory_1",
              name: "Forceps",
              slug: "forceps"
            },
            subtotal: 280,
            tax: 50.4,
            taxRate: 18,
            total: 330.4,
            unitPrice: 140,
            updatedAt: "2026-05-25T10:00:00.000Z",
            variantId: null,
            variantName: null,
            variantStatus: null
          }
        ],
        totalQuantity: 2,
        totals: {
          deliveryCharge: 0,
          discount: 0,
          grandTotal: 330.4,
          subtotal: 280,
          tax: 50.4
        },
        updatedAt: "2026-05-25T10:00:00.000Z"
      })
    );

    await expect(getCart()).resolves.toMatchObject({
      itemCount: 1,
      items: [{ sku: "FORCEPS-001" }],
      totalQuantity: 2
    });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      new URL("https://api.example.com/api/v1/cart")
    );
  });

  it("mutates cart items through the customer cart endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(emptyCart()))
      .mockResolvedValueOnce(jsonResponse(emptyCart()))
      .mockResolvedValueOnce(jsonResponse(emptyCart()))
      .mockResolvedValueOnce(jsonResponse(emptyCart()));

    await addCartItem({ productId: "product_1", quantity: 2, variantId: null });
    await updateCartItem("cart_item_1", 3);
    await buyNowCartItem({ productId: "product_2", quantity: 1, variantId: null });
    await clearCart();

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/cart/items", "POST"],
      ["https://api.example.com/api/v1/cart/items/cart_item_1", "PATCH"],
      ["https://api.example.com/api/v1/cart/buy-now", "POST"],
      ["https://api.example.com/api/v1/cart", "DELETE"]
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ productId: "product_1", quantity: 2, variantId: null })
    );
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ quantity: 3 }));
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ productId: "product_2", quantity: 1, variantId: null })
    );
  });

  it("lists and creates customer checkout addresses", async () => {
    const address = {
      addressLine1: "12 Surgical Street",
      addressLine2: null,
      city: "Mumbai",
      createdAt: "2026-05-25T10:00:00.000Z",
      fullName: "Dr Asha Rao",
      id: "address_1",
      isDefault: true,
      landmark: null,
      latitude: null,
      longitude: null,
      phone: "+919876543210",
      pincode: "400001",
      state: "Maharashtra",
      type: "CLINIC",
      updatedAt: "2026-05-25T10:00:00.000Z"
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([address]))
      .mockResolvedValueOnce(jsonResponse(address, 201));

    await expect(listCustomerAddresses()).resolves.toEqual([address]);
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

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/me/addresses", undefined],
      ["https://api.example.com/api/v1/me/addresses", "POST"]
    ]);
  });

  it("creates COD and ONLINE orders from the customer cart", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        createdAt: "2026-05-25T10:00:00.000Z",
        id: "order_1",
        items: [],
        orderNumber: "ORD-20260525-ABC12345",
        paymentMethod: "COD",
        paymentStatus: "PENDING",
        placedAt: "2026-05-25T10:00:00.000Z",
        shippingAddress: null,
        status: "CREATED",
        statusHistory: [],
        totals: {
          deliveryCharge: 0,
          discount: 0,
          grandTotal: 330.4,
          subtotal: 280,
          tax: 50.4
        },
        updatedAt: "2026-05-25T10:00:00.000Z",
        warehouseId: null
      }, 201)
    );

    await createOrder({
      billingAddressId: null,
      paymentMethod: "COD",
      shippingAddressId: "address_1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://api.example.com/api/v1/orders"),
      expect.objectContaining({
        body: JSON.stringify({
          billingAddressId: null,
          paymentMethod: "COD",
          shippingAddressId: "address_1"
        }),
        method: "POST"
      })
    );
  });

  it("starts and verifies Razorpay payments through backend endpoints", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          orderId: "order_1",
          paymentId: "payment_1",
          razorpay: {
            amount: 33040,
            currency: "INR",
            keyId: "rzp_test_123",
            orderId: "order_gateway_1"
          }
        }, 201)
      )
      .mockResolvedValueOnce(
        jsonResponse({
          orderStatus: "CONFIRMED",
          paymentId: "payment_1",
          paymentStatus: "PAID"
        })
      );

    await createRazorpayOrder("order_1");
    await verifyRazorpayPayment({
      orderId: "order_1",
      razorpay_order_id: "order_gateway_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "signature_1"
    });

    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/payments/razorpay/create-order", "POST"],
      ["https://api.example.com/api/v1/payments/razorpay/verify", "POST"]
    ]);
  });

  it("fetches payment gateway availability before online checkout", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        message: "Payment gateway is not configured yet.",
        onlinePaymentEnabled: false,
        provider: "razorpay"
      })
    );

    await expect(getPaymentGatewayStatus()).resolves.toEqual({
      message: "Payment gateway is not configured yet.",
      onlinePaymentEnabled: false,
      provider: "razorpay"
    });
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method])).toEqual([
      ["https://api.example.com/api/v1/payments/gateway-status", undefined]
    ]);
  });
});

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

function emptyCart() {
  return {
    id: "cart_1",
    itemCount: 0,
    items: [],
    totalQuantity: 0,
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: 0,
      subtotal: 0,
      tax: 0
    },
    updatedAt: "2026-05-25T10:00:00.000Z"
  };
}
