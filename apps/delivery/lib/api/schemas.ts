import { z } from "zod";
import type {
  DeliveryAssignment,
  DeliveryAssignmentList,
  DeliveryCashSummary,
  DeliveryDashboard,
  DeliveryIncident,
  DeliveryNotification,
  DeliveryPartnerProfile,
  DeliverySession,
  TokenPair
} from "./types";

const nullableNumberSchema = z.number().nullable();
const nullableStringSchema = z.string().nullable();

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  accessTokenExpiresInSeconds: z.number(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
  refreshTokenExpiresInSeconds: z.number(),
  tokenType: z.literal("Bearer")
}) satisfies z.ZodType<TokenPair>;

export const deliverySessionSchema = z.object({
  deliveryPartner: z.object({
    id: z.string(),
    fullName: z.string(),
    mobileNumber: z.string(),
    status: z.string()
  }),
  tokens: tokenPairSchema
}) satisfies z.ZodType<DeliverySession>;

export const deliveryPartnerProfileSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  mobileNumber: z.string(),
  email: nullableStringSchema,
  vehicleNumber: nullableStringSchema,
  status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "INACTIVE", "SUSPENDED"]),
  statusReason: nullableStringSchema,
  isOnline: z.boolean(),
  lastSeenAt: nullableStringSchema,
  lastKnownLocation: z
    .object({
      latitude: nullableNumberSchema,
      longitude: nullableNumberSchema,
      updatedAt: nullableStringSchema
    })
    .nullable(),
  wallet: z.object({
    balance: z.number(),
    currency: z.literal("INR"),
    totalEarnings: z.number()
  }),
  documents: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      fileUrl: z.string(),
      fileKey: z.string(),
      verifiedAt: nullableStringSchema,
      createdAt: z.string()
    })
  ),
  createdAt: z.string(),
  updatedAt: z.string()
}) satisfies z.ZodType<DeliveryPartnerProfile>;

export const deliveryStatusSchema = z.enum([
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED"
]);

export const deliveryAssignmentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  deliveryPartnerId: z.string(),
  status: deliveryStatusSchema,
  customer: z.object({
    id: z.string(),
    fullName: z.string(),
    mobileNumber: z.string(),
    businessName: nullableStringSchema
  }),
  shippingAddress: z
    .object({
      id: z.string().optional(),
      fullName: z.string(),
      mobileNumber: z.string(),
      line1: z.string(),
      line2: nullableStringSchema,
      landmark: nullableStringSchema,
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      country: z.string(),
      latitude: nullableNumberSchema,
      longitude: nullableNumberSchema
    })
    .nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      sku: z.string(),
      name: z.string(),
      quantity: z.number(),
      productId: nullableStringSchema,
      variantId: nullableStringSchema,
      warehouseId: nullableStringSchema
    })
  ),
  payment: z.object({
    method: z.enum(["COD", "ONLINE"]).nullable(),
    status: nullableStringSchema,
    codAmount: z.number(),
    cashCollectedAmount: nullableNumberSchema,
    cashCollectedAt: nullableStringSchema.optional(),
    cashSettlementStatus: z.enum([
      "NOT_REQUIRED",
      "COLLECTED",
      "SUBMITTED",
      "SETTLED"
    ])
  }),
  totals: z.object({
    subtotal: z.number(),
    taxTotal: z.number(),
    shippingTotal: z.number(),
    discountTotal: z.number(),
    grandTotal: z.number()
  }),
  orderNotes: nullableStringSchema,
  pickupWarehouseId: nullableStringSchema,
  pickupWarehouse: z
    .object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      contactPerson: z.string(),
      contactNumber: z.string(),
      latitude: nullableNumberSchema,
      longitude: nullableNumberSchema
    })
    .nullable(),
  assignedAt: z.string(),
  pickedUpAt: nullableStringSchema,
  deliveredAt: nullableStringSchema,
  proofOfDeliveryUrl: nullableStringSchema,
  proofOfDeliveryKey: nullableStringSchema,
  failureReason: nullableStringSchema,
  receiverName: nullableStringSchema,
  statusHistory: z.array(
    z.object({
      id: z.string(),
      status: deliveryStatusSchema,
      note: nullableStringSchema,
      latitude: nullableNumberSchema,
      longitude: nullableNumberSchema,
      createdAt: z.string()
    })
  ),
  createdAt: z.string(),
  updatedAt: z.string()
}) satisfies z.ZodType<DeliveryAssignment>;

export const deliveryAssignmentListSchema = z.object({
  items: z.array(deliveryAssignmentSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
  })
}) satisfies z.ZodType<DeliveryAssignmentList>;

export const deliveryDashboardSchema = z.object({
  activeCount: z.number(),
  completedCount: z.number(),
  issueCount: z.number(),
  codToCollect: z.number(),
  statusCounts: z.record(deliveryStatusSchema, z.number())
}) satisfies z.ZodType<DeliveryDashboard>;

export const deliveryCashSummarySchema = z.object({
  cashInHand: z.number(),
  submittedAmount: z.number(),
  settledAmount: z.number(),
  pendingCount: z.number(),
  wallet: z.object({
    balance: z.number(),
    currency: z.literal("INR"),
    totalEarnings: z.number()
  }),
  items: z.array(
    z.object({
      assignmentId: z.string(),
      orderNumber: z.string(),
      amount: z.number(),
      settlementStatus: z.enum([
        "NOT_REQUIRED",
        "COLLECTED",
        "SUBMITTED",
        "SETTLED"
      ]),
      collectedAt: nullableStringSchema
    })
  ),
  ledgerEntries: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["DELIVERY_EARNING", "PAYOUT"]),
      amount: z.number(),
      description: z.string(),
      reference: nullableStringSchema,
      createdAt: z.string()
    })
  )
}) satisfies z.ZodType<DeliveryCashSummary>;

export const deliveryNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  assignmentId: nullableStringSchema,
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.string()
}) satisfies z.ZodType<DeliveryNotification>;

export const deliveryNotificationListSchema = z.object({
  items: z.array(deliveryNotificationSchema),
  unreadCount: z.number()
});

export const deliveryIncidentSchema = z.object({
  id: z.string(),
  deliveryAssignmentId: z.string(),
  type: z.enum([
    "CUSTOMER_UNREACHABLE",
    "INCORRECT_ADDRESS",
    "PACKAGE_DAMAGED",
    "PACKAGE_MISSING",
    "VEHICLE_BREAKDOWN",
    "PAYMENT_DISPUTE",
    "OTHER"
  ]),
  status: z.enum(["OPEN", "RESOLVED"]),
  note: nullableStringSchema,
  photoUrl: nullableStringSchema,
  createdAt: z.string()
}) satisfies z.ZodType<DeliveryIncident>;

export const deliveryIncidentListSchema = z.object({
  items: z.array(deliveryIncidentSchema)
});

export function validateStatusUpdatePayload(input: {
  status: string;
  proofOfDeliveryUrl?: string;
  proofOfDeliveryKey?: string;
  receiverName?: string;
  cashCollectedAmount?: number;
  failureReason?: string;
  isCod?: boolean;
}) {
  if (
    input.status === "DELIVERED" &&
    (!input.proofOfDeliveryUrl || !input.proofOfDeliveryKey || !input.receiverName)
  ) {
    return "Proof photo and receiver name are required.";
  }

  if (
    input.status === "DELIVERED" &&
    input.isCod &&
    input.cashCollectedAmount === undefined
  ) {
    return "COD amount is required.";
  }

  if (input.status === "FAILED" && !input.failureReason) {
    return "Failure reason is required.";
  }

  return null;
}
