import { describe, expect, test } from "vitest";
import {
  deliveryAssignmentSchema,
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

describe("delivery assignment schema", () => {
  test("parses the native app assignment contract", () => {
    const parsed = deliveryAssignmentSchema.parse(assignmentPayload);

    expect(parsed.customer.businessName).toBe("Rao Surgical Clinic");
    expect(parsed.payment.codAmount).toBe(1225);
    expect(parsed.pickupWarehouse?.contactPerson).toBe("Dispatch Desk");
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
