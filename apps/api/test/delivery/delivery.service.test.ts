import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { DeliveryPartnerJwtGuard } from "../../src/modules/auth/guards/delivery-partner-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { DeliveryService } from "../../src/modules/delivery/delivery.service";
import { AdminDeliveryController } from "../../src/modules/delivery/admin-delivery.controller";
import { AdminDeliveryPartnersController } from "../../src/modules/delivery/admin-delivery-partners.controller";
import { DeliveryController } from "../../src/modules/delivery/delivery.controller";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

const now = new Date("2026-05-25T10:00:00.000Z");

function adminAuth(): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [PermissionCode.DeliveryRead, PermissionCode.DeliveryAssign],
    role: AdminRoleCode.DeliveryManager,
    sessionId: "admin-session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

class FakeWarehouseAccess {
  readonly assertedWarehouseIds: string[] = [];

  async assertCanManageWarehouse(_auth: AuthJwtPayload, warehouseId: string) {
    this.assertedWarehouseIds.push(warehouseId);
  }
}

function createDeliveryPrismaMock(input?: {
  orderStatus?: string;
  orderStatusClaimCount?: number;
}) {
  const calls: Record<string, unknown[]> = {
    adminAuditLogCreate: [],
    deliveryAssignmentCreate: [],
    deliveryAssignmentCount: [],
    deliveryAssignmentFindFirst: [],
    deliveryAssignmentFindMany: [],
    deliveryAssignmentUpdate: [],
    deliveryPartnerDeviceUpsert: [],
    deliveryPartnerDocumentCreate: [],
    deliveryPartnerCount: [],
    deliveryPartnerFindFirst: [],
    deliveryPartnerFindMany: [],
    deliveryPartnerUpdate: [],
    deliveryStatusHistoryCreate: [],
    inventoryStockUpdateMany: [],
    orderFindFirst: [],
    orderStatusHistoryCreate: [],
    orderUpdate: [],
    orderUpdateMany: [],
    warehouseFindFirst: []
  };
  const deliveryPartner = {
    createdAt: now,
    deletedAt: null,
    documents: [
      {
        createdAt: now,
        deliveryPartnerId: "partner-1",
        fileKey: "delivery-partners/documents/license.pdf",
        fileUrl: "http://localhost/uploads/license.pdf",
        id: "document-1",
        title: "Driving license",
        type: "DRIVING_LICENSE",
        updatedAt: now,
        verifiedAt: null
      }
    ],
    email: "driver@example.com",
    fullName: "Asha Driver",
    id: "partner-1",
    isOnline: false,
    lastLatitude: null,
    lastLocationAt: null,
    lastLongitude: null,
    lastSeenAt: null,
    mobileNumber: "+919876543210",
    status: "ACTIVE",
    totalEarnings: "0.00",
    updatedAt: now,
    vehicleNumber: "DL01AB1234",
    walletBalance: "0.00"
  };
  const pickupWarehouse = {
    address: "Warehouse Road",
    city: "Delhi",
    code: "DEL-01",
    contactNumber: "+911145678900",
    contactPerson: "Dispatch Desk",
    id: "warehouse-1",
    latitude: "28.6139390",
    longitude: "77.2090230",
    name: "Delhi warehouse",
    pincode: "110001",
    state: "Delhi"
  };
  const shippingAddress = {
    city: "Delhi",
    country: "India",
    fullName: "Dr. Nisha Rao",
    id: "address-1",
    landmark: "Near metro gate 2",
    latitude: "28.6200000",
    line1: "Clinic 12, Ring Road",
    line2: "First floor",
    longitude: "77.2200000",
    mobileNumber: "+919999888877",
    pincode: "110024",
    state: "Delhi"
  };
  const customer = {
    businessName: "Rao Surgical Clinic",
    email: "nisha@example.com",
    firstName: "Nisha",
    id: "customer-1",
    lastName: "Rao",
    mobileNumber: "+919999888877"
  };
  const order = {
    createdAt: now,
    deletedAt: null,
    discountTotal: "25.00",
    grandTotal: "1225.00",
    id: "order-1",
    items: [
      {
        id: "item-1",
        name: "Sterile gloves",
        productId: "product-1",
        quantity: 2,
        sku: "GLV-100",
        taxAmount: "100.00",
        total: "1200.00",
        unitPrice: "550.00",
        variantId: null,
        warehouseId: "warehouse-1"
      }
    ],
    notes: "Call before delivery.",
    orderNumber: "ORD-20260525-000001",
    paymentStatus: "PENDING",
    payments: [
      {
        amount: "1225.00",
        createdAt: now,
        id: "payment-1",
        method: "COD",
        status: "PENDING"
      }
    ],
    shippingAddress,
    status: input?.orderStatus ?? "PACKED",
    subtotal: "1100.00",
    taxTotal: "100.00",
    shippingTotal: "50.00",
    updatedAt: now,
    user: customer,
    warehouseId: "warehouse-1"
  };
  const statusHistory: Array<{
    createdAt: Date;
    id: string;
    latitude: number | null;
    longitude: number | null;
    note: string | null;
    status: string;
  }> = [];
  let assignment = {
    assignedAt: now,
    createdAt: now,
    deliveredAt: null as Date | null,
    deliveryPartner,
    deliveryPartnerId: "partner-1",
    failureReason: null as string | null,
    id: "assignment-1",
    order,
    orderId: "order-1",
    pickedUpAt: null as Date | null,
    pickupWarehouse,
    pickupWarehouseId: "warehouse-1",
    proofOfDeliveryKey: null as string | null,
    proofOfDeliveryUrl: null as string | null,
    cashCollectedAmount: null as string | null,
    cashCollectedAt: null as Date | null,
    cashSettlementStatus: "NOT_REQUIRED",
    receiverName: null as string | null,
    status: "ASSIGNED",
    statusHistory,
    updatedAt: now
  };
  const prisma = {
    calls,
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma),
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    deliveryAssignment: {
      count: async (args: unknown) => {
        calls.deliveryAssignmentCount.push(args);
        return 1;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryAssignmentCreate.push(args);
        assignment = {
          ...assignment,
          ...args.data,
          statusHistory
        };
        return assignment;
      },
      findFirst: async (args: unknown) => {
        calls.deliveryAssignmentFindFirst.push(args);
        return assignment;
      },
      findMany: async (args: unknown) => {
        calls.deliveryAssignmentFindMany.push(args);
        return [assignment];
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.deliveryAssignmentUpdate.push(args);
        assignment = {
          ...assignment,
          ...args.data,
          statusHistory
        };
        return assignment;
      }
    },
    deliveryPartner: {
      count: async (args: unknown) => {
        calls.deliveryPartnerCount.push(args);
        return 1;
      },
      findFirst: async (args: unknown) => {
        calls.deliveryPartnerFindFirst.push(args);
        return deliveryPartner;
      },
      findMany: async (args: unknown) => {
        calls.deliveryPartnerFindMany.push(args);
        return [deliveryPartner];
      },
      update: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryPartnerUpdate.push(args);
        Object.assign(deliveryPartner, args.data);
        return deliveryPartner;
      }
    },
    deliveryPartnerDevice: {
      upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        calls.deliveryPartnerDeviceUpsert.push(args);
        return {
          id: "device-1",
          createdAt: now,
          updatedAt: now,
          ...args.create,
          ...args.update
        };
      }
    },
    deliveryPartnerDocument: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryPartnerDocumentCreate.push(args);
        const document = {
          createdAt: now,
          id: "document-2",
          updatedAt: now,
          verifiedAt: null,
          ...args.data
        };
        deliveryPartner.documents.push(document);
        return document;
      }
    },
    deliveryStatusHistory: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryStatusHistoryCreate.push(args);
        const history = {
          createdAt: now,
          id: `delivery-history-${statusHistory.length + 1}`,
          latitude: (args.data.latitude as number | null | undefined) ?? null,
          longitude: (args.data.longitude as number | null | undefined) ?? null,
          note: (args.data.note as string | null | undefined) ?? null,
          status: args.data.status as string
        };
        statusHistory.push(history);
        return history;
      }
    },
    inventoryStock: {
      updateMany: async (args: unknown) => {
        calls.inventoryStockUpdateMany.push(args);
        return { count: 1 };
      }
    },
    order: {
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        return order;
      },
      update: async (args: { data: Record<string, unknown> }) => {
        calls.orderUpdate.push(args);
        Object.assign(order, args.data);
        return order;
      },
      updateMany: async (args: { data: Record<string, unknown> }) => {
        calls.orderUpdateMany.push(args);
        if ((input?.orderStatusClaimCount ?? 1) > 0) {
          Object.assign(order, args.data);
        }
        return { count: input?.orderStatusClaimCount ?? 1 };
      }
    },
    orderStatusHistory: {
      create: async (args: unknown) => {
        calls.orderStatusHistoryCreate.push(args);
        return { id: "order-history-1" };
      }
    },
    warehouse: {
      findFirst: async (args: unknown) => {
        calls.warehouseFindFirst.push(args);
        return pickupWarehouse;
      }
    }
  };

  return prisma;
}

test("listAdminDeliveryPartners returns profiles with documents, online state, and wallet placeholders", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.listAdminDeliveryPartners({});

  assert.equal(result.items[0]?.id, "partner-1");
  assert.equal(result.items[0]?.documents[0]?.title, "Driving license");
  assert.equal(result.items[0]?.isOnline, false);
  assert.deepEqual(result.items[0]?.wallet, {
    balance: 0,
    currency: "INR",
    totalEarnings: 0
  });
});

test("approveDeliveryPartner activates the partner and writes an admin audit log", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.approveDeliveryPartner("partner-1", {
    auth: adminAuth(),
    ipAddress: "127.0.0.1",
    userAgent: "node-test"
  });

  assert.equal(result.status, "ACTIVE");
  assert.equal(prisma.calls.deliveryPartnerUpdate.length, 1);
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("getAdminDeliveryPartner returns one partner with document detail", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.getAdminDeliveryPartner("partner-1");

  assert.equal(result.id, "partner-1");
  assert.equal(result.documents[0]?.fileUrl, "http://localhost/uploads/license.pdf");
  assert.equal(prisma.calls.deliveryPartnerFindFirst.length, 1);
});

test("rejectDeliveryPartner marks the partner inactive, offline, and writes an audit log", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.rejectDeliveryPartner("partner-1", {
    auth: adminAuth(),
    ipAddress: "127.0.0.1",
    userAgent: "node-test"
  });

  assert.equal(result.status, "INACTIVE");
  assert.equal(result.isOnline, false);
  assert.deepEqual(
    (prisma.calls.deliveryPartnerUpdate[0] as { data: Record<string, unknown> })
      .data,
    {
      isOnline: false,
      status: "INACTIVE"
    }
  );
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("assignOrder creates an assignment, initial status history, and order assignment status", async () => {
  const prisma = createDeliveryPrismaMock();
  const warehouseAccess = new FakeWarehouseAccess();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    warehouseAccess as unknown as WarehouseAccessService
  );

  const result = await service.assignOrder(
    {
      deliveryPartnerId: "partner-1",
      note: "Ready at dispatch dock",
      orderId: "order-1",
      pickupWarehouseId: "warehouse-1"
    },
    {
      auth: adminAuth(),
      ipAddress: "127.0.0.1",
      userAgent: "node-test"
    }
  );

  assert.equal(result.status, "ASSIGNED");
  assert.equal(result.pickupWarehouse?.id, "warehouse-1");
  assert.deepEqual(warehouseAccess.assertedWarehouseIds, ["warehouse-1"]);
  assert.equal(prisma.calls.deliveryAssignmentCreate.length, 1);
  assert.equal(prisma.calls.deliveryStatusHistoryCreate.length, 1);
  assert.deepEqual(
    (prisma.calls.orderUpdateMany[0] as {
      data: { status: string };
      where: Record<string, unknown>;
    }).where,
    {
      deletedAt: null,
      id: "order-1",
      status: {
        in: ["CONFIRMED", "PACKED"]
      }
    }
  );
  assert.equal(
    (prisma.calls.orderUpdateMany[0] as { data: { status: string } }).data.status,
    "ASSIGNED"
  );
});

test("assignOrder only accepts confirmed or packed orders", async () => {
  const prisma = createDeliveryPrismaMock({ orderStatus: "CREATED" });
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.assignOrder(
        {
          deliveryPartnerId: "partner-1",
          orderId: "order-1",
          pickupWarehouseId: "warehouse-1"
        },
        {
          auth: adminAuth(),
          ipAddress: "127.0.0.1",
          userAgent: "node-test"
        }
      ),
    BadRequestException
  );
});

test("assignOrder rejects concurrent assignment when the order status was already claimed", async () => {
  const prisma = createDeliveryPrismaMock({ orderStatusClaimCount: 0 });
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.assignOrder(
        {
          deliveryPartnerId: "partner-1",
          orderId: "order-1",
          pickupWarehouseId: "warehouse-1"
        },
        {
          auth: adminAuth(),
          ipAddress: "127.0.0.1",
          userAgent: "node-test"
        }
      ),
    ConflictException
  );
  assert.equal(prisma.calls.deliveryAssignmentCreate.length, 0);
});

test("listAdminDeliveryAssignments filters assignments by status, warehouse, and delivery partner", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const result = await service.listAdminDeliveryAssignments({
    deliveryPartnerId: "partner-1",
    limit: 10,
    page: 2,
    status: "ASSIGNED",
    warehouseId: "warehouse-1"
  });

  assert.equal(result.items[0]?.id, "assignment-1");
  assert.equal(result.items[0]?.pickupWarehouse?.code, "DEL-01");
  assert.deepEqual(result.pagination, {
    hasNextPage: false,
    hasPreviousPage: true,
    limit: 10,
    page: 2,
    total: 1,
    totalPages: 1
  });
  assert.deepEqual(
    (prisma.calls.deliveryAssignmentFindMany[0] as {
      skip: number;
      take: number;
      where: Record<string, unknown>;
    }).where,
    {
      OR: [
        {
          pickupWarehouseId: "warehouse-1"
        },
        {
          order: {
            warehouseId: "warehouse-1"
          },
          pickupWarehouseId: null
        }
      ],
      deliveryPartnerId: "partner-1",
      status: "ASSIGNED"
    }
  );
  assert.equal(
    (prisma.calls.deliveryAssignmentFindMany[0] as { skip: number }).skip,
    10
  );
  assert.equal(
    (prisma.calls.deliveryAssignmentFindMany[0] as { take: number }).take,
    10
  );
});

test("delivery partner can update online status and read assigned deliveries", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const profile = await service.updateMyOnlineStatus("partner-1", {
    isOnline: true
  });
  const assignments = await service.listMyAssignments("partner-1");

  assert.equal(profile.isOnline, true);
  assert.equal(assignments.items[0]?.deliveryPartnerId, "partner-1");
  assert.equal(prisma.calls.deliveryAssignmentFindMany.length, 1);
});

test("delivery assignment payload includes customer, address, items, payment, totals, notes, and pickup contacts", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const assignments = await service.listMyAssignments("partner-1");
  const assignment = assignments.items[0];

  assert.equal(assignment?.customer.fullName, "Nisha Rao");
  assert.equal(assignment?.customer.mobileNumber, "+919999888877");
  assert.equal(assignment?.customer.businessName, "Rao Surgical Clinic");
  assert.equal(assignment?.shippingAddress?.line1, "Clinic 12, Ring Road");
  assert.equal(assignment?.shippingAddress?.latitude, 28.62);
  assert.equal(assignment?.items[0]?.sku, "GLV-100");
  assert.equal(assignment?.items[0]?.name, "Sterile gloves");
  assert.equal(assignment?.items[0]?.quantity, 2);
  assert.equal(assignment?.payment.method, "COD");
  assert.equal(assignment?.payment.codAmount, 1225);
  assert.equal(assignment?.totals.grandTotal, 1225);
  assert.equal(assignment?.orderNotes, "Call before delivery.");
  assert.equal(assignment?.pickupWarehouse?.contactPerson, "Dispatch Desk");
  assert.equal(assignment?.pickupWarehouse?.latitude, 28.613939);
});

test("delivery partner can register an iOS push device and update last known GPS location", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const device = await service.registerMyDevice("partner-1", {
    notificationsEnabled: true,
    platform: "ios",
    pushToken: "ExponentPushToken[delivery-ios]"
  });
  const profile = await service.updateMyLocation("partner-1", {
    latitude: 28.613939,
    longitude: 77.209023
  });

  assert.equal(device.platform, "ios");
  assert.equal(device.pushToken, "ExponentPushToken[delivery-ios]");
  assert.equal(profile.lastKnownLocation?.latitude, 28.613939);
  assert.equal(profile.lastKnownLocation?.longitude, 77.209023);
  assert.equal(prisma.calls.deliveryPartnerDeviceUpsert.length, 1);
  assert.equal(prisma.calls.deliveryPartnerUpdate.length, 1);
});

test("delivery partner can store uploaded document metadata on the profile", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const profile = await service.addMyDocument("partner-1", {
    fileKey: "delivery-partners/documents/pan.pdf",
    fileUrl: "http://localhost/uploads/pan.pdf",
    title: "PAN card",
    type: "PAN"
  });

  assert.equal(profile.documents.at(-1)?.title, "PAN card");
  assert.equal(prisma.calls.deliveryPartnerDocumentCreate.length, 1);
});

test("delivery partner status updates store pickup and delivered timestamps with proof placeholder", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "ACCEPTED"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "PICKED_UP"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "OUT_FOR_DELIVERY"
  });
  const delivered = await service.updateAssignmentStatus("partner-1", "assignment-1", {
    cashCollectedAmount: 1225,
    note: "Received by clinic desk",
    proofOfDeliveryKey: "proofs/order-1.jpg",
    proofOfDeliveryUrl: "http://localhost/uploads/proofs/order-1.jpg",
    receiverName: "Nisha Rao",
    status: "DELIVERED"
  });

  assert.equal(delivered.status, "DELIVERED");
  assert.ok(delivered.pickedUpAt);
  assert.ok(delivered.deliveredAt);
  assert.equal(delivered.proofOfDeliveryKey, "proofs/order-1.jpg");
  assert.equal(delivered.receiverName, "Nisha Rao");
  assert.equal(delivered.payment.cashCollectedAmount, 1225);
  assert.equal(delivered.payment.cashSettlementStatus, "COLLECTED");
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 1);
  assert.equal(
    (prisma.calls.orderUpdate.at(-1) as { data: { status: string } }).data.status,
    "DELIVERED"
  );
});

test("delivery partner must provide proof and receiver name before marking delivered", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "ACCEPTED"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "PICKED_UP"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "OUT_FOR_DELIVERY"
  });

  await assert.rejects(
    () =>
      service.updateAssignmentStatus("partner-1", "assignment-1", {
        cashCollectedAmount: 1225,
        proofOfDeliveryKey: "proofs/order-1.jpg",
        status: "DELIVERED"
      }),
    BadRequestException
  );
});

test("delivery partner must provide a failure reason before marking failed", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "ACCEPTED"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "PICKED_UP"
  });

  await assert.rejects(
    () =>
      service.updateAssignmentStatus("partner-1", "assignment-1", {
        status: "FAILED"
      }),
    BadRequestException
  );
});

test("COD deliveries must include the collected amount before marking delivered", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "ACCEPTED"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "PICKED_UP"
  });
  await service.updateAssignmentStatus("partner-1", "assignment-1", {
    status: "OUT_FOR_DELIVERY"
  });

  await assert.rejects(
    () =>
      service.updateAssignmentStatus("partner-1", "assignment-1", {
        proofOfDeliveryKey: "proofs/order-1.jpg",
        proofOfDeliveryUrl: "http://localhost/uploads/proofs/order-1.jpg",
        receiverName: "Nisha Rao",
        status: "DELIVERED"
      }),
    BadRequestException
  );
});

test("delivery partner status updates reject invalid transitions", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.updateAssignmentStatus("partner-1", "assignment-1", {
        status: "DELIVERED"
      }),
    BadRequestException
  );
});

test("delivery controllers declare required guards and permissions", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, DeliveryController), [
    DeliveryPartnerJwtGuard
  ]);
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA, AdminDeliveryPartnersController),
    [AdminJwtGuard, PermissionGuard]
  );
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminDeliveryController), [
    AdminJwtGuard,
    PermissionGuard
  ]);
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminDeliveryPartnersController.prototype.listPartners
    ),
    [PermissionCode.DeliveryRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminDeliveryPartnersController.prototype.getPartner
    ),
    [PermissionCode.DeliveryRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminDeliveryPartnersController.prototype.rejectPartner
    ),
    [PermissionCode.DeliveryAssign]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminDeliveryController.prototype.listAssignments
    ),
    [PermissionCode.DeliveryRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      "admin:required-permissions",
      AdminDeliveryController.prototype.assignOrder
    ),
    [PermissionCode.DeliveryAssign]
  );
});
