import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { customerQueryKeys } from "./query-keys";
import {
  createAddCartItemMutation,
  createCreateAddressMutation,
  createUpdateCartItemMutation,
  createUpdateProfileMutation,
  syncCartCache
} from "./mutation-helpers";
import type { Cart } from "./cart";
import type {
  CustomerAddress,
  CustomerProfileDetails
} from "./customer-profile";

describe("customer API mutation helpers", () => {
  it("uses shared query keys for cart cache writes", () => {
    const setQueryData = vi.fn();
    const setCartSummary = vi.fn();
    const cart = emptyCart();

    syncCartCache(
      { setQueryData } as unknown as QueryClient,
      setCartSummary,
      cart
    );

    expect(setCartSummary).toHaveBeenCalledWith(cart);
    expect(setQueryData).toHaveBeenCalledWith(customerQueryKeys.cart(), cart);
  });

  it("builds cart mutation options that update the shared cart cache", () => {
    const setQueryData = vi.fn();
    const setCartSummary = vi.fn();
    const onSuccess = vi.fn();
    const cart = emptyCart();

    const options = createAddCartItemMutation({
      onSuccess,
      queryClient: { setQueryData } as unknown as QueryClient,
      setCartSummary
    });

    options.onSuccess?.(cart, { productId: "product_1", quantity: 1 });

    expect(setCartSummary).toHaveBeenCalledWith(cart);
    expect(setQueryData).toHaveBeenCalledWith(customerQueryKeys.cart(), cart);
    expect(onSuccess).toHaveBeenCalledWith(cart);
  });

  it("optimistically recalculates cart totals for quantity changes", async () => {
    const queryClient = new QueryClient();
    const setCartSummary = vi.fn();
    const cart = cartWithItem();

    queryClient.setQueryData(customerQueryKeys.cart(), cart);

    const options = createUpdateCartItemMutation({
      queryClient,
      setCartSummary
    });

    await options.onMutate?.({ itemId: "cart_item_1", quantity: 3 });

    expect(queryClient.getQueryData<Cart>(customerQueryKeys.cart())).toMatchObject({
      items: [
        {
          id: "cart_item_1",
          quantity: 3,
          subtotal: 420,
          tax: 75.6,
          total: 495.6
        }
      ],
      totalQuantity: 3,
      totals: {
        grandTotal: 495.6,
        subtotal: 420,
        tax: 75.6
      }
    });
    expect(setCartSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({
        totalQuantity: 3
      })
    );
  });

  it("builds profile mutation options that update the shared profile cache", () => {
    const setQueryData = vi.fn();
    const profile: CustomerProfileDetails = {
      businessName: null,
      email: "billing@example.com",
      gstNumber: null,
      id: "customer_1",
      mobileNumber: "+919876543210",
      name: "Dr Asha Rao"
    };

    const options = createUpdateProfileMutation({
      queryClient: { setQueryData } as unknown as QueryClient
    });

    options.onSuccess?.(profile, { email: "billing@example.com" });

    expect(setQueryData).toHaveBeenCalledWith(
      customerQueryKeys.profile(),
      profile
    );
  });

  it("builds address mutation options that prepend checkout addresses", () => {
    const setQueryData = vi.fn();
    const address: CustomerAddress = {
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

    const options = createCreateAddressMutation({
      mode: "prepend",
      queryClient: { setQueryData } as unknown as QueryClient
    });

    options.onSuccess?.(
      address,
      {
        addressLine1: address.addressLine1,
        city: address.city,
        fullName: address.fullName,
        phone: address.phone,
        pincode: address.pincode,
        state: address.state,
        type: address.type
      },
    );

    expect(setQueryData).toHaveBeenCalledWith(
      customerQueryKeys.addresses(),
      expect.any(Function)
    );
    expect(
      (
        setQueryData.mock.calls[0]?.[1] as (
          addresses?: CustomerAddress[]
        ) => CustomerAddress[]
      )([])
    ).toEqual([address]);
  });
});

function emptyCart(): Cart {
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

function cartWithItem(): Cart {
  return {
    id: "cart_1",
    itemCount: 1,
    items: [
      {
        availableQuantity: 10,
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
        subcategory: null,
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
  };
}
