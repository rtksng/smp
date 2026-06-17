import type { QueryClient } from "@tanstack/react-query";
import {
  addCartItem,
  buyNowCartItem,
  clearCart,
  removeCartItem,
  updateCartItem,
  type AddCartItemInput,
  type Cart
} from "./cart";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  updateCustomerProfile,
  type CreateCustomerAddressInput,
  type CustomerAddress,
  type CustomerProfileDetails,
  type UpdateCustomerAddressInput,
  type UpdateCustomerProfileInput
} from "./customer-profile";
import {
  cancelOrder,
  createOrder,
  requestOrderReturn,
  reorderOrder,
  type CreateOrderInput,
  type Order
} from "./orders";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  type RazorpayCreateOrder,
  type VerifyRazorpayPaymentInput
} from "./payments";
import type {
  CustomerOtpRequest,
  CustomerSession
} from "./customer-auth";
import { customerQueryKeys } from "./query-keys";

type CartSummarySetter = (summary: Pick<Cart, "itemCount" | "totalQuantity">) => void;
type SuccessHandler<TData> = (data: TData) => void | Promise<void>;
type UpdateCartItemVariables = { itemId: string; quantity: number };
type CartMutationContext = { previousCart?: Cart };

export function syncCartCache(
  queryClient: QueryClient,
  setCartSummary: CartSummarySetter,
  cart: Cart
) {
  setCartSummary(cart);
  queryClient.setQueryData(customerQueryKeys.cart(), cart);
}

export function createAddCartItemMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: addCartItem,
    onSuccess: async (cart: Cart, _variables?: AddCartItemInput) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

export function createBuyNowCartItemMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: buyNowCartItem,
    onSuccess: async (cart: Cart, _variables?: AddCartItemInput) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

export function createUpdateCartItemMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: ({ itemId, quantity }: UpdateCartItemVariables) =>
      updateCartItem(itemId, quantity),
    onError: (
      _error: unknown,
      _variables: UpdateCartItemVariables,
      context?: CartMutationContext
    ) => {
      if (context?.previousCart) {
        syncCartCache(queryClient, setCartSummary, context.previousCart);
      }
    },
    onMutate: async (variables: UpdateCartItemVariables) => {
      await queryClient.cancelQueries({ queryKey: customerQueryKeys.cart() });

      const previousCart = queryClient.getQueryData<Cart>(customerQueryKeys.cart());

      if (previousCart) {
        syncCartCache(
          queryClient,
          setCartSummary,
          updateCartItemQuantity(previousCart, variables)
        );
      }

      return { previousCart };
    },
    onSuccess: async (
      cart: Cart,
      _variables?: UpdateCartItemVariables
    ) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

function updateCartItemQuantity(
  cart: Cart,
  { itemId, quantity }: UpdateCartItemVariables
): Cart {
  const items = cart.items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const subtotal = roundMoney(item.unitPrice * quantity);
    const tax = roundMoney(subtotal * (item.taxRate / 100));

    return {
      ...item,
      isAvailable: item.availableQuantity >= quantity,
      quantity,
      subtotal,
      tax,
      total: roundMoney(subtotal + tax)
    };
  });
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
  const tax = roundMoney(items.reduce((sum, item) => sum + item.tax, 0));
  const grandTotal = roundMoney(
    subtotal + tax + cart.totals.deliveryCharge - cart.totals.discount
  );

  return {
    ...cart,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totals: {
      ...cart.totals,
      grandTotal,
      subtotal,
      tax
    }
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createRemoveCartItemMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: removeCartItem,
    onSuccess: async (cart: Cart, _variables?: string) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

export function createClearCartMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: clearCart,
    onSuccess: async (cart: Cart) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

export function createUpdateProfileMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<CustomerProfileDetails>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: updateCustomerProfile,
    onSuccess: async (
      profile: CustomerProfileDetails,
      _variables?: UpdateCustomerProfileInput
    ) => {
      queryClient.setQueryData(customerQueryKeys.profile(), profile);
      await onSuccess?.(profile);
    }
  };
}

export function createCreateAddressMutation({
  mode = "invalidate",
  onSuccess,
  queryClient
}: {
  mode?: "invalidate" | "prepend";
  onSuccess?: SuccessHandler<CustomerAddress>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: createCustomerAddress,
    onSuccess: async (
      address: CustomerAddress,
      _variables?: CreateCustomerAddressInput
    ) => {
      if (mode === "prepend") {
        queryClient.setQueryData<CustomerAddress[]>(
          customerQueryKeys.addresses(),
          (existing = []) => [address, ...existing]
        );
      } else {
        await queryClient.invalidateQueries({
          queryKey: customerQueryKeys.addresses()
        });
      }

      await onSuccess?.(address);
    }
  };
}

export function createUpdateAddressMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<CustomerAddress>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: ({
      addressId,
      input
    }: {
      addressId: string;
      input: UpdateCustomerAddressInput;
    }) => updateCustomerAddress(addressId, input),
    onSuccess: async (
      address: CustomerAddress,
      _variables?: {
        addressId: string;
        input: UpdateCustomerAddressInput;
      }
    ) => {
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.addresses()
      });
      await onSuccess?.(address);
    }
  };
}

export function createSetDefaultAddressMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<CustomerAddress>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: setDefaultCustomerAddress,
    onSuccess: async (address: CustomerAddress, _variables?: string) => {
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.addresses()
      });
      await onSuccess?.(address);
    }
  };
}

export function createDeleteAddressMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<void>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: deleteCustomerAddress,
    onSuccess: async (_data: void, _variables?: string) => {
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.addresses()
      });
      await onSuccess?.(undefined);
    }
  };
}

export function createCheckoutOrderMutation() {
  return {
    mutationFn: (input: CreateOrderInput) => createOrder(input)
  };
}

export function createCheckoutRazorpayOrderMutation() {
  return {
    mutationFn: (orderId: string) => createRazorpayOrder(orderId)
  };
}

export function createCheckoutPaymentVerificationMutation() {
  return {
    mutationFn: (input: VerifyRazorpayPaymentInput) =>
      verifyRazorpayPayment(input)
  };
}

export function createReorderMutation({
  onSuccess,
  queryClient,
  setCartSummary
}: {
  onSuccess?: SuccessHandler<Cart>;
  queryClient: QueryClient;
  setCartSummary: CartSummarySetter;
}) {
  return {
    mutationFn: (orderId: string) => reorderOrder(orderId),
    onSuccess: async (cart: Cart, _variables?: string) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
}

export function createCancelOrderMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<Order>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      cancelOrder(orderId, reason),
    onSuccess: async (order: Order) => {
      queryClient.setQueryData(customerQueryKeys.order(order.id), order);
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.orders()
      });
      await onSuccess?.(order);
    }
  };
}

export function createRequestReturnMutation({
  onSuccess,
  queryClient
}: {
  onSuccess?: SuccessHandler<Order>;
  queryClient: QueryClient;
}) {
  return {
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      requestOrderReturn(orderId, reason),
    onSuccess: async (order: Order) => {
      queryClient.setQueryData(customerQueryKeys.order(order.id), order);
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.orders()
      });
      await onSuccess?.(order);
    }
  };
}

export function createRequestOtpMutation({
  onSuccess,
  requestOtp
}: {
  onSuccess?: SuccessHandler<CustomerOtpRequest>;
  requestOtp: (mobileNumber: string) => Promise<CustomerOtpRequest>;
}) {
  return {
    mutationFn: requestOtp,
    onSuccess
  };
}

export function createVerifyOtpMutation({
  onSuccess,
  verifyOtp
}: {
  onSuccess?: SuccessHandler<CustomerSession>;
  verifyOtp: (otp: string) => Promise<CustomerSession>;
}) {
  return {
    mutationFn: verifyOtp,
    onSuccess
  };
}

export function createLogoutMutation({
  logout,
  onSettled
}: {
  logout: () => Promise<void>;
  onSettled?: () => void;
}) {
  return {
    mutationFn: logout,
    onSettled
  };
}

export type AddCartItemMutationInput = AddCartItemInput;
export type CheckoutOrderMutationResult = Order;
export type CheckoutRazorpayOrderMutationResult = RazorpayCreateOrder;
export type CreateAddressMutationInput = CreateCustomerAddressInput;
export type UpdateProfileMutationInput = UpdateCustomerProfileInput;
