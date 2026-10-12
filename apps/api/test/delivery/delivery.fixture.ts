import { ForbiddenException } from "@nestjs/common";
import { AuthTokenAudience, type AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import type { WarehouseScope } from "../../src/modules/warehouses/warehouse-access.service";
export const now = new Date("2026-05-25T10:00:00.000Z");

export function adminAuth(overrides: Partial<AuthJwtPayload> = {}): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [
      PermissionCode.DeliveryRead,
      PermissionCode.DeliveryAssign,
      PermissionCode.DeliveryPartnersManage,
      PermissionCode.DeliveryPayoutsManage
    ],
    role: AdminRoleCode.DeliveryManager,
    sessionId: "admin-session-1",
    sub: "admin-1",
    tokenType: "access",
    ...overrides
  };
}

/** Warehouse access with every warehouse in scope unless a staff scope is given. */
export class FakeWarehouseAccess {
  readonly assertedWarehouseIds: string[] = [];

  constructor(private readonly scope: WarehouseScope = { allWarehouses: true }) {}

  async assertCanManageWarehouse(_auth: AuthJwtPayload, warehouseId: string) {
    this.assertedWarehouseIds.push(warehouseId);
    if (!this.scope.allWarehouses && !this.scope.warehouseIds.includes(warehouseId)) {
      throw new ForbiddenException("Admin is not assigned to this warehouse.");
    }
  }

  async getWarehouseScope(): Promise<WarehouseScope> {
    return this.scope;
  }
}

export function createDeliveryPrismaMock(input?: {
  orderStatus?: string;
  useHttpIds?: boolean;
  orderStatusClaimCount?: number;
  assignmentStatusClaimCount?: number;
}) {
  const orderId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000001" : "order-1";
  const partnerId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000002" : "partner-1";
  const assignmentId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000003" : "assignment-1";
  const warehouseId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000004" : "warehouse-1";
  const customerId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000005" : "customer-1";
  const addressId = input?.useHttpIds ? "00000000-0000-4000-8000-000000000006" : "address-1";
  const calls: Record<string, unknown[]> = {
    adminAuditLogCreate: [],
    deliveryAssignmentCreate: [],
    deliveryAssignmentCount: [],
    deliveryAssignmentFindFirst: [],
    deliveryAssignmentFindMany: [],
    deliveryAssignmentUpdate: [],
    deliveryAssignmentUpdateMany: [],
    paymentUpdateMany: [],
    deliveryPartnerDeviceUpsert: [],
    deliveryPartnerDocumentCreate: [],
    deliveryPartnerCount: [],
    deliveryPartnerCreate: [],
    deliveryPartnerFindFirst: [],
    deliveryPartnerFindMany: [],
    deliveryPartnerUpdate: [],
    deliveryPartnerWarehouseCreateMany: [],
    deliveryPartnerWarehouseDeleteMany: [],
    deliveryStatusHistoryCreate: [],
    inventoryStockUpdateMany: [],
    orderFindFirst: [],
    orderStatusHistoryCreate: [],
    orderUpdate: [],
    orderUpdateMany: [],
    warehouseCount: [],
    warehouseFindFirst: []
  };
  const pickupWarehouse = {
    address: "Warehouse Road",
    city: "Delhi",
    code: "DEL-01",
    contactNumber: "+911145678900",
    contactPerson: "Dispatch Desk",
    id: warehouseId,
    latitude: "28.6139390",
    longitude: "77.2090230",
    name: "Delhi warehouse",
    pincode: "110001",
    state: "Delhi"
  };
  const deliveryPartner = {
    commissionType: null as string | null,
    commissionValue: null as string | null,
    createdAt: now,
    deletedAt: null,
    documents: [
      {
        createdAt: now,
        deliveryPartnerId: partnerId,
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
    id: partnerId,
    isOnline: false,
    lastLatitude: null,
    lastLocationAt: null,
    lastLongitude: null,
    lastSeenAt: null,
    mobileNumber: "+919876543210",
    monthlySalary: null as string | null,
    paymentType: null as string | null,
    status: "ACTIVE",
    statusReason: null,
    totalEarnings: "0.00",
    updatedAt: now,
    vehicleNumber: "DL01AB1234",
    walletBalance: "0.00",
    warehouses: [{ createdAt: now, warehouse: pickupWarehouse, warehouseId }] as Array<{
      createdAt: Date;
      warehouse: typeof pickupWarehouse;
      warehouseId: string;
    }>
  };
  const shippingAddress = {
    city: "Delhi",
    country: "India",
    fullName: "Dr. Nisha Rao",
    id: addressId,
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
    id: customerId,
    lastName: "Rao",
    mobileNumber: "+919999888877"
  };
  const order = {
    createdAt: now,
    deletedAt: null,
    discountTotal: "25.00",
    grandTotal: "1225.00",
    id: orderId,
    userId: customerId,
    placedAt: now,
    refunds: [],
    statusHistory: [] as Array<Record<string, unknown>>,
    items: [
      {
        id: "item-1",
        name: "Sterile gloves",
        productId: "product-1",
        quantity: 2,
        sku: "GLV-100",
        taxAmount: "100.00",
        taxRate: "9.09",
        stockBatchId: null,
        total: "1200.00",
        unitPrice: "550.00",
        variantId: null,
        warehouseId: warehouseId
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
    status: input?.orderStatus ?? "ASSIGNED",
    subtotal: "1100.00",
    taxTotal: "100.00",
    shippingTotal: "50.00",
    updatedAt: now,
    user: customer,
    warehouseId: warehouseId
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
    deliveryPartnerId: partnerId,
    failureReason: null as string | null,
    id: assignmentId,
    order,
    orderId: orderId,
    pickedUpAt: null as Date | null,
    pickupWarehouse,
    pickupWarehouseId: warehouseId,
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
  const notifications: Array<{ id: string; createdAt: Date; channel: string; recipient: string; payload: unknown; status: string; templateKey: string }> = [];
  const incidents: Array<Record<string, unknown>> = [];
  const ledgerEntries: Array<Record<string, unknown>> = [];
  const prisma = {
    calls,
    state: { order, deliveryPartner, ledgerEntries, get assignment() { return assignment; } },
    user: { findFirst: async () => ({ ...customer, isActive: true, deletedAt: null }) },
    $transaction: async <T>(callback: ((tx: typeof prisma) => Promise<T>) | Promise<T>[]) =>
      typeof callback === "function" ? callback(prisma) : Promise.all(callback),
    adminAuditLog: {
      create: async (args: unknown) => {
        calls.adminAuditLogCreate.push(args);
        return { id: "audit-1" };
      }
    },
    deliveryAssignment: {
      groupBy: async () => [{ cashSettlementStatus: assignment.cashSettlementStatus, _count: { _all: assignment.cashCollectedAmount === null ? 0 : 1 }, _sum: { cashCollectedAmount: assignment.cashCollectedAmount } }],
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
      findFirst: async (args: { where: { deliveryPartnerId?: string; id?: string } }) => {
        calls.deliveryAssignmentFindFirst.push(args);
        if (args.where.deliveryPartnerId && args.where.deliveryPartnerId !== assignment.deliveryPartnerId) return null;
        return assignment;
      },
      findMany: async (args: unknown) => {
        calls.deliveryAssignmentFindMany.push(args);
        return [assignment];
      },
      updateMany: async (args: { data: Record<string, unknown>; where: { id: string; status?: string; cashSettlementStatus?: string } }) => {
        calls.deliveryAssignmentUpdateMany.push(args);
        if (input?.assignmentStatusClaimCount === 0 || (args.where.status && args.where.status !== assignment.status)) return { count: 0 };
        if (args.where.cashSettlementStatus && args.where.cashSettlementStatus !== assignment.cashSettlementStatus) return { count: 0 };
        assignment = { ...assignment, ...args.data, statusHistory };
        return { count: 1 };
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
      updateMany: async ({ where, data }: { where: { walletBalance?: { gte: number } }; data: { walletBalance?: { increment?: number; decrement?: number }; totalEarnings?: { increment?: number } } }) => {
        if (Number(deliveryPartner.walletBalance) < (where.walletBalance?.gte ?? 0)) return { count: 0 };
        deliveryPartner.walletBalance = String(Number(deliveryPartner.walletBalance) + (data.walletBalance?.increment ?? 0) - (data.walletBalance?.decrement ?? 0));
        deliveryPartner.totalEarnings = String(Number(deliveryPartner.totalEarnings) + (data.totalEarnings?.increment ?? 0));
        return { count: 1 };
      },
      count: async (args: unknown) => {
        calls.deliveryPartnerCount.push(args);
        return 1;
      },
      create: async (args: { data: Record<string, unknown> & { warehouses?: { create: Array<{ warehouseId: string }> } } }) => {
        calls.deliveryPartnerCreate.push(args);
        const { warehouses, ...data } = args.data;
        return {
          ...deliveryPartner,
          commissionType: null,
          commissionValue: null,
          documents: [],
          id: "partner-new",
          monthlySalary: null,
          paymentType: null,
          totalEarnings: "0.00",
          walletBalance: "0.00",
          ...data,
          warehouses: (warehouses?.create ?? []).map(({ warehouseId: id }) => ({
            warehouse: { ...pickupWarehouse, id },
            warehouseId: id
          }))
        };
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
    deliveryPartnerWarehouse: {
      createMany: async (args: { data: Array<{ warehouseId: string }> }) => {
        calls.deliveryPartnerWarehouseCreateMany.push(args);
        for (const { warehouseId: id } of args.data) {
          if (!deliveryPartner.warehouses.some((link) => link.warehouseId === id)) {
            deliveryPartner.warehouses.push({ createdAt: new Date(), warehouse: { ...pickupWarehouse, id }, warehouseId: id });
          }
        }
        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { warehouseId: { notIn: string[] } } }) => {
        calls.deliveryPartnerWarehouseDeleteMany.push(args);
        const kept = deliveryPartner.warehouses.filter((link) => args.where.warehouseId.notIn.includes(link.warehouseId));
        const count = deliveryPartner.warehouses.length - kept.length;
        deliveryPartner.warehouses = kept;
        return { count };
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
        return { ...order, deliveryAssignments: [assignment] };
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
    payment: {
      updateMany: async (args: { data: Record<string, unknown> }) => {
        calls.paymentUpdateMany.push(args);
        Object.assign(order.payments[0]!, args.data);
        return { count: 1 };
      }
    },
    orderStatusHistory: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.orderStatusHistoryCreate.push(args);
        const entry = { id: `order-history-${order.statusHistory.length + 1}`, createdAt: now, ...args.data };
        order.statusHistory.push(entry);
        return entry;
      }
    },
    deliveryPartnerLedgerEntry: {
      findMany: async ({ where }: { where?: { type?: string | { in: string[] } } } = {}) =>
        ledgerEntries.filter((entry) => {
          const type = where?.type;
          if (type === undefined) return true;
          return typeof type === "string" ? entry.type === type : type.in.includes(entry.type as string);
        }),
      groupBy: async () => {
        const sums = new Map<string, number>();
        for (const entry of ledgerEntries) sums.set(entry.type as string, (sums.get(entry.type as string) ?? 0) + Number(entry.amount));
        return [...sums].map(([type, amount]) => ({ _sum: { amount: amount.toFixed(2) }, type }));
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        // Mirror the unique indexes on deliveryAssignmentId and (deliveryPartnerId, salaryPeriod).
        const duplicate = ledgerEntries.some((entry) =>
          (data.deliveryAssignmentId && entry.deliveryAssignmentId === data.deliveryAssignmentId) ||
          (data.salaryPeriod && entry.deliveryPartnerId === data.deliveryPartnerId && entry.salaryPeriod === data.salaryPeriod)
        );
        if (duplicate) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        const entry = { ...data, id: `ledger-${ledgerEntries.length + 1}`, createdAt: now };
        ledgerEntries.push(entry);
        return entry;
      }
    },
    notificationLog: {
      create: async ({ data }: { data: Omit<(typeof notifications)[number], "id" | "createdAt"> }) => {
        const item = { ...data, id: `00000000-0000-4000-8000-${String(100 + notifications.length).padStart(12, "0")}`, createdAt: now };
        notifications.push(item);
        return item;
      },
      findMany: async ({ where, take }: { where: { recipient: string }; take?: number }) => notifications.filter((item) => item.recipient === where.recipient).slice(0, take),
      findFirst: async ({ where }: { where: { id: string; recipient?: string } }) => notifications.find((item) => item.id === where.id && (!where.recipient || item.recipient === where.recipient)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const item = notifications.find((item) => item.id === where.id)!;
        Object.assign(item, data);
        return item;
      }
    },
    deliveryIncident: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const incident = { ...data, id: `00000000-0000-4000-8000-${String(200 + incidents.length).padStart(12, "0")}`, createdAt: now, updatedAt: now, resolvedAt: null };
        incidents.push(incident);
        return incident;
      },
      findMany: async ({ where }: { where: { deliveryPartnerId: string } }) => incidents.filter((item) => item.deliveryPartnerId === where.deliveryPartnerId),
      findUnique: async ({ where }: { where: { id: string } }) => incidents.find((item) => item.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const item = incidents.find((item) => item.id === where.id)!;
        Object.assign(item, data);
        return item;
      }
    },
    warehouse: {
      count: async (args: { where: { id: { in: string[] } } }) => {
        calls.warehouseCount.push(args);
        return args.where.id.in.filter((id) => !id.startsWith("missing-")).length;
      },
      findFirst: async (args: unknown) => {
        calls.warehouseFindFirst.push(args);
        return pickupWarehouse;
      }
    }
  };

  return prisma;
}
