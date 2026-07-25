import { z } from "zod";
import { resolveMediaUrl } from "./upload-url";

const mediaUrlSchema = z.string().transform(resolveMediaUrl);
const nullableMediaUrlSchema = z
  .string()
  .nullable()
  .transform((value) => (value ? resolveMediaUrl(value) : null));

export const productStatusSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "OUT_OF_STOCK"
]);

export const productImageSchema = z.object({
  altText: z.string().nullable(),
  id: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
  url: mediaUrlSchema
});

export const productBrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const productCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string()
});

export const productVariantSchema = z.object({
  attributes: z.record(z.string(), z.unknown()),
  id: z.string(),
  mrp: z.number(),
  name: z.string(),
  sellingPrice: z.number(),
  sku: z.string(),
  status: productStatusSchema
});

export const productSchema = z.object({
  basePrice: z.number(),
  brand: productBrandSchema,
  brandId: z.string(),
  category: productCategorySchema,
  categoryId: z.string(),
  createdAt: z.string(),
  description: z.string(),
  disposable: z.boolean(),
  documents: z
    .array(
      z.object({
        fileKey: z.string(),
        fileUrl: mediaUrlSchema,
        id: z.string(),
        title: z.string(),
        type: z.string()
      })
    )
    .default([]),
  expirySensitive: z.boolean(),
  id: z.string(),
  images: z.array(productImageSchema),
  inStock: z.boolean(),
  material: z.string().nullable(),
  medicalSpecialty: z.string().nullable(),
  metaDescription: z.string().nullable(),
  metaTitle: z.string().nullable(),
  mrp: z.number(),
  name: z.string(),
  packSize: z.string().nullable(),
  searchTags: z.array(z.string()),
  sellingPrice: z.number(),
  shortDescription: z.string(),
  sku: z.string(),
  slug: z.string(),
  status: productStatusSchema,
  sterile: z.boolean(),
  subcategory: productCategorySchema.nullable(),
  subcategoryId: z.string().nullable(),
  taxRate: z.number(),
  unit: z.string(),
  updatedAt: z.string(),
  variants: z.array(productVariantSchema)
});

export const paginationSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  limit: z.number(),
  page: z.number(),
  total: z.number(),
  totalPages: z.number()
});

export const productListSchema = z.object({
  items: z.array(productSchema),
  pagination: paginationSchema
});

const categoryBaseSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  imageUrl: nullableMediaUrlSchema,
  isActive: z.boolean(),
  name: z.string(),
  parentId: z.string().nullable(),
  slug: z.string(),
  sortOrder: z.number()
});

export type Category = z.infer<typeof categoryBaseSchema> & {
  children: Category[];
};

export const categorySchema: z.ZodType<Category> = categoryBaseSchema.extend({
  children: z.lazy(() => z.array(categorySchema))
});

export const brandSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  isActive: z.boolean(),
  logoUrl: nullableMediaUrlSchema,
  name: z.string(),
  slug: z.string()
});

export const tokenSetSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  accessTokenExpiresInSeconds: z.number(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
  refreshTokenExpiresInSeconds: z.number(),
  tokenType: z.literal("Bearer")
});

export const authenticatedCustomerSchema = z.object({
  email: z.string().nullable(),
  firstName: z.string(),
  id: z.string(),
  lastName: z.string().nullable(),
  mobileNumber: z.string()
});

export const customerSessionSchema = z.object({
  customer: authenticatedCustomerSchema,
  tokens: tokenSetSchema
});

export const customerProfileSchema = z.object({
  businessName: z.string().nullable(),
  email: z.string().nullable(),
  gstNumber: z.string().nullable(),
  id: z.string(),
  mobileNumber: z.string(),
  name: z.string()
});

export const addressTypeSchema = z.enum([
  "CLINIC",
  "HOME",
  "HOSPITAL",
  "OTHER",
  "WORK"
]);

export const addressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  createdAt: z.string(),
  fullName: z.string(),
  id: z.string(),
  isDefault: z.boolean(),
  landmark: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phone: z.string(),
  pincode: z.string(),
  state: z.string(),
  type: addressTypeSchema,
  updatedAt: z.string()
});

export const addressInputSchema = z.object({
  addressLine1: z.string().trim().min(1, "Address line 1 is required.").max(500),
  addressLine2: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().min(1, "City is required.").max(120),
  fullName: z.string().trim().min(1, "Full name is required.").max(160),
  landmark: z.string().trim().max(160).nullable().optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number with country code."),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "Enter a 6 digit pincode."),
  state: z.string().trim().min(1, "State is required.").max(120),
  type: addressTypeSchema
});

export const cartTotalsSchema = z.object({
  deliveryCharge: z.number(),
  discount: z.number(),
  grandTotal: z.number(),
  subtotal: z.number(),
  tax: z.number()
});

export const cartItemSchema = z.object({
  availableQuantity: z.number(),
  brand: productBrandSchema,
  category: productCategorySchema,
  createdAt: z.string(),
  id: z.string(),
  imageUrl: nullableMediaUrlSchema,
  isAvailable: z.boolean(),
  name: z.string(),
  productId: z.string(),
  productStatus: productStatusSchema,
  quantity: z.number(),
  sku: z.string(),
  slug: z.string(),
  subcategory: productCategorySchema.nullable(),
  subtotal: z.number(),
  tax: z.number(),
  taxRate: z.number(),
  total: z.number(),
  unitPrice: z.number(),
  updatedAt: z.string(),
  variantId: z.string().nullable(),
  variantName: z.string().nullable(),
  variantStatus: productStatusSchema.nullable()
});

export const cartSchema = z.object({
  id: z.string(),
  itemCount: z.number(),
  items: z.array(cartItemSchema),
  totalQuantity: z.number(),
  totals: cartTotalsSchema,
  updatedAt: z.string()
});

export const paymentMethodSchema = z.enum(["COD", "ONLINE"]);
export const paymentStatusSchema = z.enum([
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELLED"
]);
export const orderStatusSchema = z.enum([
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED"
]);
export const refundStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
]);
export const deliveryStatusSchema = z.enum([
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
]);

export const orderSchema = z.object({
  createdAt: z.string(),
  deliveryTracking: z
    .array(
      z.object({
        assignedAt: z.string(),
        deliveredAt: z.string().nullable(),
        deliveryPartnerName: z.string().nullable(),
        failureReason: z.string().nullable(),
        id: z.string(),
        pickedUpAt: z.string().nullable(),
        proofOfDeliveryUrl: z.string().nullable(),
        status: deliveryStatusSchema,
        statusHistory: z.array(
          z.object({
            createdAt: z.string(),
            id: z.string(),
            latitude: z.number().nullable(),
            longitude: z.number().nullable(),
            note: z.string().nullable(),
            status: deliveryStatusSchema
          })
        ),
        vehicleNumber: z.string().nullable()
      })
    )
    .default([]),
  id: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      productId: z.string().nullable(),
      quantity: z.number(),
      sku: z.string(),
      stockBatchId: z.string().nullable(),
      taxAmount: z.number(),
      taxRate: z.number(),
      total: z.number(),
      unitPrice: z.number(),
      variantId: z.string().nullable(),
      warehouseId: z.string().nullable()
    })
  ),
  orderNumber: z.string(),
  paymentMethod: paymentMethodSchema.nullable(),
  paymentStatus: paymentStatusSchema,
  placedAt: z.string().nullable(),
  refunds: z
    .array(
      z.object({
        amount: z.number(),
        createdAt: z.string(),
        id: z.string(),
        processedAt: z.string().nullable(),
        providerRefundId: z.string().nullable().default(null),
        reason: z.string().nullable(),
        status: refundStatusSchema
      })
    )
    .default([]),
  shippingAddress: z
    .object({
      city: z.string(),
      country: z.string(),
      fullName: z.string(),
      id: z.string(),
      line1: z.string(),
      line2: z.string().nullable(),
      mobileNumber: z.string(),
      pincode: z.string(),
      state: z.string()
    })
    .nullable(),
  status: orderStatusSchema,
  statusHistory: z.array(
    z.object({
      changedById: z.string().nullable(),
      createdAt: z.string(),
      id: z.string(),
      note: z.string().nullable(),
      status: orderStatusSchema
    })
  ),
  totals: cartTotalsSchema,
  updatedAt: z.string(),
  warehouseId: z.string().nullable()
});

export const orderListSchema = z.object({
  items: z.array(orderSchema),
  pagination: paginationSchema
});

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type CustomerSession = z.infer<typeof customerSessionSchema>;
export type AuthenticatedCustomer = z.infer<typeof authenticatedCustomerSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type Address = z.infer<typeof addressSchema>;
export type AddressInput = z.infer<typeof addressInputSchema>;
export type AddressType = z.infer<typeof addressTypeSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
