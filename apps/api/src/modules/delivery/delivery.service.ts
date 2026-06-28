import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  CashCollectionStatus,
  DeliveryPartnerStatus,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  WarehouseStatus
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type {
  AddDeliveryPartnerDocumentDto,
  AdminDeliveryAssignmentListQueryDto,
  AssignDeliveryDto,
  DeliveryAssignmentListQueryDto,
  DeliveryPartnerDeviceDto,
  DeliveryPartnerLocationDto,
  DeliveryPartnerListQueryDto,
  DeliveryPartnerOnlineStatusDto,
  UpdateDeliveryAssignmentStatusDto
} from "./dto/delivery.dto";

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
      | "deliveryPartner"
      | "deliveryPartnerDevice"
      | "deliveryPartnerDocument"
      | "deliveryStatusHistory"
      | "inventoryStock"
      | "order"
      | "orderStatusHistory"
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
    private readonly warehouseAccessService: WarehouseAccessService
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
          status: DeliveryPartnerStatus.ACTIVE
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

  async rejectDeliveryPartner(id: string, context: AdminActionContext) {
    const existingPartner = await this.findPartnerById(this.prisma, id, {
      requireActive: false
    });
    const partner = await this.prisma.$transaction(async (tx) => {
      const updatedPartner = await tx.deliveryPartner.update({
        data: {
          isOnline: false,
          status: DeliveryPartnerStatus.INACTIVE
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
    return this.prisma.$transaction(async (tx) => {
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

      return this.serializeAssignment(await this.findAssignmentById(tx, assignment.id));
    });
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
    const where: Prisma.DeliveryAssignmentWhereInput = {
      ...warehouseFilter,
      deliveryPartnerId: query.deliveryPartnerId,
      status: query.status
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
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
      deliveryPartnerId,
      status: query.status
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ assignedAt: "desc" }, { id: "asc" }],
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

      this.assertAllowedAssignmentTransition(assignment.status, input.status);
      this.assertRequiredStatusPayload(assignment, input);

      await tx.deliveryAssignment.update({
        data: this.buildAssignmentStatusUpdateData(input, assignment),
        where: {
          id: assignment.id
        }
      });
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
    const data: Prisma.DeliveryAssignmentUpdateInput = {
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
    if (input.status === DeliveryStatus.FAILED) {
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

        if (collectedAmount === undefined || collectedAmount < expectedAmount) {
          throw new BadRequestException(
            "COD deliveries require the collected cash amount before marking delivered."
          );
        }
      }
    }

    if (
      input.status === DeliveryStatus.FAILED &&
      !trimToUndefined(input.failureReason ?? input.note)
    ) {
      throw new BadRequestException(
        "A failure reason is required before marking failed."
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
      await tx.order.update({
        data: {
          status: OrderStatus.DELIVERED
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
