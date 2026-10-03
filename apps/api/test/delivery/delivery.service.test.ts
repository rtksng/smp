import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { PrismaService } from "../../src/database/prisma.service";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { DeliveryPartnerJwtGuard } from "../../src/modules/auth/guards/delivery-partner-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import { buildDeliveryAssignmentWarehouseFilter, DeliveryService } from "../../src/modules/delivery/delivery.service";
import { AdminDeliveryController } from "../../src/modules/delivery/admin-delivery.controller";
import { AdminDeliveryPartnersController } from "../../src/modules/delivery/admin-delivery-partners.controller";
import { DeliveryController } from "../../src/modules/delivery/delivery.controller";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

import { adminAuth, FakeWarehouseAccess, createDeliveryPrismaMock } from "./delivery.fixture";

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

test("listAdminDeliveryPartners narrows to partners with assignments for a warehouse using the assignment rule", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );
  const rule = {
    OR: [
      { pickupWarehouseId: "warehouse-1" },
      { order: { warehouseId: "warehouse-1" }, pickupWarehouseId: null }
    ]
  };

  assert.deepEqual(buildDeliveryAssignmentWarehouseFilter("warehouse-1"), rule);
  await service.listAdminDeliveryPartners({ limit: 5, page: 1, status: "ACTIVE", warehouseId: "warehouse-1" });
  await service.listAdminDeliveryPartners({});
  await service.listAdminDeliveryAssignments({ warehouseId: "warehouse-1" });

  const partnerCalls = prisma.calls.deliveryPartnerFindMany as Array<{ skip: number; take: number; where: unknown }>;
  const warehouseWhere = { assignments: { some: rule }, deletedAt: null, status: "ACTIVE" };
  assert.deepEqual(partnerCalls[0]?.where, warehouseWhere);
  assert.equal(partnerCalls[0]?.skip, 0);
  assert.equal(partnerCalls[0]?.take, 5);
  assert.deepEqual(prisma.calls.deliveryPartnerCount[0], { where: warehouseWhere });
  assert.deepEqual(partnerCalls[1]?.where, { deletedAt: null });
  assert.deepEqual((prisma.calls.deliveryAssignmentFindMany[0] as { where: unknown }).where, rule);
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
      status: "INACTIVE",
      statusReason: "Application was not approved."
    }
  );
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("assignOrder creates an assignment, initial status history, and order assignment status", async () => {
  const prisma = createDeliveryPrismaMock({ orderStatus: "PACKED" });
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
  const prisma = createDeliveryPrismaMock({ orderStatus: "PACKED", orderStatusClaimCount: 0 });
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

test("delivery retries do not repeat stock or cash writes and COD receipt marks customer payment paid", async () => {
  const prisma = createDeliveryPrismaMock({ orderStatus: "ASSIGNED" });
  const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  for (const status of ["ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"] as const) {
    await service.updateAssignmentStatus("partner-1", "assignment-1", { status });
  }
  const payload = { status: "DELIVERED" as const, cashCollectedAmount: 1225, receiverName: "QA Receiver", proofOfDeliveryKey: "proofs/order.jpg", proofOfDeliveryUrl: "https://example.test/proof.jpg" };
  await service.updateAssignmentStatus("partner-1", "assignment-1", payload);
  const retried = await service.updateAssignmentStatus("partner-1", "assignment-1", payload);
  assert.equal(retried.status, "DELIVERED");
  assert.equal(retried.payment.status, "PAID");
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 1);
  assert.equal(prisma.calls.paymentUpdateMany.length, 1);
  assert.equal(prisma.calls.deliveryStatusHistoryCreate.length, 4);
});

test("cash summary includes older collections beyond the 100-row history window", async () => {
  const prisma = createDeliveryPrismaMock();
  prisma.deliveryAssignment.groupBy = async () => [
    { cashSettlementStatus: "COLLECTED", _sum: { cashCollectedAmount: "150000.00" }, _count: { _all: 125 } },
    { cashSettlementStatus: "SUBMITTED", _sum: { cashCollectedAmount: "2500.00" }, _count: { _all: 2 } },
    { cashSettlementStatus: "SETTLED", _sum: { cashCollectedAmount: "50000.00" }, _count: { _all: 101 } }
  ];
  const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  const summary = await service.getMyCashSummary("partner-1");
  assert.equal(summary.cashInHand, 150000);
  assert.equal(summary.pendingCount, 125);
  assert.equal(summary.submittedAmount, 2500);
  assert.equal(summary.settledAmount, 50000);
  assert.equal(summary.items.length, 1);
});

test("concurrent payouts cannot overdraw a delivery partner wallet", async () => {
  const prisma = createDeliveryPrismaMock();
  prisma.state.deliveryPartner.walletBalance = "100.00";
  const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  const results = await Promise.allSettled([1, 2].map(() => service.createLedgerEntry("partner-1", { type: "PAYOUT", amount: 70, description: "QA payout" }, { auth: adminAuth() })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(prisma.state.deliveryPartner.walletBalance, "30");
  assert.equal(prisma.state.ledgerEntries.length, 1);
});

test("failed and cancelled attempts preserve their reasons and release the order for reassignment", async () => {
  for (const status of ["FAILED", "CANCELLED"] as const) {
    const prisma = createDeliveryPrismaMock({ orderStatus: "ASSIGNED" });
    const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
    if (status === "FAILED") {
      for (const next of ["ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"] as const) await service.updateAssignmentStatus("partner-1", "assignment-1", { status: next });
    }
    const attempt = await service.updateAssignmentStatus("partner-1", "assignment-1", { status, failureReason: " QA retry required " });
    assert.equal(attempt.failureReason, "QA retry required");
    assert.equal(prisma.calls.inventoryStockUpdateMany.length, 0);
    const reassigned = await service.assignOrder({ orderId: "order-1", deliveryPartnerId: "partner-1" }, { auth: adminAuth() });
    assert.equal(reassigned.status, "ASSIGNED");
  }
});

test("delivery status updates reject stale concurrent writes and cancelled orders", async () => {
  for (const options of [{ orderStatus: "CANCELLED" }, { orderStatus: "ASSIGNED", assignmentStatusClaimCount: 0 }]) {
    const prisma = createDeliveryPrismaMock(options);
    const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
    await assert.rejects(() => service.updateAssignmentStatus("partner-1", "assignment-1", { status: "ACCEPTED" }), ConflictException);
    assert.equal(prisma.calls.deliveryStatusHistoryCreate.length, 0);
  }
});

test("another delivery partner cannot update an assignment", async () => {
  const prisma = createDeliveryPrismaMock();
  const service = new DeliveryService(prisma as unknown as PrismaService, new FakeWarehouseAccess() as unknown as WarehouseAccessService);
  await assert.rejects(() => service.updateAssignmentStatus("partner-2", "assignment-1", { status: "ACCEPTED" }));
  assert.equal(prisma.calls.deliveryStatusHistoryCreate.length, 0);
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
