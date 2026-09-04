import type { QuoteRequest } from "../api/quotes";
import type { AvailableCoupon, CouponValidation } from "../api/coupons";
import type { Address, Cart } from "../api/schemas";

export function quoteFixture(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    id: "quote-mobile-1", name: "QA Customer", email: "qa@example.com", mobileNumber: "+919000000000",
    message: "Need one sterile kit for a clinic.", organization: null, createdAt: "2026-09-04T10:00:00.000Z",
    status: "QUOTED", customerDecision: null, convertedCartId: null, convertedOrderId: null,
    quotation: {
      respondedAt: "2026-09-04T11:00:00.000Z", validUntil: "2099-12-31", notes: "Agreed clinic price.",
      items: [{ productId: "product-1", variantId: null, name: "Sterile kit", sku: "KIT-001", quantity: 1, unitPrice: 500, taxRate: 18, lineSubtotal: 500, taxAmount: 90, lineTotal: 590 }],
      totals: { subtotal: 500, taxTotal: 90, shippingTotal: 25.5, grandTotal: 615.5 }
    }, ...overrides
  };
}

export function cartFixture(): Cart {
  return {
    id: "cart-mobile-1", itemCount: 1, totalQuantity: 1, updatedAt: "2026-09-04T11:00:00.000Z",
    items: [{ id: "cart-item-1", productId: "product-1", variantId: null, variantName: null, variantStatus: null,
      name: "Sterile kit", sku: "KIT-001", slug: "sterile-kit", quantity: 1, unitPrice: 500, subtotal: 500,
      taxRate: 18, tax: 90, total: 590, availableQuantity: 50, isAvailable: true, imageUrl: null,
      brand: { id: "brand-1", name: "Clinic", slug: "clinic" }, category: { id: "category-1", name: "Kits", slug: "kits" },
      subcategory: null, productStatus: "ACTIVE", createdAt: "2026-09-04T11:00:00.000Z", updatedAt: "2026-09-04T11:00:00.000Z" }],
    totals: { subtotal: 500, tax: 90, deliveryCharge: 25.5, discount: 0, grandTotal: 615.5 }
  };
}

export const addressFixture: Address = {
  id: "address-1", addressLine1: "Clinic road", addressLine2: null, city: "Kharar", state: "Punjab", pincode: "140301",
  fullName: "QA Customer", phone: "+919000000000", isDefault: true, type: "CLINIC", landmark: null, latitude: null, longitude: null,
  createdAt: "2026-09-04T10:00:00.000Z", updatedAt: "2026-09-04T10:00:00.000Z"
};

export const availableCouponFixture: AvailableCoupon = {
  code: "SAVE50", type: "FIXED_AMOUNT", value: 50, minOrderAmount: 500, maxDiscount: null, expiresAt: null
};
export const couponValidationFixture: CouponValidation = {
  code: "SAVE50", discount: 50, subtotal: 500, tax: 90, grandTotal: 540, message: "SAVE50 applied successfully."
};
