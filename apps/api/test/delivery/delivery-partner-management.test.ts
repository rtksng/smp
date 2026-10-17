import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException
} from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import {
  calculateDeliveryCommission,
  DeliveryService,
  normalizeDeliveryPartnerPayment
} from "../../src/modules/delivery/delivery.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type {
  WarehouseAccessService,
  WarehouseScope
} from "../../src/modules/warehouses/warehouse-access.service";
import { adminAuth, createDeliveryPrismaMock, FakeWarehouseAccess } from "./delivery.fixture";

const superAdmin = () => adminAuth({ role: AdminRoleCode.SuperAdmin });
const warehouseManager = () =>
  adminAuth({
    permissions: [
      PermissionCode.DeliveryRead,
      PermissionCode.DeliveryAssign,
      PermissionCode.DeliveryPartnersManage
    ],
    role: AdminRoleCode.WarehouseManager
  });

function createService(scope?: WarehouseScope, prisma = createDeliveryPrismaMock()) {
  const service = new DeliveryService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(scope) as unknown as WarehouseAccessService
  );

  return { prisma, service };
}

async function deliver(service: DeliveryService) {
  for (const status of ["ACCEPTED", "PICKED_UP", "OUT_FOR_DELIVERY"] as const) {
    await service.updateAssignmentStatus("partner-1", "assignment-1", { status });
  }

  const delivered = {
    cashCollectedAmount: 1225,
    proofOfDeliveryKey: "private/delivery-partners/partner-1/proofs/order.jpg",
    proofOfDeliveryUrl: "https://example.test/proof.jpg",
    receiverName: "QA Receiver",
    status: "DELIVERED" as const
  };

  await service.updateAssignmentStatus("partner-1", "assignment-1", delivered);
  return service.updateAssignmentStatus("partner-1", "assignment-1", delivered);
}

test("calculateDeliveryCommission applies percentage to the order total and rounds to the paisa", () => {
  const commission = (commissionType: "PERCENTAGE" | "FIXED", commissionValue: string) =>
    ({ commissionType, commissionValue, paymentType: "COMMISSION" as const });

  assert.equal(calculateDeliveryCommission(commission("PERCENTAGE", "5.00"), "1225.00"), 61.25);
  assert.equal(calculateDeliveryCommission(commission("PERCENTAGE", "2.50"), "1225.00"), 30.63);
  assert.equal(calculateDeliveryCommission(commission("PERCENTAGE", "0.10"), "1225.00"), 1.23);
  assert.equal(calculateDeliveryCommission(commission("FIXED", "50.00"), "1225.00"), 50);
  assert.equal(
    calculateDeliveryCommission(
      { commissionType: null, commissionValue: null, paymentType: "SALARY" },
      "1225.00"
    ),
    0
  );
  assert.equal(
    calculateDeliveryCommission(
      { commissionType: null, commissionValue: null, paymentType: null },
      "1225.00"
    ),
    0
  );
});

test("normalizeDeliveryPartnerPayment requires the fields for each pay type and clears the others", () => {
  assert.deepEqual(normalizeDeliveryPartnerPayment({ monthlySalary: 18000, paymentType: "SALARY", commissionValue: 5 }), {
    commissionType: null,
    commissionValue: null,
    monthlySalary: 18000,
    paymentType: "SALARY"
  });
  assert.deepEqual(
    normalizeDeliveryPartnerPayment({ commissionType: "PERCENTAGE", commissionValue: 5, monthlySalary: 100, paymentType: "COMMISSION" }),
    { commissionType: "PERCENTAGE", commissionValue: 5, monthlySalary: null, paymentType: "COMMISSION" }
  );
  assert.throws(() => normalizeDeliveryPartnerPayment({ paymentType: "SALARY" }), BadRequestException);
  assert.throws(() => normalizeDeliveryPartnerPayment({ commissionValue: 5, paymentType: "COMMISSION" }), BadRequestException);
  assert.throws(
    () => normalizeDeliveryPartnerPayment({ commissionType: "PERCENTAGE", commissionValue: 100.5, paymentType: "COMMISSION" }),
    BadRequestException
  );
  assert.throws(() => normalizeDeliveryPartnerPayment({ monthlySalary: 18000 }), BadRequestException);
});

test("warehouse staff only see partners and assignments for their own warehouses", async () => {
  const { prisma, service } = createService({ allWarehouses: false, warehouseIds: ["warehouse-1", "warehouse-2"] });
  const scoped = { in: ["warehouse-1", "warehouse-2"] };

  await service.listAdminDeliveryPartners({}, warehouseManager());
  await service.getAdminDeliveryPartner("partner-1", warehouseManager());
  await service.listAdminDeliveryAssignments({}, warehouseManager());

  assert.deepEqual((prisma.calls.deliveryPartnerFindMany[0] as { where: unknown }).where, {
    deletedAt: null,
    warehouses: { some: { warehouseId: scoped } }
  });
  assert.deepEqual((prisma.calls.deliveryPartnerFindFirst[0] as { where: unknown }).where, {
    deletedAt: null,
    id: "partner-1",
    warehouses: { some: { warehouseId: scoped } }
  });
  assert.deepEqual((prisma.calls.deliveryAssignmentFindMany[0] as { where: unknown }).where, {
    OR: [
      { pickupWarehouseId: scoped },
      { order: { warehouseId: scoped }, pickupWarehouseId: null }
    ]
  });
  await assert.rejects(
    () => service.listAdminDeliveryPartners({ warehouseId: "warehouse-9" }, warehouseManager()),
    ForbiddenException
  );
});

test("admins add partners to one or more chosen warehouses with pay, as active partners", async () => {
  const { prisma, service } = createService();

  await assert.rejects(
    () => service.createDeliveryPartner({ fullName: "Ravi Rider", mobileNumber: "+919812345678" }, { auth: superAdmin() }),
    BadRequestException
  );
  await assert.rejects(
    () =>
      service.createDeliveryPartner(
        { fullName: "Ravi Rider", mobileNumber: "+919812345678", warehouseIds: ["warehouse-1", "missing-warehouse"] },
        { auth: superAdmin() }
      ),
    { name: "NotFoundException" }
  );

  const created = await service.createDeliveryPartner(
    {
      commissionType: "PERCENTAGE",
      commissionValue: 5,
      email: " Ravi@Example.com ",
      fullName: " Ravi Rider ",
      mobileNumber: "+919812345678",
      paymentType: "COMMISSION",
      vehicleNumber: " dl01ab9999 ",
      warehouseIds: ["warehouse-1", "warehouse-2", "warehouse-2"]
    },
    { auth: superAdmin() }
  );

  assert.equal(created.status, "ACTIVE");
  assert.equal(created.fullName, "Ravi Rider");
  assert.equal(created.email, "ravi@example.com");
  assert.equal(created.vehicleNumber, "DL01AB9999");
  assert.deepEqual(created.warehouses.map((warehouse) => warehouse.id), ["warehouse-1", "warehouse-2"]);
  assert.deepEqual(created.payment, {
    commissionType: "PERCENTAGE",
    commissionValue: 5,
    monthlySalary: null,
    paymentType: "COMMISSION"
  });
  assert.equal(prisma.calls.adminAuditLogCreate.length, 1);
});

test("warehouse staff add partners only to their own single warehouse", async () => {
  const oneWarehouse = createService({ allWarehouses: false, warehouseIds: ["warehouse-1"] });
  const created = await oneWarehouse.service.createDeliveryPartner(
    { fullName: "Ravi Rider", mobileNumber: "+919812345678" },
    { auth: warehouseManager() }
  );

  assert.deepEqual(created.warehouses.map((warehouse) => warehouse.id), ["warehouse-1"]);
  assert.deepEqual(created.payment.paymentType, null);
  await assert.rejects(
    () =>
      oneWarehouse.service.createDeliveryPartner(
        { fullName: "Ravi Rider", mobileNumber: "+919812345678", warehouseIds: ["warehouse-9"] },
        { auth: warehouseManager() }
      ),
    ForbiddenException
  );

  const twoWarehouses = createService({ allWarehouses: false, warehouseIds: ["warehouse-1", "warehouse-2"] });
  await assert.rejects(
    () => twoWarehouses.service.createDeliveryPartner({ fullName: "Ravi Rider", mobileNumber: "+919812345678" }, { auth: warehouseManager() }),
    BadRequestException
  );
  await assert.rejects(
    () =>
      twoWarehouses.service.createDeliveryPartner(
        { fullName: "Ravi Rider", mobileNumber: "+919812345678", warehouseIds: ["warehouse-1", "warehouse-2"] },
        { auth: warehouseManager() }
      ),
    ForbiddenException
  );
  const chosen = await twoWarehouses.service.createDeliveryPartner(
    { fullName: "Ravi Rider", mobileNumber: "+919812345678", warehouseIds: ["warehouse-2"] },
    { auth: warehouseManager() }
  );
  assert.deepEqual(chosen.warehouses.map((warehouse) => warehouse.id), ["warehouse-2"]);
});

test("changing pay requires delivery.payouts.manage", async () => {
  const { service } = createService({ allWarehouses: false, warehouseIds: ["warehouse-1"] });

  await assert.rejects(
    () =>
      service.createDeliveryPartner(
        { fullName: "Ravi Rider", mobileNumber: "+919812345678", monthlySalary: 18000, paymentType: "SALARY" },
        { auth: warehouseManager() }
      ),
    ForbiddenException
  );
  await assert.rejects(
    () => service.updateDeliveryPartner("partner-1", { monthlySalary: 20000, paymentType: "SALARY" }, { auth: warehouseManager() }),
    ForbiddenException
  );
});

test("only admins replace a partner's warehouses; staff can still edit details", async () => {
  const staff = createService({ allWarehouses: false, warehouseIds: ["warehouse-1"] });

  await assert.rejects(
    () => staff.service.updateDeliveryPartner("partner-1", { warehouseIds: ["warehouse-1", "warehouse-2"] }, { auth: warehouseManager() }),
    ForbiddenException
  );
  const edited = await staff.service.updateDeliveryPartner(
    "partner-1",
    { email: "", fullName: "Asha D", vehicleNumber: null },
    { auth: warehouseManager() }
  );
  assert.equal(edited.fullName, "Asha D");
  assert.equal(edited.email, null);
  assert.equal(edited.vehicleNumber, null);
  assert.equal(staff.prisma.calls.deliveryPartnerWarehouseCreateMany.length, 0);

  const admin = createService();
  const moved = await admin.service.updateDeliveryPartner(
    "partner-1",
    { monthlySalary: 18000, paymentType: "SALARY", warehouseIds: ["warehouse-2", "warehouse-3"] },
    { auth: superAdmin() }
  );
  assert.deepEqual(admin.prisma.calls.deliveryPartnerWarehouseDeleteMany[0], {
    where: { deliveryPartnerId: "partner-1", warehouseId: { notIn: ["warehouse-2", "warehouse-3"] } }
  });
  assert.deepEqual(moved.warehouses.map((warehouse) => warehouse.id), ["warehouse-2", "warehouse-3"]);
  assert.equal((admin.prisma.calls.deliveryPartnerUpdate[0] as { data: Record<string, unknown> }).data.paymentType, "SALARY");
});

test("duplicate mobile numbers or emails are reported as conflicts", async () => {
  const { prisma, service } = createService();
  prisma.deliveryPartner.create = async () => {
    throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  };

  await assert.rejects(
    () =>
      service.createDeliveryPartner(
        { fullName: "Asha Driver", mobileNumber: "+919876543210", warehouseIds: ["warehouse-1"] },
        { auth: superAdmin() }
      ),
    ConflictException
  );
});

test("dispatch requires the partner to be assigned to the pickup warehouse", async () => {
  const { prisma, service } = createService(undefined, createDeliveryPrismaMock({ orderStatus: "PACKED" }));
  prisma.state.deliveryPartner.warehouses = [];

  await assert.rejects(
    () => service.assignOrder({ deliveryPartnerId: "partner-1", orderId: "order-1" }, { auth: adminAuth() }),
    /not assigned to the pickup warehouse/
  );
  assert.equal(prisma.calls.deliveryAssignmentCreate.length, 0);
});

test("commission partners are credited once, automatically, when a delivery is completed", async () => {
  const { prisma, service } = createService(undefined, createDeliveryPrismaMock({ orderStatus: "ASSIGNED" }));
  Object.assign(prisma.state.deliveryPartner, {
    commissionType: "PERCENTAGE",
    commissionValue: "5.00",
    paymentType: "COMMISSION"
  });

  await deliver(service);

  assert.equal(prisma.state.ledgerEntries.length, 1);
  assert.deepEqual(
    {
      amount: prisma.state.ledgerEntries[0]?.amount,
      deliveryAssignmentId: prisma.state.ledgerEntries[0]?.deliveryAssignmentId,
      reference: prisma.state.ledgerEntries[0]?.reference,
      type: prisma.state.ledgerEntries[0]?.type
    },
    { amount: 61.25, deliveryAssignmentId: "assignment-1", reference: "ORD-20260525-000001", type: "DELIVERY_EARNING" }
  );
  assert.equal(prisma.state.deliveryPartner.walletBalance, "61.25");
  assert.equal(prisma.state.deliveryPartner.totalEarnings, "61.25");

  const earnings = await service.getMyEarnings("partner-1");
  assert.equal(earnings.totals.commissionEarnings, 61.25);
  assert.equal(earnings.totals.completedDeliveries, 1);
  assert.equal(earnings.wallet.balance, 61.25);
});

test("salary partners earn nothing per delivery", async () => {
  const { prisma, service } = createService(undefined, createDeliveryPrismaMock({ orderStatus: "ASSIGNED" }));
  Object.assign(prisma.state.deliveryPartner, { monthlySalary: "18000.00", paymentType: "SALARY" });

  await deliver(service);

  assert.equal(prisma.state.ledgerEntries.length, 0);
  assert.equal(prisma.state.deliveryPartner.walletBalance, "0.00");
});

test("salary is credited per month, once, and only to salary partners", async () => {
  const { prisma, service } = createService();
  const salary = { amount: 18000, description: "October salary", salaryPeriod: "2026-10", type: "SALARY" as const };

  await assert.rejects(() => service.createLedgerEntry("partner-1", salary, { auth: adminAuth() }), /salary-based/);

  Object.assign(prisma.state.deliveryPartner, { monthlySalary: "18000.00", paymentType: "SALARY" });
  await assert.rejects(
    () => service.createLedgerEntry("partner-1", { ...salary, salaryPeriod: undefined }, { auth: adminAuth() }),
    BadRequestException
  );

  const credited = await service.createLedgerEntry("partner-1", salary, { auth: adminAuth() });
  assert.equal(credited.type, "SALARY");
  assert.equal(credited.salaryPeriod, "2026-10");
  assert.equal(prisma.state.deliveryPartner.walletBalance, "18000");
  assert.equal(prisma.state.deliveryPartner.totalEarnings, "18000");
  await assert.rejects(
    () => service.createLedgerEntry("partner-1", salary, { auth: adminAuth() }),
    (error: unknown) => error instanceof ConflictException && /2026-10/.test(error.message)
  );

  await service.createLedgerEntry("partner-1", { amount: 5000, description: "Bank transfer", type: "PAYOUT" }, { auth: adminAuth() });
  const earnings = await service.getAdminDeliveryPartnerEarnings("partner-1", adminAuth());
  assert.equal(earnings.totals.salaryEarnings, 18000);
  assert.equal(earnings.totals.paidOut, 5000);
  assert.deepEqual(earnings.payouts.map((entry) => entry.type), ["PAYOUT"]);
  assert.deepEqual(earnings.payment, { commissionType: null, commissionValue: null, monthlySalary: 18000, paymentType: "SALARY" });

  // Older delivery app builds only understand earning and payout entries.
  const cash = await service.getMyCashSummary("partner-1");
  assert.deepEqual(cash.ledgerEntries.map((entry) => entry.type), ["PAYOUT"]);
});

test("warehouse staff cannot settle cash or resolve incidents for other warehouses", async () => {
  const { prisma, service } = createService({ allWarehouses: false, warehouseIds: ["warehouse-9"] });
  prisma.state.assignment.cashCollectedAmount = "1225.00";
  prisma.state.assignment.cashSettlementStatus = "COLLECTED";

  await assert.rejects(
    () => service.updateCashSettlement("assignment-1", { status: "SUBMITTED" }, { auth: warehouseManager() }),
    ForbiddenException
  );

  const incident = await service.createMyIncident("partner-1", "assignment-1", { type: "OTHER" });
  await assert.rejects(() => service.resolveIncident(incident.id, { auth: warehouseManager() }), ForbiddenException);
});
