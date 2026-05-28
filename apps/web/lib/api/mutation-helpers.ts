import type { QueryClient } from "@tanstack/react-query";
import {
  addCartItem,
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
  createOrder,
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
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: async (
      cart: Cart,
      _variables?: { itemId: string; quantity: number }
    ) => {
      syncCartCache(queryClient, setCartSummary, cart);
      await onSuccess?.(cart);
    }
  };
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
