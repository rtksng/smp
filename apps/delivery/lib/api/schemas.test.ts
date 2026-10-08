import { describe, expect, test } from "vitest";
import {
  deliveryAssignmentSchema,
  deliveryCashSummarySchema,
  deliveryEarningsSummarySchema,
  deliveryPartnerProfileSchema,
  validateStatusUpdatePayload
} from "./schemas";

const assignmentPayload = {
  assignedAt: "2026-05-25T10:00:00.000Z",
  createdAt: "2026-05-25T10:00:00.000Z",
  customer: {
    businessName: "Rao Surgical Clinic",
    fullName: "Nisha Rao",
    id: "customer-1",
    mobileNumber: "+919999888877"
  },
  deliveredAt: null,
  deliveryPartnerId: "partner-1",
  failureReason: null,
  id: "assignment-1",
  items: [
    {
      id: "item-1",
      name: "Sterile gloves",
      productId: "product-1",
      quantity: 2,
      sku: "GLV-100",
      variantId: null,
      warehouseId: "warehouse-1"
    }
  ],
  orderId: "order-1",
  orderNotes: "Call before delivery.",
  orderNumber: "ORD-20260525-000001",
  payment: {
    cashCollectedAmount: null,
    cashSettlementStatus: "NOT_REQUIRED",
    codAmount: 1225,
    method: "COD",
    status: "PENDING"
  },
  pickedUpAt: null,
  pickupWarehouse: {
    address: "Warehouse Road",
    city: "Delhi",
    code: "DEL-01",
    contactNumber: "+911145678900",
    contactPerson: "Dispatch Desk",
    id: "warehouse-1",
    latitude: 28.613939,
    longitude: 77.209023,
    name: "Delhi warehouse",
    pincode: "110001",
    state: "Delhi"
  },
  pickupWarehouseId: "warehouse-1",
  proofOfDeliveryKey: null,
  proofOfDeliveryUrl: null,
  receiverName: null,
  shippingAddress: {
    city: "Delhi",
    country: "India",
    fullName: "Dr. Nisha Rao",
    id: "address-1",
    landmark: "Near metro gate 2",
    latitude: 28.62,
    line1: "Clinic 12, Ring Road",
    line2: "First floor",
    longitude: 77.22,
    mobileNumber: "+919999888877",
    pincode: "110024",
    state: "Delhi"
  },
  status: "ASSIGNED",
  statusHistory: [],
  totals: {
    discountTotal: 25,
    grandTotal: 1225,
    shippingTotal: 50,
    subtotal: 1100,
    taxTotal: 100
  },
  updatedAt: "2026-05-25T10:00:00.000Z"
};

const profilePayload = {
  createdAt: "2026-05-25T10:00:00.000Z",
  documents: [],
  email: null,
  fullName: "Asha Driver",
  id: "partner-1",
  isOnline: true,
  lastKnownLocation: null,
  lastSeenAt: null,
  mobileNumber: "+919876543210",
  status: "ACTIVE",
  statusReason: null,
  updatedAt: "2026-05-25T10:00:00.000Z",
  vehicleNumber: "DL01AB1234",
  wallet: { balance: 1250, currency: "INR", totalEarnings: 4800 }
};

const warehousePayload = {
  address: "Warehouse Road",
  city: "Delhi",
  code: "DEL-01",
  contactNumber: "+911145678900",
  contactPerson: "Dispatch Desk",
  id: "warehouse-1",
  name: "Delhi warehouse",
  pincode: "110001",
  state: "Delhi"
};

const legacyLedgerEntry = {
  amount: 61.25,
  createdAt: "2026-10-01T10:00:00.000Z",
  description: "Commission for ORD-20261001-000001",
  id: "ledger-1",
  reference: "ORD-20261001-000001",
  type: "DELIVERY_EARNING"
};

const salaryLedgerEntry = {
  amount: 18000,
  createdAt: "2026-10-31T10:00:00.000Z",
  deliveryAssignmentId: null,
  description: "October salary",
  id: "ledger-2",
  reference: "SAL-2026-10",
  salaryPeriod: "2026-10",
  type: "SALARY"
};

const payoutLedgerEntry = {
  amount: 5000,
  createdAt: "2026-11-02T10:00:00.000Z",
  deliveryAssignmentId: null,
  description: "Bank transfer",
  id: "ledger-3",
  reference: "PAYOUT-20261102-001",
  salaryPeriod: null,
  type: "PAYOUT"
};

describe("delivery assignment schema", () => {
  test("parses the native app assignment contract", () => {
    const parsed = deliveryAssignmentSchema.parse(assignmentPayload);

    expect(parsed.customer.businessName).toBe("Rao Surgical Clinic");
    expect(parsed.payment.codAmount).toBe(1225);
    expect(parsed.pickupWarehouse?.contactPerson).toBe("Dispatch Desk");
  });

  test("reads the commission credited for a delivered assignment", () => {
    const parsed = deliveryAssignmentSchema.parse({
      ...assignmentPayload,
      earning: 61.25,
      status: "DELIVERED"
    });

    expect(parsed.earning).toBe(61.25);
    expect(
      deliveryAssignmentSchema.parse({ ...assignmentPayload, earning: null }).earning
    ).toBeNull();
  });

  test("treats assignment data without an earning field as no earning", () => {
    expect(assignmentPayload).not.toHaveProperty("earning");
    expect(deliveryAssignmentSchema.parse(assignmentPayload).earning).toBeNull();
  });

  test("requires delivered proof, receiver name, and COD amount", () => {
    expect(
      validateStatusUpdatePayload({
        isCod: true,
        status: "DELIVERED"
      })
    ).toBe("Proof photo and receiver name are required.");

    expect(
      validateStatusUpdatePayload({
        isCod: true,
        proofOfDeliveryKey: "delivery/proofs/1.jpg",
        proofOfDeliveryUrl: "http://localhost/uploads/delivery/proofs/1.jpg",
        receiverName: "Nisha Rao",
        status: "DELIVERED"
      })
    ).toBe("COD amount is required.");
  });

  test("requires failed deliveries to include a reason", () => {
    expect(
      validateStatusUpdatePayload({
        status: "FAILED"
      })
    ).toBe("Failure reason is required.");
  });
});

describe("delivery partner profile schema", () => {
  test("parses pay structure and assigned warehouses", () => {
    const parsed = deliveryPartnerProfileSchema.parse({
      ...profilePayload,
      payment: {
        commissionType: "PERCENTAGE",
        commissionValue: 5,
        monthlySalary: null,
        paymentType: "COMMISSION"
      },
      warehouses: [warehousePayload]
    });

    expect(parsed.payment?.commissionValue).toBe(5);
    expect(parsed.warehouses).toHaveLength(1);
    expect(parsed.warehouses[0]?.contactNumber).toBe("+911145678900");
  });

  test("parses a partner whose pay is not set yet", () => {
    const parsed = deliveryPartnerProfileSchema.parse({
      ...profilePayload,
      payment: {
        commissionType: null,
        commissionValue: null,
        monthlySalary: null,
        paymentType: null
      },
      warehouses: []
    });

    expect(parsed.payment?.paymentType).toBeNull();
  });

  test("still parses profile data without pay or warehouses", () => {
    const parsed = deliveryPartnerProfileSchema.parse(profilePayload);

    expect(parsed.payment).toBeUndefined();
    expect(parsed.warehouses).toEqual([]);
  });
});

describe("delivery ledger schemas", () => {
  const cashPayload = {
    cashInHand: 0,
    items: [],
    pendingCount: 0,
    settledAmount: 0,
    submittedAmount: 0,
    wallet: { balance: 13061.25, currency: "INR", totalEarnings: 18061.25 }
  };

  test("cash summary accepts salary entries and older entries without new fields", () => {
    const parsed = deliveryCashSummarySchema.parse({
      ...cashPayload,
      ledgerEntries: [salaryLedgerEntry, legacyLedgerEntry]
    });

    expect(parsed.ledgerEntries[0]).toMatchObject({
      salaryPeriod: "2026-10",
      type: "SALARY"
    });
    expect(parsed.ledgerEntries[1]).toMatchObject({
      deliveryAssignmentId: null,
      salaryPeriod: null,
      type: "DELIVERY_EARNING"
    });
  });

  test("rejects unknown ledger entry types", () => {
    expect(
      deliveryCashSummarySchema.safeParse({
        ...cashPayload,
        ledgerEntries: [{ ...legacyLedgerEntry, type: "BONUS" }]
      }).success
    ).toBe(false);
  });

  test("parses the earnings summary contract", () => {
    const commissionEntry = {
      ...legacyLedgerEntry,
      deliveryAssignmentId: "assignment-1",
      salaryPeriod: null
    };
    const parsed = deliveryEarningsSummarySchema.parse({
      entries: [payoutLedgerEntry, salaryLedgerEntry, commissionEntry],
      payment: {
        commissionType: null,
        commissionValue: null,
        monthlySalary: 18000,
        paymentType: "SALARY"
      },
      payouts: [payoutLedgerEntry],
      totals: {
        commissionEarnings: 61.25,
        completedDeliveries: 1,
        paidOut: 5000,
        salaryEarnings: 18000
      },
      wallet: { balance: 13061.25, currency: "INR", totalEarnings: 18061.25 }
    });

    expect(parsed.payment.monthlySalary).toBe(18000);
    expect(parsed.totals.completedDeliveries).toBe(1);
    expect(parsed.payouts.map((entry) => entry.type)).toEqual(["PAYOUT"]);
    expect(parsed.entries.map((entry) => entry.type)).toEqual([
      "PAYOUT",
      "SALARY",
      "DELIVERY_EARNING"
    ]);
    expect(parsed.entries[2]?.deliveryAssignmentId).toBe("assignment-1");
  });
});
