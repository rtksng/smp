import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import {
  CashCollectionStatus,
  DeliveryCommissionType,
  DeliveryIncidentStatus,
  DeliveryIncidentType,
  DeliveryLedgerEntryType,
  DeliveryPartnerPaymentType,
  DeliveryPartnerStatus,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  WarehouseStatus
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { ApiQueueService } from "../../queues/api-queue.service";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { PermissionCode } from "../permissions/permissions.constants";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type {
  AddDeliveryPartnerDocumentDto,
  AdminDeliveryAssignmentListQueryDto,
  AssignDeliveryDto,
  CreateDeliveryLedgerEntryDto,
  CreateDeliveryIncidentDto,
  CreateDeliveryPartnerDto,
  DeliveryAssignmentListQueryDto,
  DeliveryPartnerDeviceDto,
  DeliveryPartnerLocationDto,
  DeliveryPartnerListQueryDto,
  DeliveryPartnerOnlineStatusDto,
  UpdateCashSettlementDto,
  UpdateDeliveryPartnerDto,
  UpdateDeliveryPartnerProfileDto,
  UpdateDeliveryAssignmentStatusDto
} from "./dto/delivery.dto";

const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.OUT_FOR_DELIVERY
] as const;

const PARTNER_INCLUDE = {
  documents: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  warehouses: {
    include: {
      warehouse: {
        select: {
          address: true,
          city: true,
          code: true,
          contactNumber: true,
          contactPerson: true,
          id: true,
          name: true,
          pincode: true,
          state: true
        }
      }
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    where: { warehouse: { deletedAt: null } }
  }
} as const satisfies Prisma.DeliveryPartnerInclude;

const ASSIGNMENT_INCLUDE = {
  deliveryPartner: {
    include: PARTNER_INCLUDE
  },
  order: {
    include: {
      items: {
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
        select: {
          id: true,
          name: true,
          productId: true,
          quantity: true,
          sku: true,
          taxAmount: true,
          total: true,
          unitPrice: true,
          variantId: true,
          warehouseId: true
        }
      },
      payments: {
        orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
        select: {
          amount: true,
          createdAt: true,
          id: true,
          method: true,
          status: true
        },
        take: 1
      },
      shippingAddress: true,
      user: {
        select: {
          businessName: true,
          firstName: true,
          id: true,
          lastName: true,
          mobileNumber: true
        }
      }
    }
  },
  earningEntry: {
    select: { amount: true }
  },
  pickupWarehouse: true,
  statusHistory: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.DeliveryAssignmentInclude;

// Older delivery app builds validate ledger types strictly, so the cash summary
// keeps returning only the types those builds know. The earnings summary has all.
const LEGACY_CASH_LEDGER_TYPES: DeliveryLedgerEntryType[] = [
  DeliveryLedgerEntryType.DELIVERY_EARNING,
  DeliveryLedgerEntryType.PAYOUT
];

const ASSIGNMENT_STATUS_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.ACCEPTED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.CANCELLED]: [],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: [],
  [DeliveryStatus.OUT_FOR_DELIVERY]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.FAILED]
};

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type DeliveryClient =
  | Pick<
      Prisma.TransactionClient,
      | "adminAuditLog"
      | "deliveryAssignment"
      | "deliveryIncident"
      | "deliveryPartner"
      | "deliveryPartnerDevice"
      | "deliveryPartnerDocument"
      | "deliveryPartnerLedgerEntry"
      | "deliveryPartnerWarehouse"
      | "deliveryStatusHistory"
      | "inventoryStock"
      | "order"
      | "orderStatusHistory"
      | "notificationLog"
      | "warehouse"
    >
  | PrismaService;
type DeliveryPartnerRecord = Prisma.DeliveryPartnerGetPayload<{
  include: typeof PARTNER_INCLUDE;
}>;
type DeliveryAssignmentRecord = Prisma.DeliveryAssignmentGetPayload<{
  include: typeof ASSIGNMENT_INCLUDE;
}>;
type DeliveryPartnerPaymentInput = {
  commissionType?: DeliveryCommissionType;
  commissionValue?: number;
  monthlySalary?: number;
  paymentType?: DeliveryPartnerPaymentType;
};
type DeliveryPartnerPaymentStructure = {
  commissionType: DeliveryCommissionType | null;
  commissionValue: DecimalValue | null;
  monthlySalary: DecimalValue | null;
  paymentType: DeliveryPartnerPaymentType | null;
};
type DeliveryLedgerEntryRecord = {
  amount: DecimalValue;
  createdAt: Date;
  deliveryAssignmentId?: string | null;
  description: string;
  id: string;
  reference: string | null;
  salaryPeriod?: string | null;
  type: DeliveryLedgerEntryType;
};

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly apiQueueService?: ApiQueueService,
    @Optional() private readonly configService?: ConfigService
  ) {}

  async listAdminDeliveryPartners(
    query: DeliveryPartnerListQueryDto,
    auth: AuthJwtPayload
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.DeliveryPartnerWhereInput = {
      deletedAt: null,
      OR: search
        ? [
            { fullName: { contains: search, mode: "insensitive" } },
            { mobileNumber: { contains: search } },
            { vehicleNumber: { contains: search, mode: "insensitive" } }
          ]
        : undefined,
      status: query.status,
      warehouses: await this.buildPartnerWarehouseFilter(auth, query.warehouseId)
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryPartner.findMany({
        include: PARTNER_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.deliveryPartner.count({
        where: stripUndefined(where)
      })
    ]);

    return paginated(
      items.map((partner) => this.serializePartner(partner)),
      total,
      page,
      limit
    );
  }

  async getAdminDeliveryPartner(id: string, auth: AuthJwtPayload) {
    const partner = await this.findAdminPartner(this.prisma, id, auth);

    return this.serializePartner(partner);
  }

  async getAdminDeliveryPartnerEarnings(id: string, auth: AuthJwtPayload) {
    const partner = await this.findAdminPartner(this.prisma, id, auth);

    return this.buildEarningsSummary(partner);
  }

  async createDeliveryPartner(
    input: CreateDeliveryPartnerDto,
    context: AdminActionContext
  ) {
    const warehouseIds = await this.resolveNewPartnerWarehouseIds(
      context.auth,
      input.warehouseIds
    );
    const payment = this.resolvePaymentChange(context.auth, input);

    try {
      const partner = await this.prisma.$transaction(async (tx) => {
        await this.assertWarehousesExist(tx, warehouseIds);
        const createdPartner = await tx.deliveryPartner.create({
          data: {
            ...payment,
            email: normalizeOptionalEmail(input.email) ?? null,
            fullName: input.fullName.trim(),
            mobileNumber: input.mobileNumber.trim(),
            // Staff-created partners are already vetted, so they can sign in immediately.
            status: DeliveryPartnerStatus.ACTIVE,
            vehicleNumber: normalizeOptionalVehicle(input.vehicleNumber) ?? null,
            warehouses: {
              create: warehouseIds.map((warehouseId) => ({ warehouseId }))
            }
          },
          include: PARTNER_INCLUDE
        });

        await this.writeAuditLog(tx, context, {
          action: "delivery_partner.create",
          after: createdPartner,
          entityId: createdPartner.id,
          entityType: "DeliveryPartner"
        });

        return createdPartner;
      });

      return this.serializePartner(partner);
    } catch (error: unknown) {
      throwIfDuplicatePartner(error);
      throw error;
    }
  }

  async updateDeliveryPartner(
    id: string,
    input: UpdateDeliveryPartnerDto,
    context: AdminActionContext
  ) {
    const existingPartner = await this.findAdminPartner(this.prisma, id, context.auth);
    const payment = this.resolvePaymentChange(context.auth, input);
    const warehouseIds =
      input.warehouseIds === undefined
        ? undefined
        : await this.resolveReplacementWarehouseIds(context.auth, input.warehouseIds);

    try {
      const partner = await this.prisma.$transaction(async (tx) => {
        if (warehouseIds) {
          await this.assertWarehousesExist(tx, warehouseIds);
          await tx.deliveryPartnerWarehouse.deleteMany({
            where: { deliveryPartnerId: id, warehouseId: { notIn: warehouseIds } }
          });
          await tx.deliveryPartnerWarehouse.createMany({
            data: warehouseIds.map((warehouseId) => ({ deliveryPartnerId: id, warehouseId })),
            skipDuplicates: true
          });
        }

        const updatedPartner = await tx.deliveryPartner.update({
          data: {
            ...payment,
            email: normalizeOptionalEmail(input.email),
            fullName: input.fullName?.trim() || undefined,
            mobileNumber: input.mobileNumber?.trim() || undefined,
            vehicleNumber: normalizeOptionalVehicle(input.vehicleNumber)
          },
          include: PARTNER_INCLUDE,
          where: { id }
        });

        await this.writeAuditLog(tx, context, {
          action: "delivery_partner.update",
          after: updatedPartner,
          before: existingPartner,
          entityId: id,
          entityType: "DeliveryPartner"
        });

        return updatedPartner;
      });

      return this.serializePartner(partner);
    } catch (error: unknown) {
      throwIfDuplicatePartner(error);
      throw error;
    }
  }

  async approveDeliveryPartner(id: string, context: AdminActionContext) {
    const existingPartner = await this.findAdminPartner(this.prisma, id, context.auth);
    const partner = await this.prisma.$transaction(async (tx) => {
      const updatedPartner = await tx.deliveryPartner.update({
        data: {
          status: DeliveryPartnerStatus.ACTIVE,
          statusReason: null
        },
        include: PARTNER_INCLUDE,
        where: {
          id
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "delivery_partner.approve",
        after: updatedPartner,
        before: existingPartner,
        entityId: id,
        entityType: "DeliveryPartner"
      });

      return updatedPartner;
    });

    return this.serializePartner(partner);
  }

  async rejectDeliveryPartner(
    id: string,
    context: AdminActionContext,
    reason?: string
  ) {
    const existingPartner = await this.findAdminPartner(this.prisma, id, context.auth);
    const partner = await this.prisma.$transaction(async (tx) => {
      const updatedPartner = await tx.deliveryPartner.update({
        data: {
          isOnline: false,
          status: DeliveryPartnerStatus.INACTIVE,
          statusReason: reason?.trim() || "Application was not approved."
        },
        include: PARTNER_INCLUDE,
        where: {
          id
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "delivery_partner.reject",
        after: updatedPartner,
        before: existingPartner,
        entityId: id,
        entityType: "DeliveryPartner"
      });

      return updatedPartner;
    });

    return this.serializePartner(partner);
  }

  async assignOrder(input: AssignDeliveryDto, context: AdminActionContext) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        include: {
          items: true
        },
        where: {
          deletedAt: null,
          id: input.orderId
        }
      });

      if (!order) {
        throw new NotFoundException("Order was not found.");
      }

      if (
        order.status !== OrderStatus.CONFIRMED &&
        order.status !== OrderStatus.PACKED
      ) {
        throw new BadRequestException(
          "Order can be assigned only after it is confirmed or packed."
        );
      }

      const deliveryPartner = await this.findPartnerById(tx, input.deliveryPartnerId, {
        requireActive: true
      });
      const pickupWarehouseId = input.pickupWarehouseId ?? order.warehouseId;

      if (pickupWarehouseId) {
        await this.warehouseAccessService.assertCanManageWarehouse(
          context.auth,
          pickupWarehouseId
        );
        await this.findActiveWarehouse(tx, pickupWarehouseId);

        if (
          !deliveryPartner.warehouses.some(
            (link) => link.warehouseId === pickupWarehouseId
          )
        ) {
          throw new BadRequestException(
            "Delivery partner is not assigned to the pickup warehouse."
          );
        }
      }

      const orderClaim = await tx.order.updateMany({
        data: {
          status: OrderStatus.ASSIGNED
        },
        where: {
          deletedAt: null,
          id: order.id,
          status: {
            in: [OrderStatus.CONFIRMED, OrderStatus.PACKED]
          }
        }
      });

      if (orderClaim.count !== 1) {
        throw new ConflictException("Order is no longer available for assignment.");
      }

      const assignment = await tx.deliveryAssignment.create({
        data: {
          deliveryPartnerId: deliveryPartner.id,
          orderId: order.id,
          pickupWarehouseId,
          status: DeliveryStatus.ASSIGNED
        },
        include: ASSIGNMENT_INCLUDE
      });

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryAssignmentId: assignment.id,
          note: input.note,
          status: DeliveryStatus.ASSIGNED
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          changedById: context.auth.sub,
          note: input.note,
          orderId: order.id,
          status: OrderStatus.ASSIGNED
        }
      });
      await this.writeAuditLog(tx, context, {
        action: "delivery.assign",
        after: assignment,
        entityId: assignment.id,
        entityType: "DeliveryAssignment"
      });

      const serializedAssignment = this.serializeAssignment(
        await this.findAssignmentById(tx, assignment.id)
      );
      const notification = this.apiQueueService
        ? await tx.notificationLog.create({
            data: {
              channel: "delivery_partner",
              payload: {
                assignmentId: assignment.id,
                body: `Order ${serializedAssignment.orderNumber} is ready for pickup.`,
                readAt: null,
                title: "New delivery assigned",
                type: "NEW_ASSIGNMENT"
              },
              recipient: deliveryPartner.id,
              status: "PENDING",
              templateKey: "delivery_assignment"
            }
          })
        : null;

      return {
        assignment: serializedAssignment,
        notificationId: notification?.id ?? null
      };
    });

    if (!this.apiQueueService || !result.notificationId) {
      return result.assignment;
    }

    const notificationId = result.notificationId;

    await this.apiQueueService
      .enqueueDeliveryAssignmentNotification({
        assignmentId: result.assignment.id,
        body: `Order ${result.assignment.orderNumber} is ready for pickup.`,
        deliveryPartnerId: result.assignment.deliveryPartnerId,
        notificationId,
        requestedAt: new Date().toISOString(),
        title: "New delivery assigned",
        version: 1
      })
      .catch(async () => {
        await this.prisma.notificationLog.update({
          data: { status: "QUEUE_FAILED" },
          where: { id: notificationId }
        });
      });

    return result.assignment;
  }

  async listAdminDeliveryAssignments(
    query: AdminDeliveryAssignmentListQueryDto,
    auth: AuthJwtPayload
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const warehouseFilter = await this.buildAssignmentWarehouseScopeFilter(
      auth,
      query.warehouseId
    );
    const assignmentFilters = stripUndefined(buildAssignmentFilters(query));
    const where: Prisma.DeliveryAssignmentWhereInput = {
      ...(query.search && warehouseFilter
        ? { AND: [warehouseFilter, assignmentFilters] }
        : { ...warehouseFilter, ...assignmentFilters }),
      deliveryPartnerId: query.deliveryPartnerId,
      status: query.status
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        include: ASSIGNMENT_INCLUDE,
        orderBy: assignmentOrderBy(query.sort),
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.deliveryAssignment.count({
        where: stripUndefined(where)
      })
    ]);

    return paginated(
      items.map((assignment) => this.serializeAssignment(assignment)),
      total,
      page,
      limit
    );
  }

  async getMyProfile(deliveryPartnerId: string) {
    const partner = await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });

    return this.serializePartner(partner);
  }

  async updateMyOnlineStatus(
    deliveryPartnerId: string,
    input: DeliveryPartnerOnlineStatusDto
  ) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const partner = await this.prisma.deliveryPartner.update({
      data: {
        isOnline: input.isOnline,
        lastSeenAt: new Date()
      },
      include: PARTNER_INCLUDE,
      where: {
        id: deliveryPartnerId
      }
    });

    return this.serializePartner(partner);
  }

  async registerMyDevice(
    deliveryPartnerId: string,
    input: DeliveryPartnerDeviceDto
  ) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const now = new Date();
    const device = await this.prisma.deliveryPartnerDevice.upsert({
      create: {
        deliveryPartnerId,
        lastSeenAt: now,
        notificationsEnabled: input.notificationsEnabled ?? true,
        platform: input.platform,
        pushToken: input.pushToken,
        revokedAt: null
      },
      update: {
        deliveryPartnerId,
        lastSeenAt: now,
        notificationsEnabled: input.notificationsEnabled ?? true,
        platform: input.platform,
        revokedAt: null
      },
      where: {
        pushToken: input.pushToken
      }
    });

    return this.serializeDevice(device);
  }

  async updateMyLocation(
    deliveryPartnerId: string,
    input: DeliveryPartnerLocationDto
  ) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const now = new Date();
    const partner = await this.prisma.deliveryPartner.update({
      data: {
        lastLatitude: input.latitude,
        lastLocationAt: now,
        lastLongitude: input.longitude,
        lastSeenAt: now
      },
      include: PARTNER_INCLUDE,
      where: {
        id: deliveryPartnerId
      }
    });

    return this.serializePartner(partner);
  }

  async addMyDocument(deliveryPartnerId: string, input: AddDeliveryPartnerDocumentDto) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    await this.prisma.deliveryPartnerDocument.create({
      data: {
        deliveryPartnerId,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        title: input.title,
        type: input.type
      }
    });

    return this.getMyProfile(deliveryPartnerId);
  }

  async listMyAssignments(
    deliveryPartnerId: string,
    query: DeliveryAssignmentListQueryDto = {}
  ) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DeliveryAssignmentWhereInput = {
      ...stripUndefined(buildAssignmentFilters(query)),
      deliveryPartnerId,
      status: query.status
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        include: ASSIGNMENT_INCLUDE,
        orderBy: assignmentOrderBy(query.sort),
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.deliveryAssignment.count({
        where: stripUndefined(where)
      })
    ]);

    return paginated(
      items.map((assignment) => this.serializeAssignment(assignment)),
      total,
      page,
      limit
    );
  }

  async revokeMyDevices(deliveryPartnerId: string) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const result = await this.prisma.deliveryPartnerDevice.updateMany({
      data: {
        notificationsEnabled: false,
        revokedAt: new Date()
      },
      where: {
        deliveryPartnerId,
        revokedAt: null
      }
    });

    return { revokedDevices: result.count };
  }

  async updateMyProfile(
    deliveryPartnerId: string,
    input: UpdateDeliveryPartnerProfileDto
  ) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const partner = await this.prisma.deliveryPartner.update({
      data: {
        email:
          input.email === undefined
            ? undefined
            : input.email?.trim().toLowerCase() || null,
        fullName: input.fullName?.trim() || undefined,
        vehicleNumber:
          input.vehicleNumber === undefined
            ? undefined
            : input.vehicleNumber?.trim().toUpperCase() || null
      },
      include: PARTNER_INCLUDE,
      where: { id: deliveryPartnerId }
    });

    return this.serializePartner(partner);
  }

  async getMyAssignment(deliveryPartnerId: string, assignmentId: string) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });

    return this.serializeAssignment(
      await this.findPartnerAssignment(
        this.prisma,
        deliveryPartnerId,
        assignmentId
      )
    );
  }

  async getMyDashboard(deliveryPartnerId: string) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const assignments = await this.prisma.deliveryAssignment.findMany({
      select: {
        order: {
          select: {
            grandTotal: true,
            payments: {
              orderBy: [{ createdAt: "desc" }, { id: "asc" }],
              select: { method: true },
              take: 1
            }
          }
        },
        status: true
      },
      where: { deliveryPartnerId }
    });
    const statusCounts = Object.fromEntries(
      Object.values(DeliveryStatus).map((status) => [status, 0])
    ) as Record<DeliveryStatus, number>;
    let activeCount = 0;
    let codToCollect = 0;
    let completedCount = 0;
    let issueCount = 0;

    for (const assignment of assignments) {
      statusCounts[assignment.status] += 1;

      if (ACTIVE_DELIVERY_STATUSES.includes(assignment.status)) {
        activeCount += 1;

        if (assignment.order.payments[0]?.method === PaymentMethod.COD) {
          codToCollect += decimalToNumber(assignment.order.grandTotal);
        }
      } else if (assignment.status === DeliveryStatus.DELIVERED) {
        completedCount += 1;
      } else if (
        assignment.status === DeliveryStatus.FAILED ||
        assignment.status === DeliveryStatus.CANCELLED
      ) {
        issueCount += 1;
      }
    }

    return {
      activeCount,
      codToCollect,
      completedCount,
      issueCount,
      statusCounts
    };
  }

  async getMyCashSummary(deliveryPartnerId: string) {
    const partner = await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const [assignments, ledgerEntries, cashTotals] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ cashCollectedAt: "desc" }, { assignedAt: "desc" }],
        take: 100,
        where: {
          cashCollectedAmount: { not: null },
          deliveryPartnerId
        }
      }),
      this.prisma.deliveryPartnerLedgerEntry.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 100,
        where: { deliveryPartnerId, type: { in: LEGACY_CASH_LEDGER_TYPES } }
      }),
      this.prisma.deliveryAssignment.groupBy({
        by: ["cashSettlementStatus"],
        _count: { _all: true },
        _sum: { cashCollectedAmount: true },
        where: { deliveryPartnerId, cashCollectedAmount: { not: null } }
      })
    ]);
    let cashInHand = 0;
    let submittedAmount = 0;
    let settledAmount = 0;
    let pendingCount = 0;

    for (const total of cashTotals) {
      const amount = decimalToNumberOrNull(total._sum.cashCollectedAmount) ?? 0;
      if (total.cashSettlementStatus === CashCollectionStatus.COLLECTED) {
        cashInHand += amount;
        pendingCount += total._count._all;
      } else if (
        total.cashSettlementStatus === CashCollectionStatus.SUBMITTED
      ) {
        submittedAmount += amount;
      } else if (
        total.cashSettlementStatus === CashCollectionStatus.SETTLED
      ) {
        settledAmount += amount;
      }
    }

    const items = assignments.map((assignment) => {
      return {
        amount: decimalToNumberOrNull(assignment.cashCollectedAmount) ?? 0,
        assignmentId: assignment.id,
        collectedAt: assignment.cashCollectedAt,
        orderNumber: assignment.order.orderNumber,
        settlementStatus: assignment.cashSettlementStatus
      };
    });

    return {
      cashInHand,
      items,
      ledgerEntries: ledgerEntries.map((entry) => serializeLedgerEntry(entry)),
      pendingCount,
      settledAmount,
      submittedAmount,
      wallet: serializeWallet(partner)
    };
  }

  async getMyEarnings(deliveryPartnerId: string) {
    const partner = await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });

    return this.buildEarningsSummary(partner);
  }

  async listMyNotifications(deliveryPartnerId: string) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const notifications = await this.prisma.notificationLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 100,
      where: {
        channel: "delivery_partner",
        recipient: deliveryPartnerId
      }
    });
    const items = notifications.map((notification) =>
      serializeDeliveryNotification(notification)
    );

    return {
      items,
      unreadCount: items.filter((item) => !item.isRead).length
    };
  }

  async markMyNotificationRead(
    deliveryPartnerId: string,
    notificationId: string
  ) {
    const notification = await this.prisma.notificationLog.findFirst({
      where: {
        channel: "delivery_partner",
        id: notificationId,
        recipient: deliveryPartnerId
      }
    });

    if (!notification) {
      throw new NotFoundException("Delivery notification was not found.");
    }

    const payload = jsonRecord(notification.payload);
    const updated = await this.prisma.notificationLog.update({
      data: {
        payload: {
          ...payload,
          readAt: typeof payload.readAt === "string" ? payload.readAt : new Date().toISOString()
        }
      },
      where: { id: notification.id }
    });

    return serializeDeliveryNotification(updated);
  }

  async markAllMyNotificationsRead(deliveryPartnerId: string) {
    const notifications = await this.prisma.notificationLog.findMany({
      where: {
        channel: "delivery_partner",
        recipient: deliveryPartnerId
      }
    });
    const readAt = new Date().toISOString();

    await this.prisma.$transaction(
      notifications.map((notification) => {
        const payload = jsonRecord(notification.payload);

        return this.prisma.notificationLog.update({
          data: {
            payload: {
              ...payload,
              readAt: typeof payload.readAt === "string" ? payload.readAt : readAt
            }
          },
          where: { id: notification.id }
        });
      })
    );

    return { markedRead: notifications.length };
  }

  async createMyIncident(
    deliveryPartnerId: string,
    assignmentId: string,
    input: CreateDeliveryIncidentDto
  ) {
    await this.findPartnerAssignment(
      this.prisma,
      deliveryPartnerId,
      assignmentId
    );
    const incident = await this.prisma.deliveryIncident.create({
      data: {
        deliveryAssignmentId: assignmentId,
        deliveryPartnerId,
        note: input.note?.trim() || null,
        photoKey: input.photoKey ?? null,
        photoUrl: input.photoUrl ?? null,
        status: DeliveryIncidentStatus.OPEN,
        type: input.type
      }
    });

    return serializeDeliveryIncident(incident);
  }

  async listMyIncidents(deliveryPartnerId: string) {
    await this.findPartnerById(this.prisma, deliveryPartnerId, {
      requireActive: true
    });
    const incidents = await this.prisma.deliveryIncident.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 100,
      where: { deliveryPartnerId }
    });

    return {
      items: incidents.map((incident) => serializeDeliveryIncident(incident))
    };
  }

  getSupportContact() {
    return {
      email: this.configService?.get<string>("DELIVERY_SUPPORT_EMAIL") ?? null,
      phone: this.configService?.get<string>("DELIVERY_SUPPORT_PHONE") ?? null
    };
  }

  async updateCashSettlement(
    assignmentId: string,
    input: UpdateCashSettlementDto,
    context: AdminActionContext
  ) {
    const existing = await this.findAssignmentById(this.prisma, assignmentId);

    await this.assertCanManageAssignment(context.auth, existing);

    if (existing.cashCollectedAmount === null) {
      throw new BadRequestException("No collected COD cash exists for this delivery.");
    }

    if (existing.cashSettlementStatus === input.status) return this.serializeAssignment(existing);

    if (
      input.status === CashCollectionStatus.SUBMITTED &&
      existing.cashSettlementStatus !== CashCollectionStatus.COLLECTED
    ) {
      throw new BadRequestException("Only collected cash can be submitted.");
    }

    if (
      input.status === CashCollectionStatus.SETTLED &&
      existing.cashSettlementStatus !== CashCollectionStatus.SUBMITTED
    ) {
      throw new BadRequestException("Cash must be submitted before settlement.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.deliveryAssignment.updateMany({
        data: { cashSettlementStatus: input.status },
        where: { id: assignmentId, cashSettlementStatus: existing.cashSettlementStatus }
      });
      if (claim.count !== 1) throw new ConflictException("Cash settlement changed. Refresh before trying again.");
      const assignment = await this.findAssignmentById(tx, assignmentId);

      await this.writeAuditLog(tx, context, {
        action: "delivery.cash_settlement",
        after: assignment,
        before: existing,
        entityId: assignmentId,
        entityType: "DeliveryAssignment"
      });

      return assignment;
    });

    const serialized = this.serializeAssignment(updated);

    if (this.apiQueueService) {
      const title =
        input.status === CashCollectionStatus.SETTLED
          ? "COD cash settled"
          : "COD cash submitted";
      const body = `${serialized.orderNumber}: ${decimalToNumber(
        updated.cashCollectedAmount ?? 0
      ).toFixed(2)} INR ${input.status.toLowerCase()}.`;
      const notification = await this.prisma.notificationLog.create({
        data: {
          channel: "delivery_partner",
          payload: {
            assignmentId,
            body,
            readAt: null,
            title,
            type: "CASH_SETTLEMENT"
          },
          recipient: updated.deliveryPartnerId,
          status: "PENDING",
          templateKey: "delivery_cash_settlement"
        }
      });

      await this.apiQueueService
        .enqueueDeliveryAssignmentNotification({
          assignmentId,
          body,
          deliveryPartnerId: updated.deliveryPartnerId,
          notificationId: notification.id,
          requestedAt: new Date().toISOString(),
          title,
          version: 1
        })
        .catch(async () => {
          await this.prisma.notificationLog.update({
            data: { status: "QUEUE_FAILED" },
            where: { id: notification.id }
          });
        });
    }

    return serialized;
  }

  async createLedgerEntry(
    deliveryPartnerId: string,
    input: CreateDeliveryLedgerEntryDto,
    context: AdminActionContext
  ) {
    const existingPartner = await this.findAdminPartner(
      this.prisma,
      deliveryPartnerId,
      context.auth
    );
    const amount = input.amount;
    const isPayout = input.type === DeliveryLedgerEntryType.PAYOUT;
    const isSalary = input.type === DeliveryLedgerEntryType.SALARY;
    const salaryPeriod = isSalary ? input.salaryPeriod : undefined;

    if (existingPartner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new BadRequestException("Delivery partner is not active.");
    }

    if (isSalary) {
      if (existingPartner.paymentType !== DeliveryPartnerPaymentType.SALARY) {
        throw new BadRequestException(
          "Salary can be credited only to salary-based delivery partners."
        );
      }

      if (!salaryPeriod) {
        throw new BadRequestException("Choose the salary month to credit.");
      }
    }

    if (isPayout && decimalToNumber(existingPartner.walletBalance) < amount) {
      throw new BadRequestException("Payout exceeds the partner wallet balance.");
    }

    const entry = await this.prisma
      .$transaction(async (tx) => {
        const balanceUpdate = await tx.deliveryPartner.updateMany({
          data: {
            totalEarnings: isPayout ? undefined : { increment: amount },
            walletBalance: isPayout ? { decrement: amount } : { increment: amount }
          },
          where: {
            id: deliveryPartnerId,
            deletedAt: null,
            status: DeliveryPartnerStatus.ACTIVE,
            walletBalance: isPayout ? { gte: amount } : undefined
          }
        });
        if (balanceUpdate.count !== 1) throw new ConflictException("Partner status or wallet balance changed. Refresh before recording this entry.");
        const created = await tx.deliveryPartnerLedgerEntry.create({
          data: {
            amount,
            deliveryPartnerId,
            description: input.description.trim(),
            reference: input.reference?.trim() || null,
            salaryPeriod: salaryPeriod ?? null,
            type: input.type
          }
        });
        await this.writeAuditLog(tx, context, {
          action: "delivery_partner.ledger.create",
          after: created,
          before: existingPartner,
          entityId: created.id,
          entityType: "DeliveryPartnerLedgerEntry"
        });

        return created;
      })
      .catch((error: unknown) => {
        if (isSalary && isUniqueConstraintError(error)) {
          throw new ConflictException(
            `Salary for ${salaryPeriod} has already been credited.`
          );
        }

        throw error;
      });

    if (this.apiQueueService) {
      const title = isPayout
        ? "Payout recorded"
        : isSalary
          ? "Salary credited"
          : "Delivery earning added";
      const body = `${amount.toFixed(2)} INR ${isPayout ? "paid out" : "added to your wallet"}.`;
      const notification = await this.prisma.notificationLog.create({
        data: {
          channel: "delivery_partner",
          payload: { body, readAt: null, title, type: "WALLET_UPDATE" },
          recipient: deliveryPartnerId,
          status: "PENDING",
          templateKey: "delivery_wallet_update"
        }
      });

      await this.apiQueueService
        .enqueueDeliveryAssignmentNotification({
          assignmentId: null,
          body,
          deliveryPartnerId,
          notificationId: notification.id,
          requestedAt: new Date().toISOString(),
          title,
          version: 1
        })
        .catch(async () => {
          await this.prisma.notificationLog.update({
            data: { status: "QUEUE_FAILED" },
            where: { id: notification.id }
          });
        });
    }

    return serializeLedgerEntry(entry);
  }

  async resolveIncident(incidentId: string, context: AdminActionContext) {
    const existing = await this.prisma.deliveryIncident.findUnique({
      where: { id: incidentId }
    });

    if (!existing) {
      throw new NotFoundException("Delivery incident was not found.");
    }

    await this.assertCanManageAssignment(
      context.auth,
      await this.findAssignmentById(this.prisma, existing.deliveryAssignmentId)
    );

    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryIncident.update({
        data: {
          resolvedAt: new Date(),
          status: DeliveryIncidentStatus.RESOLVED
        },
        where: { id: incidentId }
      });

      await this.writeAuditLog(tx, context, {
        action: "delivery.incident.resolve",
        after: updated,
        before: existing,
        entityId: incidentId,
        entityType: "DeliveryIncident"
      });

      return updated;
    });

    return serializeDeliveryIncident(incident);
  }

  async updateAssignmentStatus(
    deliveryPartnerId: string,
    assignmentId: string,
    input: UpdateDeliveryAssignmentStatusDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const partner = await this.findPartnerById(tx, deliveryPartnerId, {
        requireActive: true
      });
      const assignment = await this.findPartnerAssignment(
        tx,
        deliveryPartnerId,
        assignmentId
      );

      // A retry after a lost response must not repeat inventory or cash writes.
      if (assignment.status === input.status || assignment.statusHistory.some((entry) => entry.status === input.status)) {
        return this.serializeAssignment(assignment);
      }
      if (assignment.order.status !== OrderStatus.ASSIGNED && assignment.order.status !== OrderStatus.OUT_FOR_DELIVERY) {
        throw new ConflictException("This order is no longer available for delivery updates.");
      }

      this.assertAllowedAssignmentTransition(assignment.status, input.status);
      this.assertRequiredStatusPayload(assignment, input);

      // Lock the order before the assignment, matching order cancellation.
      const orderClaim = await tx.order.updateMany({
        data: { status: assignment.order.status },
        where: { id: assignment.orderId, deletedAt: null, status: assignment.order.status }
      });
      if (orderClaim.count !== 1) throw new ConflictException("Order status changed. Refresh this delivery.");

      const assignmentClaim = await tx.deliveryAssignment.updateMany({
        data: this.buildAssignmentStatusUpdateData(input, assignment),
        where: {
          id: assignment.id,
          deliveryPartnerId,
          status: assignment.status
        }
      });
      if (assignmentClaim.count !== 1) {
        const current = await this.findPartnerAssignment(tx, deliveryPartnerId, assignmentId);
        if (current.status === input.status || current.statusHistory.some((entry) => entry.status === input.status)) {
          return this.serializeAssignment(current);
        }
        throw new ConflictException("Delivery status changed. Refresh this delivery.");
      }
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryAssignmentId: assignment.id,
          latitude: input.latitude,
          longitude: input.longitude,
          note: input.note ?? input.failureReason,
          status: input.status
        }
      });
      await this.syncOrderForDeliveryStatus(tx, assignment, input);

      if (input.status === DeliveryStatus.DELIVERED) {
        await this.creditDeliveryCommission(tx, partner, assignment);
      }

      return this.serializeAssignment(await this.findAssignmentById(tx, assignment.id));
    });
  }

  /** Credits commission-based partners for a completed delivery, using their pay at delivery time. */
  private async creditDeliveryCommission(
    tx: Prisma.TransactionClient,
    partner: DeliveryPartnerRecord,
    assignment: DeliveryAssignmentRecord
  ) {
    const amount = calculateDeliveryCommission(partner, assignment.order.grandTotal);

    if (amount <= 0) {
      return;
    }

    await tx.deliveryPartnerLedgerEntry.create({
      data: {
        amount,
        deliveryAssignmentId: assignment.id,
        deliveryPartnerId: partner.id,
        description: `Commission for ${assignment.order.orderNumber}`,
        reference: assignment.order.orderNumber,
        type: DeliveryLedgerEntryType.DELIVERY_EARNING
      }
    });
    await tx.deliveryPartner.updateMany({
      data: {
        totalEarnings: { increment: amount },
        walletBalance: { increment: amount }
      },
      where: { id: partner.id }
    });
  }

  private async buildEarningsSummary(partner: DeliveryPartnerRecord) {
    const ledgerOrder = [{ createdAt: "desc" as const }, { id: "asc" as const }];
    const [ledgerTotals, completedDeliveries, payouts, entries] = await Promise.all([
      this.prisma.deliveryPartnerLedgerEntry.groupBy({
        _sum: { amount: true },
        by: ["type"],
        where: { deliveryPartnerId: partner.id }
      }),
      this.prisma.deliveryAssignment.count({
        where: { deliveryPartnerId: partner.id, status: DeliveryStatus.DELIVERED }
      }),
      this.prisma.deliveryPartnerLedgerEntry.findMany({
        orderBy: ledgerOrder,
        take: 50,
        where: { deliveryPartnerId: partner.id, type: DeliveryLedgerEntryType.PAYOUT }
      }),
      this.prisma.deliveryPartnerLedgerEntry.findMany({
        orderBy: ledgerOrder,
        take: 100,
        where: { deliveryPartnerId: partner.id }
      })
    ]);
    const totalFor = (type: DeliveryLedgerEntryType) =>
      decimalToNumberOrNull(
        ledgerTotals.find((total) => total.type === type)?._sum.amount ?? null
      ) ?? 0;

    return {
      entries: entries.map((entry) => serializeLedgerEntry(entry)),
      payment: serializePaymentStructure(partner),
      payouts: payouts.map((entry) => serializeLedgerEntry(entry)),
      totals: {
        commissionEarnings: totalFor(DeliveryLedgerEntryType.DELIVERY_EARNING),
        completedDeliveries,
        paidOut: totalFor(DeliveryLedgerEntryType.PAYOUT),
        salaryEarnings: totalFor(DeliveryLedgerEntryType.SALARY)
      },
      wallet: serializeWallet(partner)
    };
  }

  /** Limits admin partner reads and writes to partners linked to the admin's warehouses. */
  private async buildPartnerWarehouseFilter(
    auth: AuthJwtPayload,
    warehouseId?: string
  ): Promise<Prisma.DeliveryPartnerWarehouseListRelationFilter | undefined> {
    if (warehouseId) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);

      return { some: { warehouseId } };
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    return scope.allWarehouses
      ? undefined
      : { some: { warehouseId: { in: scope.warehouseIds } } };
  }

  private async buildAssignmentWarehouseScopeFilter(
    auth: AuthJwtPayload,
    warehouseId?: string
  ) {
    if (warehouseId) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);

      return buildDeliveryAssignmentWarehouseFilter(warehouseId);
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    return scope.allWarehouses
      ? undefined
      : buildDeliveryAssignmentWarehouseFilter({ in: scope.warehouseIds });
  }

  private async findAdminPartner(
    client: DeliveryClient,
    id: string,
    auth: AuthJwtPayload
  ) {
    const partner = await client.deliveryPartner.findFirst({
      include: PARTNER_INCLUDE,
      where: stripUndefined({
        deletedAt: null,
        id,
        warehouses: await this.buildPartnerWarehouseFilter(auth)
      })
    });

    if (!partner) {
      throw new NotFoundException("Delivery partner was not found.");
    }

    return partner;
  }

  private async assertCanManageAssignment(
    auth: AuthJwtPayload,
    assignment: { order: { warehouseId: string | null }; pickupWarehouseId: string | null }
  ) {
    const warehouseId = assignment.pickupWarehouseId ?? assignment.order.warehouseId;

    if (warehouseId) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
      return;
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    if (!scope.allWarehouses) {
      throw new ForbiddenException("Admin is not assigned to this warehouse.");
    }
  }

  /**
   * Admins with every warehouse in scope pick one or more warehouses. Warehouse
   * staff add partners to a single warehouse of their own.
   */
  private async resolveNewPartnerWarehouseIds(
    auth: AuthJwtPayload,
    requestedWarehouseIds: string[] | undefined
  ) {
    const scope = await this.warehouseAccessService.getWarehouseScope(auth);
    const warehouseIds = [...new Set(requestedWarehouseIds ?? [])];

    if (scope.allWarehouses) {
      if (warehouseIds.length === 0) {
        throw new BadRequestException(
          "Select at least one warehouse for this delivery partner."
        );
      }

      return warehouseIds;
    }

    if (warehouseIds.length === 0) {
      if (scope.warehouseIds.length === 1) {
        return [scope.warehouseIds[0]!];
      }

      throw scope.warehouseIds.length === 0
        ? new ForbiddenException("Admin is not assigned to any warehouse.")
        : new BadRequestException(
            "Select which of your warehouses this delivery partner works with."
          );
    }

    if (warehouseIds.length > 1) {
      throw new ForbiddenException(
        "Only admins can assign a delivery partner to more than one warehouse."
      );
    }

    if (!scope.warehouseIds.includes(warehouseIds[0]!)) {
      throw new ForbiddenException("Admin is not assigned to this warehouse.");
    }

    return warehouseIds;
  }

  private async resolveReplacementWarehouseIds(
    auth: AuthJwtPayload,
    requestedWarehouseIds: string[]
  ) {
    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    if (!scope.allWarehouses) {
      throw new ForbiddenException(
        "Only admins can change a delivery partner's warehouses."
      );
    }

    const warehouseIds = [...new Set(requestedWarehouseIds)];

    if (warehouseIds.length === 0) {
      throw new BadRequestException(
        "Select at least one warehouse for this delivery partner."
      );
    }

    return warehouseIds;
  }

  private async assertWarehousesExist(client: DeliveryClient, warehouseIds: string[]) {
    const found = await client.warehouse.count({
      where: { deletedAt: null, id: { in: warehouseIds } }
    });

    if (found !== warehouseIds.length) {
      throw new NotFoundException("One or more warehouses were not found.");
    }
  }

  /** Returns the pay columns to write, or undefined when the request leaves pay unchanged. */
  private resolvePaymentChange(
    auth: AuthJwtPayload,
    input: DeliveryPartnerPaymentInput
  ) {
    const isChangingPay = [
      input.paymentType,
      input.commissionType,
      input.commissionValue,
      input.monthlySalary
    ].some((value) => value !== undefined);

    if (!isChangingPay) {
      return undefined;
    }

    if (!auth.permissions?.includes(PermissionCode.DeliveryPayoutsManage)) {
      throw new ForbiddenException(
        "Changing delivery partner pay requires the delivery.payouts.manage permission."
      );
    }

    return normalizeDeliveryPartnerPayment(input);
  }

  private async findPartnerById(
    client: DeliveryClient,
    id: string,
    options: {
      requireActive: boolean;
    }
  ) {
    const partner = await client.deliveryPartner.findFirst({
      include: PARTNER_INCLUDE,
      where: {
        deletedAt: null,
        id
      }
    });

    if (!partner) {
      throw new NotFoundException("Delivery partner was not found.");
    }

    if (options.requireActive && partner.status !== DeliveryPartnerStatus.ACTIVE) {
      throw new UnauthorizedException("Delivery partner is not active.");
    }

    return partner;
  }

  private async findActiveWarehouse(client: DeliveryClient, id: string) {
    const warehouse = await client.warehouse.findFirst({
      where: {
        deletedAt: null,
        id,
        status: WarehouseStatus.ACTIVE
      }
    });

    if (!warehouse) {
      throw new NotFoundException("Pickup warehouse was not found.");
    }

    return warehouse;
  }

  private async findAssignmentById(client: DeliveryClient, id: string) {
    const assignment = await client.deliveryAssignment.findFirst({
      include: ASSIGNMENT_INCLUDE,
      where: {
        id
      }
    });

    if (!assignment) {
      throw new NotFoundException("Delivery assignment was not found.");
    }

    return assignment;
  }

  private async findPartnerAssignment(
    client: DeliveryClient,
    deliveryPartnerId: string,
    assignmentId: string
  ) {
    const assignment = await client.deliveryAssignment.findFirst({
      include: ASSIGNMENT_INCLUDE,
      where: {
        deliveryPartnerId,
        id: assignmentId
      }
    });

    if (!assignment) {
      throw new NotFoundException("Delivery assignment was not found.");
    }

    return assignment;
  }

  private assertAllowedAssignmentTransition(
    currentStatus: DeliveryStatus,
    nextStatus: DeliveryStatus
  ) {
    const allowedStatuses = ASSIGNMENT_STATUS_TRANSITIONS[currentStatus];

    if (!allowedStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Delivery cannot move from ${currentStatus} to ${nextStatus}.`
      );
    }
  }

  private buildAssignmentStatusUpdateData(
    input: UpdateDeliveryAssignmentStatusDto,
    assignment: DeliveryAssignmentRecord
  ) {
    const data: Prisma.DeliveryAssignmentUpdateManyMutationInput = {
      status: input.status
    };

    if (input.status === DeliveryStatus.PICKED_UP) {
      data.pickedUpAt = new Date();
    }
    if (input.status === DeliveryStatus.DELIVERED) {
      data.deliveredAt = new Date();
      data.proofOfDeliveryKey = input.proofOfDeliveryKey;
      data.proofOfDeliveryUrl = input.proofOfDeliveryUrl;
      data.receiverName = trimToUndefined(input.receiverName);
      if (this.assignmentRequiresCodCollection(assignment)) {
        data.cashCollectedAmount = input.cashCollectedAmount;
        data.cashCollectedAt = new Date();
        data.cashSettlementStatus = CashCollectionStatus.COLLECTED;
      } else {
        data.cashSettlementStatus = CashCollectionStatus.NOT_REQUIRED;
      }
    }
    if (input.status === DeliveryStatus.FAILED || input.status === DeliveryStatus.CANCELLED) {
      data.failureReason = trimToUndefined(input.failureReason ?? input.note);
    }

    return data;
  }

  private assertRequiredStatusPayload(
    assignment: DeliveryAssignmentRecord,
    input: UpdateDeliveryAssignmentStatusDto
  ) {
    if (input.status === DeliveryStatus.DELIVERED) {
      if (
        !trimToUndefined(input.proofOfDeliveryKey) ||
        !trimToUndefined(input.proofOfDeliveryUrl) ||
        !trimToUndefined(input.receiverName)
      ) {
        throw new BadRequestException(
          "Proof of delivery and receiver name are required before marking delivered."
        );
      }

      if (this.assignmentRequiresCodCollection(assignment)) {
        const collectedAmount = input.cashCollectedAmount;
        const expectedAmount = decimalToNumber(assignment.order.grandTotal);

        if (typeof collectedAmount !== "number" || !Number.isFinite(collectedAmount) || collectedAmount < expectedAmount || collectedAmount > 9_999_999_999.99 || Number(collectedAmount.toFixed(2)) !== collectedAmount) {
          throw new BadRequestException(
            "COD deliveries require the collected cash amount before marking delivered."
          );
        }
      }
    }

    if (
      (input.status === DeliveryStatus.FAILED ||
        input.status === DeliveryStatus.CANCELLED) &&
      !trimToUndefined(input.failureReason ?? input.note)
    ) {
      throw new BadRequestException(
        input.status === DeliveryStatus.CANCELLED
          ? "A cancellation reason is required before cancelling."
          : "A failure reason is required before marking failed."
      );
    }
  }

  private assignmentRequiresCodCollection(assignment: DeliveryAssignmentRecord) {
    return assignment.order.payments[0]?.method === PaymentMethod.COD;
  }

  private async syncOrderForDeliveryStatus(
    tx: Prisma.TransactionClient,
    assignment: DeliveryAssignmentRecord,
    input: UpdateDeliveryAssignmentStatusDto
  ) {
    if (input.status === DeliveryStatus.OUT_FOR_DELIVERY) {
      await tx.order.update({
        data: {
          status: OrderStatus.OUT_FOR_DELIVERY
        },
        where: {
          id: assignment.orderId
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          note: input.note,
          orderId: assignment.orderId,
          status: OrderStatus.OUT_FOR_DELIVERY
        }
      });
    }

    if (input.status === DeliveryStatus.DELIVERED) {
      await this.clearReservedInventoryForDeliveredOrder(tx, assignment);
      const collectedCod = this.assignmentRequiresCodCollection(assignment);
      if (collectedCod) {
        await tx.payment.updateMany({
          data: { paidAt: new Date(), status: PaymentStatus.PAID },
          where: { id: assignment.order.payments[0]!.id, orderId: assignment.orderId, method: PaymentMethod.COD }
        });
      }
      await tx.order.update({
        data: {
          status: OrderStatus.DELIVERED,
          ...(collectedCod ? { paymentStatus: PaymentStatus.PAID } : {})
        },
        where: {
          id: assignment.orderId
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          note: input.note,
          orderId: assignment.orderId,
          status: OrderStatus.DELIVERED
        }
      });
    }

    if (input.status === DeliveryStatus.FAILED || input.status === DeliveryStatus.CANCELLED) {
      // An unsuccessful delivery attempt does not cancel the customer's order
      // or release its reserved stock. Keep it ready for dispatch again.
      await tx.order.update({ data: { status: OrderStatus.PACKED }, where: { id: assignment.orderId } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: assignment.orderId,
          status: OrderStatus.PACKED,
          note: `Delivery ${input.status.toLowerCase()}; awaiting reassignment. ${trimToUndefined(input.failureReason ?? input.note) ?? ""}`.trim()
        }
      });
    }
  }

  private async clearReservedInventoryForDeliveredOrder(
    tx: Prisma.TransactionClient,
    assignment: DeliveryAssignmentRecord
  ) {
    for (const item of assignment.order.items) {
      if (item.warehouseId === null) {
        continue;
      }

      if (!item.productId) {
        throw new BadRequestException(
          "Custom quote items are not linked to reserved inventory."
        );
      }

      const stockUpdate = await tx.inventoryStock.updateMany({
        data: {
          reservedQuantity: {
            decrement: item.quantity
          }
        },
        where: {
          productId: item.productId,
          reservedQuantity: {
            gte: item.quantity
          },
          variantId: item.variantId,
          warehouseId: item.warehouseId
        }
      });

      if (stockUpdate.count !== 1) {
        throw new BadRequestException("Reserved inventory is no longer consistent.");
      }
    }
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    context: AdminActionContext,
    input: {
      action: string;
      after?: unknown;
      before?: unknown;
      entityId?: string;
      entityType: string;
    }
  ) {
    await tx.adminAuditLog.create({
      data: {
        action: input.action,
        adminUserId: context.auth.sub,
        after: input.after === undefined ? undefined : toJsonValue(input.after),
        before: input.before === undefined ? undefined : toJsonValue(input.before),
        entityId: input.entityId,
        entityType: input.entityType,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }
    });
  }

  private serializePartner(partner: DeliveryPartnerRecord) {
    return {
      createdAt: partner.createdAt,
      documents: partner.documents.map((document) => ({
        createdAt: document.createdAt,
        fileKey: document.fileKey,
        fileUrl: document.fileUrl,
        id: document.id,
        title: document.title,
        type: document.type,
        verifiedAt: document.verifiedAt
      })),
      email: partner.email,
      fullName: partner.fullName,
      id: partner.id,
      isOnline: partner.isOnline,
      lastKnownLocation:
        partner.lastLatitude === null || partner.lastLongitude === null
          ? null
          : {
              latitude: decimalToNumber(partner.lastLatitude),
              longitude: decimalToNumber(partner.lastLongitude),
              updatedAt: partner.lastLocationAt
            },
      lastSeenAt: partner.lastSeenAt,
      mobileNumber: partner.mobileNumber,
      payment: serializePaymentStructure(partner),
      status: partner.status,
      statusReason: partner.statusReason,
      updatedAt: partner.updatedAt,
      vehicleNumber: partner.vehicleNumber,
      wallet: serializeWallet(partner),
      // Warehouse edits keep existing links, so the link's createdAt is when the partner joined that warehouse.
      warehouses: partner.warehouses.map(({ createdAt, warehouse }) => ({
        address: warehouse.address,
        associatedAt: createdAt,
        city: warehouse.city,
        code: warehouse.code,
        contactNumber: warehouse.contactNumber,
        contactPerson: warehouse.contactPerson,
        id: warehouse.id,
        name: warehouse.name,
        pincode: warehouse.pincode,
        state: warehouse.state
      }))
    };
  }

  private serializeDevice(device: {
    id: string;
    deliveryPartnerId: string;
    platform: string;
    pushToken: string;
    notificationsEnabled: boolean;
    lastSeenAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      createdAt: device.createdAt,
      deliveryPartnerId: device.deliveryPartnerId,
      id: device.id,
      lastSeenAt: device.lastSeenAt,
      notificationsEnabled: device.notificationsEnabled,
      platform: device.platform,
      pushToken: device.pushToken,
      revokedAt: device.revokedAt,
      updatedAt: device.updatedAt
    };
  }

  private serializeAssignment(assignment: DeliveryAssignmentRecord) {
    const latestPayment = assignment.order.payments[0] ?? null;

    return {
      assignedAt: assignment.assignedAt,
      createdAt: assignment.createdAt,
      customer: {
        businessName: assignment.order.user.businessName,
        fullName: [assignment.order.user.firstName, assignment.order.user.lastName]
          .filter(Boolean)
          .join(" "),
        id: assignment.order.user.id,
        mobileNumber: assignment.order.user.mobileNumber
      },
      deliveredAt: assignment.deliveredAt,
      deliveryPartner: assignment.deliveryPartner
        ? this.serializePartner(assignment.deliveryPartner)
        : null,
      deliveryPartnerId: assignment.deliveryPartnerId,
      earning: assignment.earningEntry
        ? decimalToNumber(assignment.earningEntry.amount)
        : null,
      failureReason: assignment.failureReason,
      id: assignment.id,
      items: assignment.order.items.map((item) => ({
        id: item.id,
        name: item.name,
        productId: item.productId,
        quantity: item.quantity,
        sku: item.sku,
        variantId: item.variantId,
        warehouseId: item.warehouseId
      })),
      orderId: assignment.orderId,
      orderNotes: assignment.order.notes,
      orderNumber: assignment.order.orderNumber,
      payment: {
        cashCollectedAmount: decimalToNumberOrNull(assignment.cashCollectedAmount),
        cashCollectedAt: assignment.cashCollectedAt,
        cashSettlementStatus: assignment.cashSettlementStatus,
        codAmount:
          latestPayment?.method === PaymentMethod.COD
            ? decimalToNumber(assignment.order.grandTotal)
            : 0,
        method: latestPayment?.method ?? null,
        status: latestPayment?.status ?? null
      },
      pickedUpAt: assignment.pickedUpAt,
      pickupWarehouse: assignment.pickupWarehouse
        ? {
            address: assignment.pickupWarehouse.address,
            city: assignment.pickupWarehouse.city,
            code: assignment.pickupWarehouse.code,
            contactNumber: assignment.pickupWarehouse.contactNumber,
            contactPerson: assignment.pickupWarehouse.contactPerson,
            id: assignment.pickupWarehouse.id,
            latitude: decimalToNumberOrNull(assignment.pickupWarehouse.latitude),
            longitude: decimalToNumberOrNull(assignment.pickupWarehouse.longitude),
            name: assignment.pickupWarehouse.name,
            pincode: assignment.pickupWarehouse.pincode,
            state: assignment.pickupWarehouse.state
          }
        : null,
      pickupWarehouseId: assignment.pickupWarehouseId,
      proofOfDeliveryKey: assignment.proofOfDeliveryKey,
      proofOfDeliveryUrl: assignment.proofOfDeliveryUrl,
      receiverName: assignment.receiverName,
      shippingAddress: assignment.order.shippingAddress
        ? {
            city: assignment.order.shippingAddress.city,
            country: assignment.order.shippingAddress.country,
            fullName: assignment.order.shippingAddress.fullName,
            id: assignment.order.shippingAddress.id,
            landmark: assignment.order.shippingAddress.landmark,
            latitude: decimalToNumberOrNull(assignment.order.shippingAddress.latitude),
            line1: assignment.order.shippingAddress.line1,
            line2: assignment.order.shippingAddress.line2,
            longitude: decimalToNumberOrNull(
              assignment.order.shippingAddress.longitude
            ),
            mobileNumber: assignment.order.shippingAddress.mobileNumber,
            pincode: assignment.order.shippingAddress.pincode,
            state: assignment.order.shippingAddress.state
          }
        : null,
      status: assignment.status,
      statusHistory: assignment.statusHistory.map((entry) => ({
        createdAt: entry.createdAt,
        id: entry.id,
        latitude: decimalToNumberOrNull(entry.latitude),
        longitude: decimalToNumberOrNull(entry.longitude),
        note: entry.note,
        status: entry.status
      })),
      totals: {
        discountTotal: decimalToNumber(assignment.order.discountTotal),
        grandTotal: decimalToNumber(assignment.order.grandTotal),
        shippingTotal: decimalToNumber(assignment.order.shippingTotal),
        subtotal: decimalToNumber(assignment.order.subtotal),
        taxTotal: decimalToNumber(assignment.order.taxTotal)
      },
      updatedAt: assignment.updatedAt
    };
  }
}

/**
 * Assignments that belong to a warehouse: picked up there, or (when no pickup warehouse is linked)
 * for an order fulfilled from it. Shared by the assignment list and the warehouse partner filter.
 */
export function buildDeliveryAssignmentWarehouseFilter(
  warehouseId: string | { in: string[] }
): Prisma.DeliveryAssignmentWhereInput {
  return {
    OR: [
      { pickupWarehouseId: warehouseId },
      { order: { warehouseId }, pickupWarehouseId: null }
    ]
  };
}

/**
 * Commission for one delivery, rounded to the nearest paisa. Percentage
 * commission applies to the order grand total. Salary-based partners earn none.
 */
export function calculateDeliveryCommission(
  structure: Pick<
    DeliveryPartnerPaymentStructure,
    "commissionType" | "commissionValue" | "paymentType"
  >,
  orderTotal: DecimalValue
) {
  if (
    structure.paymentType !== DeliveryPartnerPaymentType.COMMISSION ||
    structure.commissionType === null ||
    structure.commissionValue === null
  ) {
    return 0;
  }

  // Integer paise and hundredths of a percent avoid floating point drift.
  const valueInHundredths = Math.round(decimalToNumber(structure.commissionValue) * 100);

  if (structure.commissionType === DeliveryCommissionType.FIXED) {
    return valueInHundredths / 100;
  }

  const orderTotalInPaise = Math.round(decimalToNumber(orderTotal) * 100);

  return Math.round((orderTotalInPaise * valueInHundredths) / 10_000) / 100;
}

/** Validates a requested pay structure and clears the columns the other type uses. */
export function normalizeDeliveryPartnerPayment(input: DeliveryPartnerPaymentInput) {
  if (input.paymentType === DeliveryPartnerPaymentType.SALARY) {
    if (input.monthlySalary === undefined) {
      throw new BadRequestException(
        "Monthly salary is required for salary-based delivery partners."
      );
    }

    return {
      commissionType: null,
      commissionValue: null,
      monthlySalary: input.monthlySalary,
      paymentType: DeliveryPartnerPaymentType.SALARY
    };
  }

  if (input.paymentType === DeliveryPartnerPaymentType.COMMISSION) {
    if (!input.commissionType || input.commissionValue === undefined) {
      throw new BadRequestException(
        "Commission type and value are required for commission-based delivery partners."
      );
    }

    if (
      input.commissionType === DeliveryCommissionType.PERCENTAGE &&
      input.commissionValue > 100
    ) {
      throw new BadRequestException("Percentage commission cannot exceed 100%.");
    }

    return {
      commissionType: input.commissionType,
      commissionValue: input.commissionValue,
      monthlySalary: null,
      paymentType: DeliveryPartnerPaymentType.COMMISSION
    };
  }

  throw new BadRequestException(
    "Choose whether the delivery partner is salary-based or commission-based."
  );
}

function serializePaymentStructure(partner: DeliveryPartnerPaymentStructure) {
  return {
    commissionType: partner.commissionType,
    commissionValue: decimalToNumberOrNull(partner.commissionValue),
    monthlySalary: decimalToNumberOrNull(partner.monthlySalary),
    paymentType: partner.paymentType
  };
}

function serializeWallet(partner: {
  totalEarnings: DecimalValue;
  walletBalance: DecimalValue;
}) {
  return {
    balance: decimalToNumber(partner.walletBalance),
    currency: "INR" as const,
    totalEarnings: decimalToNumber(partner.totalEarnings)
  };
}

function serializeLedgerEntry(entry: DeliveryLedgerEntryRecord) {
  return {
    amount: decimalToNumber(entry.amount),
    createdAt: entry.createdAt,
    deliveryAssignmentId: entry.deliveryAssignmentId ?? null,
    description: entry.description,
    id: entry.id,
    reference: entry.reference,
    salaryPeriod: entry.salaryPeriod ?? null,
    type: entry.type
  };
}

function normalizeOptionalEmail(value: string | null | undefined) {
  return value === undefined || value === null
    ? value
    : value.trim().toLowerCase() || null;
}

function normalizeOptionalVehicle(value: string | null | undefined) {
  return value === undefined || value === null
    ? value
    : value.trim().toUpperCase() || null;
}

function throwIfDuplicatePartner(error: unknown) {
  if (isUniqueConstraintError(error)) {
    throw new ConflictException(
      "A delivery partner with this mobile number or email already exists."
    );
  }
}

function buildAssignmentFilters(
  query: DeliveryAssignmentListQueryDto
): Prisma.DeliveryAssignmentWhereInput {
  const search = query.search?.trim();

  return {
    assignedAt:
      query.dateFrom || query.dateTo
        ? {
            gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
            lte: query.dateTo ? new Date(query.dateTo) : undefined
          }
        : undefined,
    OR: search
      ? [
          {
            order: {
              orderNumber: { contains: search, mode: "insensitive" }
            }
          },
          {
            order: {
              user: { firstName: { contains: search, mode: "insensitive" } }
            }
          },
          {
            order: {
              user: { lastName: { contains: search, mode: "insensitive" } }
            }
          },
          {
            order: {
              user: { businessName: { contains: search, mode: "insensitive" } }
            }
          },
          {
            order: {
              user: { mobileNumber: { contains: search } }
            }
          }
        ]
      : undefined
  };
}

function assignmentOrderBy(
  sort: DeliveryAssignmentListQueryDto["sort"]
): Prisma.DeliveryAssignmentOrderByWithRelationInput[] {
  return sort === "OLDEST"
    ? [{ assignedAt: "asc" }, { id: "asc" }]
    : [{ assignedAt: "desc" }, { id: "asc" }];
}

function jsonRecord(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function serializeDeliveryNotification(notification: {
  id: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  const payload = jsonRecord(notification.payload);

  return {
    assignmentId:
      typeof payload.assignmentId === "string" ? payload.assignmentId : null,
    body: typeof payload.body === "string" ? payload.body : "Delivery update",
    createdAt: notification.createdAt,
    id: notification.id,
    isRead: typeof payload.readAt === "string",
    title:
      typeof payload.title === "string" ? payload.title : "Delivery notification",
    type: typeof payload.type === "string" ? payload.type : "DELIVERY_UPDATE"
  };
}

function serializeDeliveryIncident(incident: {
  id: string;
  deliveryAssignmentId: string;
  type: DeliveryIncidentType;
  status: DeliveryIncidentStatus;
  note: string | null;
  photoUrl: string | null;
  createdAt: Date;
}) {
  return {
    createdAt: incident.createdAt,
    deliveryAssignmentId: incident.deliveryAssignmentId,
    id: incident.id,
    note: incident.note,
    photoUrl: incident.photoUrl,
    status: incident.status,
    type: incident.type
  };
}

function decimalToNumber(value: DecimalValue) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
}

function decimalToNumberOrNull(value: DecimalValue | null) {
  return value === null ? null : decimalToNumber(value);
}

function paginated<T>(items: T[], total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit,
      page,
      total,
      totalPages
    }
  };
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function trimToUndefined(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
