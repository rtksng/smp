export type DeliveryStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export type DeliveryAssignment = {
  id: string;
  orderId: string;
  orderNumber: string;
  deliveryPartnerId: string;
  status: DeliveryStatus;
  customer: {
    id: string;
    fullName: string;
    mobileNumber: string;
    businessName: string | null;
  };
  shippingAddress: {
    id?: string;
    fullName: string;
    mobileNumber: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    productId: string | null;
    variantId: string | null;
    warehouseId: string | null;
  }>;
  payment: {
    method: "COD" | "ONLINE" | null;
    status: string | null;
    codAmount: number;
    cashCollectedAmount: number | null;
    cashCollectedAt?: string | null;
    cashSettlementStatus: string;
  };
  totals: {
    subtotal: number;
    taxTotal: number;
    shippingTotal: number;
    discountTotal: number;
    grandTotal: number;
  };
  orderNotes: string | null;
  pickupWarehouseId: string | null;
  pickupWarehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    contactPerson: string;
    contactNumber: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  assignedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  proofOfDeliveryUrl: string | null;
  proofOfDeliveryKey: string | null;
  failureReason: string | null;
  receiverName: string | null;
  statusHistory: Array<{
    id: string;
    status: DeliveryStatus;
    note: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryAssignmentList = {
  items: DeliveryAssignment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type DeliveryPartnerProfile = {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  vehicleNumber: string | null;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  isOnline: boolean;
  lastSeenAt: string | null;
  lastKnownLocation: {
    latitude: number | null;
    longitude: number | null;
    updatedAt: string | null;
  } | null;
  wallet: {
    balance: number;
    currency: "INR";
    totalEarnings: number;
  };
};

export type DeliverySession = {
  deliveryPartner: {
    id: string;
    fullName: string;
    mobileNumber: string;
    status: string;
  };
  tokens: TokenPair;
};

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  accessTokenExpiresInSeconds: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  refreshTokenExpiresInSeconds: number;
  tokenType: "Bearer";
};

export type StatusUpdateInput = {
  status: DeliveryStatus;
  note?: string;
  latitude?: number;
  longitude?: number;
  proofOfDeliveryUrl?: string;
  proofOfDeliveryKey?: string;
  receiverName?: string;
  cashCollectedAmount?: number;
  failureReason?: string;
};
