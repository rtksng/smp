export const customerQueryKeys = {
  addresses: () => ["customer-addresses"] as const,
  cart: () => ["cart"] as const,
  order: (orderId: string) => ["customer-order", orderId] as const,
  orders: (page = 1, limit = 20) => ["customer-orders", page, limit] as const,
  paymentGatewayStatus: () => ["payment-gateway-status"] as const,
  profile: () => ["customer-profile"] as const
};
