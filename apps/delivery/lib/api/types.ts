export type DeliveryStatus =
  | "ASSIGNED"
  | "ACCEPTED"
  | "PICKED_UP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export type CashSettlementStatus =
  | "NOT_REQUIRED"
  | "COLLECTED"
  | "SUBMITTED"
  | "SETTLED";

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
    cashSettlementStatus: CashSettlementStatus;
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
  statusReason: string | null;
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
  documents: DeliveryPartnerDocument[];
  createdAt: string;
  updatedAt: string;
};

export type DeliveryPartnerDocument = {
  id: string;
  type: string;
  title: string;
  fileUrl: string;
  fileKey: string;
  verifiedAt: string | null;
  createdAt: string;
};

export type DeliveryAssignmentListParams = {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "NEWEST" | "OLDEST";
};

export type DeliveryDashboard = {
  activeCount: number;
  completedCount: number;
  issueCount: number;
  codToCollect: number;
  statusCounts: Record<DeliveryStatus, number>;
};

export type DeliveryCashSummary = {
  cashInHand: number;
  submittedAmount: number;
  settledAmount: number;
  pendingCount: number;
  wallet: DeliveryPartnerProfile["wallet"];
  items: Array<{
    assignmentId: string;
    orderNumber: string;
    amount: number;
    settlementStatus: CashSettlementStatus;
    collectedAt: string | null;
  }>;
  ledgerEntries: Array<{
    id: string;
    type: "DELIVERY_EARNING" | "PAYOUT";
    amount: number;
    description: string;
    reference: string | null;
    createdAt: string;
  }>;
};

export type DeliveryNotification = {
  id: string;
  title: string;
  body: string;
  assignmentId: string | null;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type DeliveryIncidentType =
  | "CUSTOMER_UNREACHABLE"
  | "INCORRECT_ADDRESS"
  | "PACKAGE_DAMAGED"
  | "PACKAGE_MISSING"
  | "VEHICLE_BREAKDOWN"
  | "PAYMENT_DISPUTE"
  | "OTHER";

export type DeliveryIncident = {
  id: string;
  deliveryAssignmentId: string;
  type: DeliveryIncidentType;
  status: "OPEN" | "RESOLVED";
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
};

export type DeliveryApplication = {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  vehicleNumber: string | null;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  statusReason?: string | null;
  updatedAt?: string;
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
