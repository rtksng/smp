export const queryKeys = {
  addresses: ["customer", "addresses"] as const,
  brands: ["catalog", "brands"] as const,
  cart: (shippingAddressId?: string | null) =>
    ["customer", "cart", shippingAddressId ?? "default"] as const,
  categories: ["catalog", "categories"] as const,
  order: (id: string) => ["customer", "orders", id] as const,
  orders: ["customer", "orders"] as const,
  paymentGateway: ["customer", "payment-gateway"] as const,
  productFeedback: (slug: string) =>
    ["catalog", "product-feedback", slug] as const,
  products: (query: Record<string, unknown>) => ["catalog", "products", query] as const,
  product: (slug: string) => ["catalog", "product", slug] as const,
  relatedProducts: (slug: string) =>
    ["catalog", "related-products", slug] as const,
  similarProducts: (slug: string) =>
    ["catalog", "similar-products", slug] as const,
  wishlist: ["customer", "wishlist"] as const,
  profile: ["customer", "profile"] as const
};
