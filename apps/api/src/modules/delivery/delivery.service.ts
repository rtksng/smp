import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import {
  CashCollectionStatus,
  DeliveryIncidentStatus,
  DeliveryIncidentType,
  DeliveryLedgerEntryType,
  DeliveryPartnerStatus,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  WarehouseStatus
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { ApiQueueService } from "../../queues/api-queue.service";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type {
  AddDeliveryPartnerDocumentDto,
  AdminDeliveryAssignmentListQueryDto,
  AssignDeliveryDto,
  CreateDeliveryLedgerEntryDto,
  CreateDeliveryIncidentDto,
  DeliveryAssignmentListQueryDto,
  DeliveryPartnerDeviceDto,
  DeliveryPartnerLocationDto,
  DeliveryPartnerListQueryDto,
  DeliveryPartnerOnlineStatusDto,
  UpdateCashSettlementDto,
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
  pickupWarehouse: true,
  statusHistory: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.DeliveryAssignmentInclude;

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

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly apiQueueService?: ApiQueueService,
    @Optional() private readonly configService?: ConfigService
  ) {}

  async listAdminDeliveryPartners(query: DeliveryPartnerListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.DeliveryPartnerWhereInput = {
      deletedAt: null,
      status: query.status
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

  async getAdminDeliveryPartner(id: string) {
    const partner = await this.findPartnerById(this.prisma, id, {
      requireActive: false
    });

    return this.serializePartner(partner);
  }

  async approveDeliveryPartner(id: string, context: AdminActionContext) {
    const existingPartner = await this.findPartnerById(this.prisma, id, {
      requireActive: false
    });
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
    const existingPartner = await this.findPartnerById(this.prisma, id, {
      requireActive: false
    });
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

  async listAdminDeliveryAssignments(query: AdminDeliveryAssignmentListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const warehouseFilter: Prisma.DeliveryAssignmentWhereInput | undefined =
      query.warehouseId
        ? {
            OR: [
              {
                pickupWarehouseId: query.warehouseId
              },
              {
                order: {
                  warehouseId: query.warehouseId
                },
                pickupWarehouseId: null
              }
            ]
          }
        : undefined;
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
        where: { deliveryPartnerId }
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
      ledgerEntries: ledgerEntries.map((entry) => ({
        amount: decimalToNumber(entry.amount),
        createdAt: entry.createdAt,
        description: entry.description,
        id: entry.id,
        reference: entry.reference,
        type: entry.type
      })),
      pendingCount,
      settledAmount,
      submittedAmount,
      wallet: {
        balance: decimalToNumber(partner.walletBalance),
        currency: "INR" as const,
        totalEarnings: decimalToNumber(partner.totalEarnings)
      }
    };
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
    const existingPartner = await this.findPartnerById(
      this.prisma,
      deliveryPartnerId,
      { requireActive: true }
    );
    const amount = input.amount;

    if (
      input.type === DeliveryLedgerEntryType.PAYOUT &&
      decimalToNumber(existingPartner.walletBalance) < amount
    ) {
      throw new BadRequestException("Payout exceeds the partner wallet balance.");
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const balanceUpdate = await tx.deliveryPartner.updateMany({
        data: {
          totalEarnings:
            input.type === DeliveryLedgerEntryType.DELIVERY_EARNING
              ? { increment: amount }
              : undefined,
          walletBalance:
            input.type === DeliveryLedgerEntryType.PAYOUT
              ? { decrement: amount }
              : { increment: amount }
        },
        where: {
          id: deliveryPartnerId,
          deletedAt: null,
          status: DeliveryPartnerStatus.ACTIVE,
          walletBalance: input.type === DeliveryLedgerEntryType.PAYOUT ? { gte: amount } : undefined
        }
      });
      if (balanceUpdate.count !== 1) throw new ConflictException("Partner status or wallet balance changed. Refresh before recording this entry.");
      const created = await tx.deliveryPartnerLedgerEntry.create({
        data: {
          amount,
          deliveryPartnerId,
          description: input.description.trim(),
          reference: input.reference?.trim() || null,
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
    });

    if (this.apiQueueService) {
      const isPayout = input.type === DeliveryLedgerEntryType.PAYOUT;
      const title = isPayout ? "Payout recorded" : "Delivery earning added";
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

    return {
      amount: decimalToNumber(entry.amount),
      createdAt: entry.createdAt,
      description: entry.description,
      id: entry.id,
      reference: entry.reference,
      type: entry.type
    };
  }

  async resolveIncident(incidentId: string, context: AdminActionContext) {
    const existing = await this.prisma.deliveryIncident.findUnique({
      where: { id: incidentId }
    });

    if (!existing) {
      throw new NotFoundException("Delivery incident was not found.");
    }

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
      await this.findPartnerById(tx, deliveryPartnerId, {
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

      return this.serializeAssignment(await this.findAssignmentById(tx, assignment.id));
    });
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
      status: partner.status,
      statusReason: partner.statusReason,
      updatedAt: partner.updatedAt,
      vehicleNumber: partner.vehicleNumber,
      wallet: {
        balance: decimalToNumber(partner.walletBalance),
        currency: "INR" as const,
        totalEarnings: decimalToNumber(partner.totalEarnings)
      }
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
