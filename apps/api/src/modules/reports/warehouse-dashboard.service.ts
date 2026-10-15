import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  DeliveryPartnerStatus,
  DeliveryStatus,
  OrderStatus
} from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import {
  DISPATCH_ORDER_INCLUDE,
  DISPATCH_ORDER_ORDER_BY,
  READY_FOR_DISPATCH_STATUSES,
  serializeDispatchOrder
} from "../delivery/dispatch-queue";
import {
  ACTIVE_DELIVERY_STATUSES,
  buildDeliveryAssignmentWarehouseFilter
} from "../delivery/delivery.service";
import {
  loadInventorySummary,
  type InventoryWarehouseFilter
} from "../inventory/inventory-summary";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type { WarehouseDashboardQueryDto } from "./dto/warehouse-dashboard.dto";
import {
  buildDashboardSeriesWindow,
  formatDateOnly,
  getUtcDayRange
} from "./reports.service";

const NEAR_EXPIRY_DAYS = 30;
const QUEUE_SIZE = 6;
const RIDER_LIST_SIZE = 8;
const AWAITING_PICKUP_STATUSES = [DeliveryStatus.ASSIGNED, DeliveryStatus.ACCEPTED];
const IN_TRANSIT_STATUSES = [DeliveryStatus.PICKED_UP, DeliveryStatus.OUT_FOR_DELIVERY];

/**
 * Day-to-day operations for the warehouses an admin runs: stock position, the
 * dispatch queue, riders, and how reliably orders reach customers. Every figure is
 * limited to the admin's warehouses, or to the one warehouse they pick.
 */
@Injectable()
export class WarehouseDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService
  ) {}

  async getDashboard(query: WarehouseDashboardQueryDto, auth: AuthJwtPayload) {
    const now = new Date();
    const scope = await this.warehouseAccessService.getWarehouseScope(auth);
    const scopeFilter = scope.allWarehouses ? undefined : { in: scope.warehouseIds };

    if (query.warehouseId) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, query.warehouseId);
    }

    const warehouseFilter: InventoryWarehouseFilter = query.warehouseId ?? scopeFilter;
    const window = buildDashboardSeriesWindow(query.dateFrom, query.dateTo, now);
    const today = getUtcDayRange(now);
    const assignmentsHere: Prisma.DeliveryAssignmentWhereInput = warehouseFilter
      ? buildDeliveryAssignmentWarehouseFilter(warehouseFilter)
      : {};
    const readyOrders: Prisma.OrderWhereInput = {
      deletedAt: null,
      status: { in: READY_FOR_DISPATCH_STATUSES },
      ...(warehouseFilter ? { warehouseId: warehouseFilter } : {})
    };
    const ridersHere: Prisma.DeliveryPartnerWhereInput = {
      deletedAt: null,
      status: DeliveryPartnerStatus.ACTIVE,
      ...(warehouseFilter ? { warehouses: { some: { warehouseId: warehouseFilter } } } : {})
    };
    const activeAssignmentsHere: Prisma.DeliveryAssignmentWhereInput = {
      ...assignmentsHere,
      status: { in: ACTIVE_DELIVERY_STATUSES }
    };

    const [
      warehouseOptions,
      stock,
      readyToDispatch,
      oldestReadyOrder,
      awaitingPickup,
      inTransit,
      deliveredToday,
      failedToday,
      assignedRiders,
      onlineRiders,
      ridersOnDelivery,
      availableRiders,
      ordersByStatus,
      attemptsByStatus,
      dispatchQueue,
      lowStockLines,
      activeDeliveries,
      riders
    ] = await Promise.all([
      this.prisma.warehouse.findMany({
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { city: true, code: true, id: true, name: true, state: true, status: true },
        where: { deletedAt: null, ...(scopeFilter ? { id: scopeFilter } : {}) }
      }),
      loadInventorySummary(this.prisma, warehouseFilter, NEAR_EXPIRY_DAYS, now),
      this.prisma.order.count({ where: readyOrders }),
      this.prisma.order.findFirst({
        orderBy: DISPATCH_ORDER_ORDER_BY,
        select: { createdAt: true, placedAt: true },
        where: readyOrders
      }),
      this.prisma.deliveryAssignment.count({
        where: { ...assignmentsHere, status: { in: AWAITING_PICKUP_STATUSES } }
      }),
      this.prisma.deliveryAssignment.count({
        where: { ...assignmentsHere, status: { in: IN_TRANSIT_STATUSES } }
      }),
      this.prisma.deliveryAssignment.count({
        where: { ...assignmentsHere, deliveredAt: today, status: DeliveryStatus.DELIVERED }
      }),
      this.prisma.deliveryAssignment.count({
        where: {
          ...assignmentsHere,
          statusHistory: { some: { createdAt: today, status: DeliveryStatus.FAILED } }
        }
      }),
      this.prisma.deliveryPartner.count({ where: ridersHere }),
      this.prisma.deliveryPartner.count({ where: { ...ridersHere, isOnline: true } }),
      this.prisma.deliveryPartner.count({
        where: { ...ridersHere, assignments: { some: activeAssignmentsHere } }
      }),
      // A rider busy with any warehouse's delivery is not free for this one.
      this.prisma.deliveryPartner.count({
        where: {
          ...ridersHere,
          assignments: { none: { status: { in: ACTIVE_DELIVERY_STATUSES } } },
          isOnline: true
        }
      }),
      this.prisma.order.groupBy({
        _count: { _all: true },
        by: ["status"],
        where: {
          createdAt: window.dateRange,
          deletedAt: null,
          ...(warehouseFilter ? { warehouseId: warehouseFilter } : {})
        }
      }),
      this.prisma.deliveryAssignment.groupBy({
        _count: { _all: true },
        by: ["status"],
        where: {
          ...assignmentsHere,
          assignedAt: window.dateRange,
          status: { in: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED] }
        }
      }),
      this.prisma.order.findMany({
        include: DISPATCH_ORDER_INCLUDE,
        orderBy: DISPATCH_ORDER_ORDER_BY,
        take: QUEUE_SIZE,
        where: readyOrders
      }),
      this.prisma.inventoryStock.findMany({
        include: {
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true } },
          warehouse: { select: { name: true } }
        },
        orderBy: [{ availableQuantity: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
        take: QUEUE_SIZE,
        where: {
          availableQuantity: { lte: this.prisma.inventoryStock.fields.reorderLevel },
          ...(warehouseFilter ? { warehouseId: warehouseFilter } : {})
        }
      }),
      this.prisma.deliveryAssignment.findMany({
        include: {
          deliveryPartner: { select: { fullName: true, mobileNumber: true } },
          order: { select: { orderNumber: true, warehouse: { select: { name: true } } } },
          pickupWarehouse: { select: { name: true } }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: QUEUE_SIZE,
        where: activeAssignmentsHere
      }),
      this.prisma.deliveryPartner.findMany({
        orderBy: [
          { isOnline: "desc" },
          { lastSeenAt: { nulls: "last", sort: "desc" } },
          { fullName: "asc" }
        ],
        select: {
          _count: {
            select: { assignments: { where: { status: { in: ACTIVE_DELIVERY_STATUSES } } } }
          },
          fullName: true,
          id: true,
          isOnline: true,
          lastSeenAt: true,
          mobileNumber: true,
          vehicleNumber: true
        },
        take: RIDER_LIST_SIZE,
        where: ridersHere
      })
    ]);

    const orderCount = (status: OrderStatus) =>
      ordersByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const attemptCount = (status: DeliveryStatus) =>
      attemptsByStatus.find((row) => row.status === status)?._count._all ?? 0;
    const ordersPlaced = ordersByStatus.reduce((total, row) => total + row._count._all, 0);
    // Returned orders reached the customer first, so they count as delivered here.
    const delivered = orderCount(OrderStatus.DELIVERED) + orderCount(OrderStatus.RETURNED);
    const cancelled = orderCount(OrderStatus.CANCELLED);
    const successfulDeliveries = attemptCount(DeliveryStatus.DELIVERED);
    const deliveryAttempts = successfulDeliveries + attemptCount(DeliveryStatus.FAILED);
    const warehouse =
      warehouseOptions.find((option) => option.id === query.warehouseId) ??
      (warehouseOptions.length === 1 ? warehouseOptions[0]! : null);

    return {
      dispatch: {
        awaitingPickup,
        deliveredToday,
        failedToday,
        inTransit,
        oldestReadySince: oldestReadyOrder?.placedAt ?? oldestReadyOrder?.createdAt ?? null,
        readyToDispatch
      },
      filters: {
        dateFrom: formatDateOnly(window.dateRange.gte),
        dateTo: formatDateOnly(window.dateRange.lte),
        warehouseId: query.warehouseId ?? null
      },
      fulfillment: {
        cancelled,
        delivered,
        deliveryAttempts,
        deliverySuccessRate: percentage(successfulDeliveries, deliveryAttempts),
        fulfillmentRate: percentage(delivered, delivered + cancelled),
        inProgress: ordersPlaced - delivered - cancelled,
        ordersPlaced
      },
      generatedAt: now.toISOString(),
      queues: {
        activeDeliveries: activeDeliveries.map((assignment) => ({
          assignedAt: assignment.assignedAt,
          id: assignment.id,
          orderId: assignment.orderId,
          orderNumber: assignment.order.orderNumber,
          partnerMobile: assignment.deliveryPartner.mobileNumber,
          partnerName: assignment.deliveryPartner.fullName,
          status: assignment.status,
          updatedAt: assignment.updatedAt,
          warehouseName:
            assignment.pickupWarehouse?.name ?? assignment.order.warehouse?.name ?? null
        })),
        dispatch: dispatchQueue.map(serializeDispatchOrder),
        lowStock: lowStockLines.map((line) => ({
          availableQuantity: line.availableQuantity,
          id: line.id,
          lowStockThreshold: line.reorderLevel,
          productId: line.productId,
          productName: line.product.name,
          sku: line.product.sku,
          status: line.availableQuantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
          variantId: line.variantId,
          variantName: line.variant?.name ?? null,
          warehouseId: line.warehouseId,
          warehouseName: line.warehouse.name
        })),
        riders: riders.map((rider) => ({
          activeDeliveries: rider._count.assignments,
          fullName: rider.fullName,
          id: rider.id,
          isOnline: rider.isOnline,
          lastSeenAt: rider.lastSeenAt,
          mobileNumber: rider.mobileNumber,
          vehicleNumber: rider.vehicleNumber
        }))
      },
      riders: {
        assigned: assignedRiders,
        available: availableRiders,
        onDelivery: ridersOnDelivery,
        online: onlineRiders
      },
      stock,
      todayDate: formatDateOnly(now),
      warehouse,
      warehouseOptions
    };
  }
}

/** One decimal place, or null when there is nothing to measure yet. */
function percentage(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}
