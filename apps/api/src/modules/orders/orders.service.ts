import { randomUUID } from "node:crypto";
import type { CustomerEmailEvent } from "@surgical/types";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { signPrivateFileUrl } from "../uploads/private-files";
import { ApiQueueService } from "../../queues/api-queue.service";
import {
  CustomerEmailNotifier,
  emailAddress,
  emailLineItems,
  emailMoney,
  emailText,
  type CustomerEmailContact
} from "../../queues/customer-email.notifier";
import {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  RefundStatus,
  StockMovementType
} from "../../generated/prisma/client";
import { CartService } from "../cart/cart.service";
import {
  calculateCouponDiscount,
  normalizeCouponCode
} from "../coupons/coupons.service";
import { DeliveryChargesService } from "../delivery-charges/delivery-charges.service";
import { buildFulfillmentStockQuery } from "../inventory/fulfillment-stock";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { PaymentsService } from "../payments/payments.service";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import {
  isSuperAdmin,
  WarehouseAccessService
} from "../warehouses/warehouse-access.service";
import { buildPendingOrderStatusFilter } from "./order-status";
import { getCartQuotePricing, quoteLineKey, updateCartQuoteLink } from "../quote-requests/quote-cart-pricing";
import type {
  AdminOrderListQueryDto,
  AdminReturnActionDto,
  AdminReturnRequestListQueryDto,
  CancelOrderDto,
  CreateOrderDto,
  OrderListQueryDto,
  RequestReturnDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";

const CART_CHECKOUT_INCLUDE = {
  items: {
    include: {
      product: true,
      variant: true
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.CartInclude;

const ORDER_INCLUDE = {
  billingAddress: true,
  deliveryAssignments: {
    include: {
      deliveryPartner: true,
      statusHistory: {
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
      }
    },
    orderBy: [{ assignedAt: "desc" as const }, { id: "asc" as const }]
  },
  gstInvoice: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  refunds: {
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }]
  },
  shippingAddress: true,
  statusHistory: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  user: true,
  warehouse: true
} as const satisfies Prisma.OrderInclude;

const ORDER_SUMMARY_INCLUDE = {
  billingAddress: true,
  deliveryAssignments: {
    include: {
      deliveryPartner: true,
      statusHistory: {
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
      }
    },
    orderBy: [{ assignedAt: "desc" as const }, { id: "asc" as const }]
  },
  gstInvoice: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  refunds: {
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }]
  },
  shippingAddress: true,
  statusHistory: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  user: true,
  warehouse: true
} as const satisfies Prisma.OrderInclude;

const CANCELLABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.CREATED,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.ASSIGNED
]);

const ACTIVE_RETURN_REFUND_STATUSES = new Set<RefundStatus>([
  RefundStatus.PENDING,
  RefundStatus.PROCESSING
]);

const PROCESSABLE_RETURN_REFUND_STATUSES = new Set<RefundStatus>([
  RefundStatus.PENDING,
  RefundStatus.PROCESSING,
  RefundStatus.FAILED
]);

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED],
  [OrderStatus.PACKED]: [],
  [OrderStatus.ASSIGNED]: [],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: []
};

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type CartCheckoutRecord = Prisma.CartGetPayload<{
  include: typeof CART_CHECKOUT_INCLUDE;
}>;
type CartCheckoutItem = CartCheckoutRecord["items"][number];
type OrderRecord = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type OrderSummaryRecord = Prisma.OrderGetPayload<{
  include: typeof ORDER_SUMMARY_INCLUDE;
}>;
type OrderClient =
  | Pick<
      Prisma.TransactionClient,
      | "address"
      | "cart"
      | "cartItem"
      | "coupon"
      | "deliveryAssignment"
      | "deliveryStatusHistory"
      | "inventoryStock"
      | "order"
      | "orderItem"
      | "orderStatusHistory"
      | "payment"
      | "refund"
      | "stockBatch"
      | "stockMovement"
      | "user"
      | "warehouse"
    >
  | PrismaService;

type FulfillmentLine = {
  key: string;
  name: string;
  productId: string;
  quantity: number;
  sku: string;
  taxRate: number;
  unitPrice: number;
  variantId: string | null;
};

export type QuoteOrderLine = {
  lineSubtotal: number;
  lineTotal: number;
  name: string;
  productId: string | null;
  quantity: number;
  sku: string;
  taxAmount: number;
  taxRate: number;
  unitPrice: number;
  variantId: string | null;
};

export type CreateQuoteOrderInput = {
  items: QuoteOrderLine[];
  notes: string | null;
  quoteId: string;
  totals: {
    grandTotal: number;
    shippingTotal: number;
    subtotal: number;
    taxTotal: number;
  };
};

type SelectedWarehouseStock = {
  availableQuantity: number;
  stockId: string;
  warehouseId: string;
};

type StockAllocation = {
  line: FulfillmentLine;
  quantity: number;
  stockBatchId: string;
  warehouseId: string;
};

type PendingDeliveryNotification = {
  assignmentId: string;
  deliveryPartnerId: string;
  notificationId: string;
  orderNumber: string;
};

const UNPAID_ORDER_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.FAILED
]);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly queueService?: ApiQueueService,
    @Optional() private readonly cartService?: CartService,
    @Optional() private readonly paymentsService?: PaymentsService,
    @Optional() private readonly deliveryChargesService?: DeliveryChargesService,
    @Optional() private readonly customerEmails?: CustomerEmailNotifier
  ) {}

  async createOrder(customerId: string, input: CreateOrderDto) {
    const checkoutIdempotencyKey = normalizeCheckoutIdempotencyKey(
      input.idempotencyKey
    );
    const existingOrder = checkoutIdempotencyKey
      ? await this.findOrderByCheckoutIdempotencyKey(
          this.prisma,
          customerId,
          checkoutIdempotencyKey
        )
      : null;

    if (existingOrder) {
      return this.serializeOrder(existingOrder);
    }

    let order: ReturnType<OrdersService["serializeOrder"]>;

    try {
      order = await this.prisma.$transaction(async (tx) => {
        await this.assertActiveCustomer(tx, customerId);
        const shippingAddress = await this.findOwnedAddress(
          tx,
          customerId,
          input.shippingAddressId
        );
        const billingAddressId = input.billingAddressId ?? input.shippingAddressId;
        const billingAddress =
          billingAddressId === shippingAddress.id
            ? shippingAddress
            : await this.findOwnedAddress(tx, customerId, billingAddressId);
        const cart = await this.findCheckoutCart(tx, customerId);
        const quotation = await getCartQuotePricing(tx, cart);
        const lines = cart.items.map((item) => {
          const line = this.buildFulfillmentLine(item);
          const price = quotation?.lines.get(quoteLineKey(item));
          return price ? { ...line, unitPrice: price.unitPrice, taxRate: price.taxRate } : line;
        });
        const allocations = await this.reserveInventory(tx, lines);
        const primaryWarehouseId = allocations[0]?.warehouseId ?? null;
        const itemTotals = calculateTotals(
          allocations.map((allocation) =>
            buildAllocationTotals(allocation.line, allocation.quantity)
          )
        );
        const deliveryCharge = quotation?.shippingTotal ?? await this.calculateDeliveryCharge(
          shippingAddress.pincode,
          itemTotals.subtotal,
          primaryWarehouseId
        );
        const totals = {
          ...itemTotals,
          deliveryCharge,
          grandTotal: roundMoney(
            itemTotals.subtotal + itemTotals.tax + deliveryCharge
          )
        };
        const couponApplication = await this.applyCouponDiscount(
          tx,
          input.couponCode,
          totals.subtotal
        );
        const payableTotal = roundMoney(
          totals.grandTotal - couponApplication.discount
        );
        const order = await tx.order.create({
          data: {
            billingAddressId: billingAddress.id,
            ...(checkoutIdempotencyKey ? { checkoutIdempotencyKey } : {}),
            couponId: couponApplication.couponId,
            discountTotal: couponApplication.discount,
            grandTotal: payableTotal,
            orderNumber: await this.generateOrderNumber(tx),
            paymentStatus: PaymentStatus.PENDING,
            placedAt: new Date(),
            shippingAddressId: shippingAddress.id,
            shippingTotal: totals.deliveryCharge,
            status: OrderStatus.CREATED,
            subtotal: totals.subtotal,
            taxTotal: totals.tax,
            userId: customerId,
            warehouseId: primaryWarehouseId
          }
        });

        for (const allocation of allocations) {
          const allocationTotals = buildAllocationTotals(
            allocation.line,
            allocation.quantity
          );

          await tx.orderItem.create({
            data: {
              name: allocation.line.name,
              orderId: order.id,
              productId: allocation.line.productId,
              quantity: allocation.quantity,
              sku: allocation.line.sku,
              stockBatchId: allocation.stockBatchId,
              taxAmount: allocationTotals.tax,
              taxRate: allocation.line.taxRate,
              total: allocationTotals.total,
              unitPrice: allocation.line.unitPrice,
              variantId: allocation.line.variantId,
              warehouseId: allocation.warehouseId
            }
          });
          await tx.stockMovement.create({
            data: {
              metadata: toJsonValue({
                orderNumber: order.orderNumber
              }),
              productId: allocation.line.productId,
              quantity: allocation.quantity,
              referenceId: order.id,
              referenceType: "ORDER",
              stockBatchId: allocation.stockBatchId,
              type: StockMovementType.OUT,
              variantId: allocation.line.variantId,
              warehouseId: allocation.warehouseId
            }
          });
        }

        await tx.payment.create({
          data: {
            amount: payableTotal,
            method: input.paymentMethod,
            orderId: order.id,
            status: PaymentStatus.PENDING
          }
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CREATED
          }
        });
        if (quotation) await updateCartQuoteLink(tx, quotation.record, order.id);
        if (input.paymentMethod === PaymentMethod.COD) {
          await tx.cartItem.deleteMany({
            where: {
              cartId: cart.id
            }
          });
        }

        return this.serializeOrder(await this.findOrderById(tx, order.id));
      });
    } catch (error) {
      if (checkoutIdempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.findOrderByCheckoutIdempotencyKey(
          this.prisma,
          customerId,
          checkoutIdempotencyKey
        );

        if (existing) {
          return this.serializeOrder(existing);
        }
      }

      throw error;
    }

    await this.enqueueOrderConfirmation(customerId, order);
    await this.customerEmails?.notify(
      orderEmailContact(order),
      orderReceivedEmail(order),
      `order-received:${order.id}`
    );

    return order;
  }

  async createOrderFromQuote(customerId: string, input: CreateQuoteOrderInput) {
    if (input.items.length === 0) {
      throw new BadRequestException("Quote has no orderable items.");
    }

    const checkoutIdempotencyKey = `quote:${input.quoteId}`;
    const existing = await this.findOrderByCheckoutIdempotencyKey(this.prisma, customerId, checkoutIdempotencyKey);
    if (existing) return this.serializeOrder(existing);
    let order: ReturnType<OrdersService["serializeOrder"]>;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        await this.assertActiveCustomer(tx, customerId);
        const defaultAddress = await tx.address.findFirst({
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
          where: {
            deletedAt: null,
            userId: customerId
          }
        });
        if (!defaultAddress) throw new BadRequestException("Add a delivery address before creating an order from this quotation.");
        const catalogLines: FulfillmentLine[] = [];
        for (const item of input.items) {
          if (!item.productId) continue;
          const product = await tx.product.findFirst({ where: { id: item.productId, deletedAt: null, status: ProductStatus.ACTIVE } });
          if (!product) throw new BadRequestException("The quotation contains an unavailable catalog product.");
          if (item.variantId) {
            const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, productId: item.productId, deletedAt: null, status: ProductStatus.ACTIVE } });
            if (!variant) throw new BadRequestException("The quotation contains an unavailable product variant.");
          }
          catalogLines.push({ ...item, productId: item.productId, key: quoteLineKey(item) });
        }
        const allocations = await this.reserveInventory(tx, catalogLines);
        const order = await tx.order.create({
          data: {
            checkoutIdempotencyKey,
            billingAddressId: defaultAddress?.id ?? null,
            discountTotal: 0,
            grandTotal: roundMoney(input.totals.grandTotal),
            notes: quoteOrderNote(input),
            orderNumber: await this.generateOrderNumber(tx),
            paymentStatus: PaymentStatus.PENDING,
            placedAt: new Date(),
            shippingAddressId: defaultAddress?.id ?? null,
            shippingTotal: roundMoney(input.totals.shippingTotal),
            status: OrderStatus.CREATED,
            subtotal: roundMoney(input.totals.subtotal),
            taxTotal: roundMoney(input.totals.taxTotal),
            userId: customerId,
            warehouseId: allocations[0]?.warehouseId ?? null
          }
        });

        for (const item of input.items) {
          if (item.productId) continue;
          await tx.orderItem.create({
            data: {
              name: item.name,
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              sku: item.sku,
              stockBatchId: null,
              taxAmount: roundMoney(item.taxAmount),
              taxRate: roundMoney(item.taxRate),
              total: roundMoney(item.lineTotal),
              unitPrice: roundMoney(item.unitPrice),
              variantId: item.productId ? item.variantId : null,
              warehouseId: null
            }
          });
        }

        for (const allocation of allocations) {
          const totals = buildAllocationTotals(allocation.line, allocation.quantity);
          await tx.orderItem.create({ data: {
            name: allocation.line.name, orderId: order.id, productId: allocation.line.productId,
            quantity: allocation.quantity, sku: allocation.line.sku, stockBatchId: allocation.stockBatchId,
            taxAmount: totals.tax, taxRate: allocation.line.taxRate, total: totals.total,
            unitPrice: allocation.line.unitPrice, variantId: allocation.line.variantId, warehouseId: allocation.warehouseId
          } });
          await tx.stockMovement.create({ data: {
            metadata: toJsonValue({ orderNumber: order.orderNumber }), productId: allocation.line.productId,
            quantity: allocation.quantity, referenceId: order.id, referenceType: "ORDER",
            stockBatchId: allocation.stockBatchId, type: StockMovementType.OUT,
            variantId: allocation.line.variantId, warehouseId: allocation.warehouseId
          } });
        }
        await tx.payment.create({
          data: {
            amount: roundMoney(input.totals.grandTotal),
            method: PaymentMethod.ONLINE,
            orderId: order.id,
            status: PaymentStatus.PENDING
          }
        });
        await tx.orderStatusHistory.create({
          data: {
            note: `Created from quote ${input.quoteId}.`,
            orderId: order.id,
            status: OrderStatus.CREATED
          }
        });

        return this.serializeOrder(await this.findOrderById(tx, order.id));
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const duplicate = await this.findOrderByCheckoutIdempotencyKey(this.prisma, customerId, checkoutIdempotencyKey);
        if (duplicate) return this.serializeOrder(duplicate);
      }

      throw error;
    }

    await this.enqueueOrderConfirmation(customerId, order);
    await this.customerEmails?.notify(
      orderEmailContact(order),
      orderReceivedEmail(order),
      `order-received:${order.id}`
    );

    return order;
  }

  async listMyOrders(customerId: string, query: OrderListQueryDto) {
    await this.assertActiveCustomer(this.prisma, customerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      userId: customerId
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        include: ORDER_SUMMARY_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where
      }),
      this.prisma.order.count({ where })
    ]);

    return paginated(
      items.map((order) => this.serializeOrderSummary(order)),
      total,
      page,
      limit
    );
  }

  async getMyOrder(customerId: string, orderId: string) {
    await this.assertActiveCustomer(this.prisma, customerId);
    const order = await this.prisma.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId,
        userId: customerId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    return this.serializeOrder(order);
  }

  async reorder(customerId: string, orderId: string) {
    await this.assertActiveCustomer(this.prisma, customerId);
    const order = await this.prisma.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId,
        userId: customerId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    if (order.items.length === 0) {
      throw new BadRequestException("Order has no items to reorder.");
    }

    if (order.items.some((item) => !item.productId)) {
      throw new BadRequestException(
        "Custom quote items cannot be reordered into cart."
      );
    }

    if (!this.cartService) {
      throw new BadRequestException("Cart service is unavailable.");
    }

    return this.cartService.replaceWithItems(
      customerId,
      mergeOrderItemsForReorder(order.items)
    );
  }

  async cancelMyOrder(customerId: string, orderId: string, input: CancelOrderDto) {
    await this.assertActiveCustomer(this.prisma, customerId);

    const { notifications, order: cancelledOrder } = await this.prisma.$transaction(async (tx) => {
      const order = await this.findCustomerOrder(tx, customerId, orderId);

      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throw new BadRequestException(
          "Order cannot be cancelled in its current status."
        );
      }

      await this.claimOrderCancellation(tx, order);
      await this.releaseReservedInventoryForCancelledOrder(tx, order);
      const notifications = await this.cancelActiveDeliveryAssignments(
        tx,
        order,
        input.reason
      );

      const paidPayment = order.payments.find(
        (payment) => payment.status === PaymentStatus.PAID
      );

      if (paidPayment) {
        await tx.refund.create({
          data: {
            amount: decimalToNumber(paidPayment.amount),
            orderId: order.id,
            paymentId: paidPayment.id,
            reason: input.reason ?? "Customer cancelled order.",
            status: RefundStatus.PENDING
          }
        });
      }

      await tx.order.update({
        data: {
          paymentStatus: paidPayment ? order.paymentStatus : PaymentStatus.CANCELLED,
          status: OrderStatus.CANCELLED
        },
        where: {
          id: order.id
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          note: input.reason,
          orderId: order.id,
          status: OrderStatus.CANCELLED
        }
      });

      return {
        notifications,
        order: this.serializeOrder(await this.findOrderById(tx, order.id))
      };
    });

    await this.sendDeliveryCancellationNotifications(notifications);
    // A paid order always gets a PENDING refund above, so "requested" is accurate.
    await this.notifyOrderCancelled(
      cancelledOrder,
      input.reason,
      hasPaidPayment(cancelledOrder) ? "REQUESTED" : "NOT_DUE"
    );

    return cancelledOrder;
  }

  async requestMyOrderReturn(
    customerId: string,
    orderId: string,
    input: RequestReturnDto
  ) {
    await this.assertActiveCustomer(this.prisma, customerId);

    let returnRefundId = "";
    const returnedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await this.findCustomerOrder(tx, customerId, orderId);

      if (order.status !== OrderStatus.DELIVERED) {
        throw new BadRequestException(
          "Return requests can be submitted only after delivery."
        );
      }

      if (
        order.refunds.some((refund) => ACTIVE_RETURN_REFUND_STATUSES.has(refund.status))
      ) {
        throw new BadRequestException(
          "A return or refund request is already pending for this order."
        );
      }

      const paidPayment =
        order.payments.find((payment) => payment.status === PaymentStatus.PAID) ??
        order.payments[0] ??
        null;

      const refund = await tx.refund.create({
        data: {
          amount: decimalToNumber(order.grandTotal),
          orderId: order.id,
          paymentId: paidPayment?.id,
          reason: input.reason ?? "Customer requested return.",
          status: RefundStatus.PENDING
        }
      });
      returnRefundId = refund.id;

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });

    await this.customerEmails?.notify(
      orderEmailContact(returnedOrder),
      {
        customerNote: null,
        orderId: returnedOrder.id,
        orderNumber: returnedOrder.orderNumber,
        status: "RECEIVED",
        template: "return-update"
      },
      `return-update:${returnRefundId}:RECEIVED`
    );

    return returnedOrder;
  }

  async listAdminOrders(query: AdminOrderListQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      createdAt: buildDateRangeFilter(query.dateFrom, query.dateTo),
      deletedAt: null,
      orderNumber: buildInsensitiveContainsFilter(query.orderNumber),
      paymentStatus: query.paymentStatus,
      status: query.pendingOnly ? buildPendingOrderStatusFilter(query.status) : query.status,
      user: buildCustomerMobileFilter(query.customerMobile),
      warehouseId: await this.buildScopedWarehouseFilter(query.warehouseId, auth)
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        include: ORDER_SUMMARY_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.order.count({
        where: stripUndefined(where)
      })
    ]);

    return paginated(
      items.map((order) => this.serializeOrderSummary(order)),
      total,
      page,
      limit
    );
  }

  async listAdminReturnRequests(
    query: AdminReturnRequestListQueryDto,
    auth: AuthJwtPayload
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const refundWhere: Prisma.RefundWhereInput = {
      status: query.status
    };
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderNumber: buildInsensitiveContainsFilter(query.orderNumber),
      refunds: {
        some: stripUndefined(refundWhere)
      },
      user: buildCustomerMobileFilter(query.customerMobile),
      warehouseId: await this.buildScopedWarehouseFilter(query.warehouseId, auth)
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        include: ORDER_SUMMARY_INCLUDE,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.order.count({
        where: stripUndefined(where)
      })
    ]);

    return paginated(
      items.map((order) => this.serializeOrderSummary(order)),
      total,
      page,
      limit
    );
  }

  async getAdminOrder(orderId: string, auth: AuthJwtPayload) {
    const order = await this.findAdminOrder(orderId, auth);

    return this.serializeOrder(order);
  }

  async updateStatus(
    orderId: string,
    input: UpdateOrderStatusDto,
    context: AdminActionContext,
    options: { allowReturnTransition?: boolean } = {}
  ) {
    if (input.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Use the cancel endpoint to cancel orders.");
    }

    if (input.status === OrderStatus.RETURNED && !options.allowReturnTransition) {
      throw new BadRequestException(
        "Use the return approval endpoint to return orders."
      );
    }

    let invoiceOrderId: string | null = null;
    let refundOrderId: string | null = null;
    let returnRefundId: string | null = null;
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await this.findAdminOrder(orderId, context.auth, tx);
      this.assertAllowedStatusTransition(order.status, input.status);

      if (
        input.status === OrderStatus.RETURNED &&
        !order.refunds.some((refund) =>
          ACTIVE_RETURN_REFUND_STATUSES.has(refund.status)
        )
      ) {
        throw new BadRequestException("No pending return request was found.");
      }

      if (input.status === OrderStatus.DELIVERED) {
        await this.clearReservedInventoryForDeliveredOrder(tx, order);
      }

      await tx.order.update({
        data: {
          status: input.status
        },
        where: {
          id: order.id
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          changedById: context.auth.sub,
          note: input.note,
          orderId: order.id,
          status: input.status
        }
      });

      if (
        input.status === OrderStatus.CONFIRMED &&
        this.shouldGenerateInvoiceAfterStatusUpdate(order)
      ) {
        invoiceOrderId = order.id;
      }

      if (input.status === OrderStatus.RETURNED) {
        refundOrderId = order.id;
        returnRefundId =
          order.refunds.find((refund) => ACTIVE_RETURN_REFUND_STATUSES.has(refund.status))
            ?.id ?? null;
      }

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });

    // Sent before refund processing, which can fail after this commit.
    await this.notifyAdminStatusUpdate(updatedOrder, input, returnRefundId);

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    if (refundOrderId) {
      await this.paymentsService?.processPendingOrderRefund(refundOrderId);
      return this.getAdminOrder(refundOrderId, context.auth);
    }

    return updatedOrder;
  }

  async approveAdminReturn(
    orderId: string,
    input: AdminReturnActionDto,
    context: AdminActionContext
  ) {
    return this.updateStatus(
      orderId,
      {
        note: input.note ?? RETURN_APPROVED_NOTE,
        status: OrderStatus.RETURNED
      },
      context,
      { allowReturnTransition: true }
    );
  }

  async rejectAdminReturn(
    orderId: string,
    input: AdminReturnActionDto,
    context: AdminActionContext
  ) {
    let rejected = null as { amount: number; id: string; wasReturn: boolean } | null;
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await this.findAdminOrder(orderId, context.auth, tx);
      const refund = await tx.refund.findFirst({
        where: {
          orderId: order.id,
          status: {
            in: [RefundStatus.PENDING, RefundStatus.PROCESSING]
          }
        }
      });

      if (!refund) {
        throw new BadRequestException("No pending return request was found.");
      }

      const note = input.note?.trim() || "Return request rejected.";

      await tx.refund.update({
        data: {
          reason: appendRefundNote(refund.reason, note),
          status: RefundStatus.CANCELLED
        },
        where: {
          id: refund.id
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          changedById: context.auth.sub,
          note,
          orderId: order.id,
          status: order.status
        }
      });
      rejected = {
        amount: decimalToNumber(refund.amount),
        id: refund.id,
        // Return refunds belong to delivered orders; others are cancellation refunds.
        wasReturn: order.status === OrderStatus.DELIVERED
      };

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });

    if (rejected) {
      await this.notifyRefundRequestRejected(updatedOrder, rejected, input.note);
    }

    return updatedOrder;
  }

  async processAdminReturnRefund(orderId: string, context: AdminActionContext) {
    const order = await this.findAdminOrder(orderId, context.auth);
    const refund = order.refunds.find((entry) =>
      PROCESSABLE_RETURN_REFUND_STATUSES.has(entry.status)
    );

    if (!refund) {
      throw new BadRequestException("No actionable return refund was found.");
    }

    await this.paymentsService?.processPendingOrderRefund(order.id);

    return this.getAdminOrder(order.id, context.auth);
  }

  async cancelOrder(
    orderId: string,
    input: CancelOrderDto,
    context: AdminActionContext
  ) {
    const { notifications, order: cancelledOrder } = await this.prisma.$transaction(async (tx) => {
      const order = await this.findAdminOrder(orderId, context.auth, tx);

      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throw new BadRequestException(
          "Order cannot be cancelled in its current status."
        );
      }

      await this.claimOrderCancellation(tx, order);
      await this.releaseReservedInventoryForCancelledOrder(tx, order);
      const notifications = await this.cancelActiveDeliveryAssignments(
        tx,
        order,
        input.reason
      );
      await tx.order.update({
        data: {
          status: OrderStatus.CANCELLED
        },
        where: {
          id: order.id
        }
      });
      await tx.orderStatusHistory.create({
        data: {
          changedById: context.auth.sub,
          note: input.reason,
          orderId: order.id,
          status: OrderStatus.CANCELLED
        }
      });

      return {
        notifications,
        order: this.serializeOrder(await this.findOrderById(tx, order.id))
      };
    });

    await this.sendDeliveryCancellationNotifications(notifications);
    // Admin cancellation does not create a refund, so a paid order is only
    // promised a review, never a refund.
    await this.notifyOrderCancelled(
      cancelledOrder,
      input.reason,
      hasPaidPayment(cancelledOrder) ? "UNDER_REVIEW" : "NOT_DUE"
    );

    return cancelledOrder;
  }

  // Cancels an online order whose payment never completed, releasing its
  // stock and coupon use. Returns false when the order no longer qualifies,
  // for example because a payment arrived after it was selected.
  async expireUnpaidOrder(orderId: string, timeoutMinutes: number) {
    const reason = `Payment was not completed within ${timeoutMinutes} minutes.`;
    const expired = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        include: ORDER_INCLUDE,
        where: { deletedAt: null, id: orderId }
      });

      if (!order || !isExpirableUnpaidOrder(order)) {
        return null;
      }

      await this.claimOrderCancellation(tx, order);
      await this.releaseReservedInventoryForCancelledOrder(tx, order);
      const notifications = await this.cancelActiveDeliveryAssignments(tx, order, reason);
      await this.releaseCouponUsage(tx, order.couponId);
      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.CANCELLED,
          status: OrderStatus.CANCELLED
        },
        where: { id: order.id }
      });
      await tx.orderStatusHistory.create({
        data: {
          note: reason,
          orderId: order.id,
          status: OrderStatus.CANCELLED
        }
      });

      return {
        notifications,
        order: this.serializeOrder(await this.findOrderById(tx, order.id))
      };
    });

    if (!expired) {
      return false;
    }

    await this.sendDeliveryCancellationNotifications(expired.notifications);
    await this.notifyOrderCancelled(expired.order, reason, "NOT_DUE");

    return true;
  }

  // The order is already committed; a queue outage must not turn it into an
  // error for the customer.
  private async enqueueOrderConfirmation(customerId: string, order: SerializedOrder) {
    try {
      await this.queueService?.enqueueOrderConfirmation({
        customerId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    } catch (error) {
      this.logger.warn(
        `Order confirmation for ${order.orderNumber} was not queued: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async notifyOrderCancelled(
    order: SerializedOrder,
    reason: string | undefined,
    refund: Extract<CustomerEmailEvent, { template: "order-cancelled" }>["refund"]
  ) {
    await this.customerEmails?.notify(
      orderEmailContact(order),
      {
        cancellationReason: emailText(reason),
        grandTotal: emailMoney(order.totals.grandTotal),
        orderId: order.id,
        orderNumber: order.orderNumber,
        refund,
        template: "order-cancelled"
      },
      `order-cancelled:${order.id}`
    );
  }

  private async notifyAdminStatusUpdate(
    order: SerializedOrder,
    input: UpdateOrderStatusDto,
    returnRefundId: string | null
  ) {
    if (input.status === OrderStatus.RETURNED) {
      if (!returnRefundId) return;
      const note = emailText(input.note);
      await this.customerEmails?.notify(
        orderEmailContact(order),
        {
          customerNote: note === RETURN_APPROVED_NOTE ? null : note,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "APPROVED",
          template: "return-update"
        },
        `return-update:${returnRefundId}:APPROVED`
      );
      return;
    }

    if (
      input.status === OrderStatus.CONFIRMED ||
      input.status === OrderStatus.PACKED ||
      input.status === OrderStatus.DELIVERED
    ) {
      await this.customerEmails?.notify(
        orderEmailContact(order),
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: input.status,
          template: "order-progress"
        },
        `order-progress:${order.id}:${input.status}`
      );
    }
  }

  private async notifyRefundRequestRejected(
    order: SerializedOrder,
    refund: { amount: number; id: string; wasReturn: boolean },
    note: string | undefined
  ) {
    if (refund.wasReturn) {
      await this.customerEmails?.notify(
        orderEmailContact(order),
        {
          customerNote: emailText(note),
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: "REJECTED",
          template: "return-update"
        },
        `return-update:${refund.id}:REJECTED`
      );
      return;
    }

    await this.customerEmails?.notify(
      orderEmailContact(order),
      {
        amount: emailMoney(refund.amount),
        orderId: order.id,
        orderNumber: order.orderNumber,
        partial: refund.amount < order.totals.grandTotal,
        refundReference: null,
        status: "CANCELLED",
        template: "refund-update"
      },
      `refund-update:${refund.id}:CANCELLED`
    );
  }

  private async assertActiveCustomer(client: OrderClient, customerId: string) {
    const customer = await client.user.findFirst({
      where: {
        deletedAt: null,
        id: customerId,
        isActive: true
      }
    });

    if (!customer) {
      throw new UnauthorizedException("Customer account is inactive.");
    }
  }

  private async findOwnedAddress(
    client: OrderClient,
    customerId: string,
    addressId: string
  ) {
    const address = await client.address.findFirst({
      where: {
        deletedAt: null,
        id: addressId,
        userId: customerId
      }
    });

    if (!address) {
      throw new NotFoundException("Address was not found.");
    }

    return address;
  }

  private async findCheckoutCart(client: OrderClient, customerId: string) {
    const cart = await client.cart.findFirst({
      include: CART_CHECKOUT_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        userId: customerId
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty.");
    }

    return cart;
  }

  private buildFulfillmentLine(item: CartCheckoutItem): FulfillmentLine {
    if (
      item.product.deletedAt !== null ||
      item.product.status !== ProductStatus.ACTIVE
    ) {
      throw new BadRequestException("Cart contains an unavailable product.");
    }

    if (
      item.variantId !== null &&
      (!item.variant ||
        item.variant.deletedAt !== null ||
        item.variant.status !== ProductStatus.ACTIVE)
    ) {
      throw new BadRequestException("Cart contains an unavailable product variant.");
    }

    const variantName = item.variant?.name;
    const name = variantName
      ? `${item.product.name} - ${variantName}`
      : item.product.name;
    const sku = item.variant?.sku ?? item.product.sku;
    const unitPrice = decimalToNumber(
      item.variant?.sellingPrice ?? item.product.sellingPrice
    );
    const taxRate = decimalToNumber(item.product.taxRate);

    return {
      key: `${item.productId}:${item.variantId ?? "base"}`,
      name,
      productId: item.productId,
      quantity: item.quantity,
      sku,
      taxRate,
      unitPrice,
      variantId: item.variantId
    };
  }

  private async reserveInventory(
    tx: Prisma.TransactionClient,
    lines: FulfillmentLine[]
  ) {
    const allocations: StockAllocation[] = [];

    for (const line of lines) {
      const stocks = await this.findAvailableStocksForLine(tx, line);
      let remainingLineQuantity = line.quantity;
      let reservedLineQuantity = 0;

      for (const stock of stocks) {
        if (remainingLineQuantity === 0) {
          break;
        }

        const reserveQuantity = Math.min(
          stock.availableQuantity,
          remainingLineQuantity
        );

        if (reserveQuantity <= 0) {
          continue;
        }

        const stockUpdate = await tx.inventoryStock.updateMany({
          data: {
            availableQuantity: {
              decrement: reserveQuantity
            },
            reservedQuantity: {
              increment: reserveQuantity
            }
          },
          where: {
            availableQuantity: {
              gte: reserveQuantity
            },
            id: stock.stockId
          }
        });

        if (stockUpdate.count !== 1) {
          throw new BadRequestException(
            "Requested stock is no longer available. Please review your cart."
          );
        }

        allocations.push(
          ...(await this.reserveBatchesForStock(
            tx,
            line,
            stock.warehouseId,
            reserveQuantity
          ))
        );
        reservedLineQuantity += reserveQuantity;
        remainingLineQuantity -= reserveQuantity;
      }

      if (remainingLineQuantity > 0) {
        throw new BadRequestException(
          stockUnavailableMessage(line, reservedLineQuantity)
        );
      }
    }

    return allocations;
  }

  private async findAvailableStocksForLine(
    tx: Prisma.TransactionClient,
    line: FulfillmentLine
  ): Promise<SelectedWarehouseStock[]> {
    const stocks = await tx.inventoryStock.findMany(buildFulfillmentStockQuery(line));

    return stocks.map((stock) => ({
      availableQuantity: stock.availableQuantity,
      stockId: stock.id,
      warehouseId: stock.warehouseId
    }));
  }

  private async applyCouponDiscount(
    client: OrderClient,
    couponCode: string | null | undefined,
    subtotal: number
  ) {
    const code = couponCode ? normalizeCouponCode(couponCode) : "";

    if (!code) {
      return {
        couponId: null,
        discount: 0
      };
    }

    const coupon = await client.coupon.findFirst({
      where: {
        code: {
          equals: code,
          mode: "insensitive"
        },
        deletedAt: null
      }
    });

    if (!coupon) {
      throw new NotFoundException("Coupon was not found.");
    }

    const discount = calculateCouponDiscount(coupon, subtotal);
    await this.incrementCouponUsage(client, coupon.id);

    return {
      couponId: coupon.id,
      discount
    };
  }

  private async calculateDeliveryCharge(
    pincode: string | null,
    subtotal: number,
    warehouseId: string | null
  ) {
    if (!this.deliveryChargesService || subtotal <= 0) {
      return 0;
    }

    const quote = await this.deliveryChargesService.calculateDeliveryCharge({
      pincode,
      subtotal,
      warehouseId
    });

    return quote.deliveryCharge;
  }

  private async incrementCouponUsage(client: OrderClient, couponId: string | null) {
    if (!couponId) {
      return;
    }

    const now = new Date();
    const claimed = await client.coupon.updateMany({
      data: {
        usedCount: {
          increment: 1
        }
      },
      where: {
        id: couponId,
        deletedAt: null,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          {
            OR: [
              { usageLimit: null },
              { usedCount: { lt: client.coupon.fields.usageLimit } }
            ]
          }
        ]
      }
    });

    if (claimed.count !== 1) {
      throw new BadRequestException(
        "Coupon is no longer available. Please apply a coupon again."
      );
    }
  }

  private async releaseCouponUsage(client: OrderClient, couponId: string | null) {
    if (!couponId) {
      return;
    }

    await client.coupon.updateMany({
      data: {
        usedCount: {
          decrement: 1
        }
      },
      where: {
        id: couponId,
        usedCount: {
          gt: 0
        }
      }
    });
  }

  private async reserveBatchesForStock(
    tx: Prisma.TransactionClient,
    line: FulfillmentLine,
    warehouseId: string,
    quantity: number
  ) {
    const allocations: StockAllocation[] = [];
    const batches = await tx.stockBatch.findMany({
      where: {
        productId: line.productId,
        quantity: {
          gt: 0
        },
        variantId: line.variantId,
        warehouseId
      }
    });
    let remaining = quantity;

    for (const batch of sortBatchesForAllocation(batches)) {
      if (remaining === 0) {
        break;
      }

      const allocationQuantity = Math.min(batch.quantity, remaining);

      if (allocationQuantity <= 0) {
        continue;
      }

      const batchUpdate = await tx.stockBatch.updateMany({
        data: {
          quantity: {
            decrement: allocationQuantity
          }
        },
        where: {
          id: batch.id,
          quantity: {
            gte: allocationQuantity
          }
        }
      });

      if (batchUpdate.count !== 1) {
        throw new BadRequestException("Selected stock batch is no longer available.");
      }

      allocations.push({
        line,
        quantity: allocationQuantity,
        stockBatchId: batch.id,
        warehouseId
      });
      remaining -= allocationQuantity;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Inventory batch data is not synchronized for ${line.name}. Please try again later.`
      );
    }

    return allocations;
  }

  private async findAdminOrder(
    orderId: string,
    auth: AuthJwtPayload,
    client: OrderClient = this.prisma
  ) {
    const order = await client.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    if (order.warehouseId !== null) {
      await this.warehouseAccessService.assertCanManageWarehouse(
        auth,
        order.warehouseId
      );
    } else if (!isSuperAdmin(auth)) {
      // Matches the order list, which shows warehouse staff only their warehouses' orders.
      throw new ForbiddenException("Admin is not assigned to this warehouse.");
    }

    return order;
  }

  private async findCustomerOrder(
    client: OrderClient,
    customerId: string,
    orderId: string
  ) {
    const order = await client.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId,
        userId: customerId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    return order;
  }

  private async findOrderById(client: OrderClient, orderId: string) {
    const order = await client.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    return order;
  }

  private async findOrderByCheckoutIdempotencyKey(
    client: OrderClient,
    customerId: string,
    checkoutIdempotencyKey: string
  ) {
    return client.order.findFirst({
      include: ORDER_INCLUDE,
      where: {
        checkoutIdempotencyKey,
        deletedAt: null,
        userId: customerId
      }
    });
  }

  private assertAllowedStatusTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus
  ) {
    const allowedStatuses = STATUS_TRANSITIONS[currentStatus];

    if (!allowedStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Order cannot move from ${currentStatus} to ${nextStatus}.`
      );
    }
  }

  private shouldGenerateInvoiceAfterStatusUpdate(order: OrderRecord) {
    const paymentMethod = order.payments[0]?.method ?? null;

    return (
      paymentMethod !== PaymentMethod.ONLINE ||
      order.paymentStatus === PaymentStatus.PAID
    );
  }

  private async clearReservedInventoryForDeliveredOrder(
    tx: Prisma.TransactionClient,
    order: OrderRecord
  ) {
    for (const item of order.items) {
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

  private async releaseReservedInventoryForCancelledOrder(
    tx: Prisma.TransactionClient,
    order: OrderRecord
  ) {
    for (const item of order.items) {
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
          availableQuantity: {
            increment: item.quantity
          },
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

      if (item.stockBatchId !== null) {
        await tx.stockBatch.updateMany({
          data: {
            quantity: {
              increment: item.quantity
            }
          },
          where: {
            id: item.stockBatchId
          }
        });
      }

      await tx.stockMovement.create({
        data: {
          metadata: toJsonValue({
            orderNumber: order.orderNumber
          }),
          productId: item.productId,
          quantity: item.quantity,
          referenceId: order.id,
          referenceType: "ORDER_CANCEL",
          stockBatchId: item.stockBatchId,
          type: StockMovementType.RETURN,
          variantId: item.variantId,
          warehouseId: item.warehouseId
        }
      });
    }
  }

  private async claimOrderCancellation(tx: Prisma.TransactionClient, order: OrderRecord) {
    const claim = await tx.order.updateMany({
      data: { status: OrderStatus.CANCELLED },
      where: { id: order.id, deletedAt: null, status: order.status }
    });
    if (claim.count !== 1) throw new ConflictException("Order status changed. Refresh before cancelling.");
    // Read after acquiring the order lock so a concurrent pickup cannot release stock.
    const current = await tx.order.findFirst({ where: { id: order.id }, include: ORDER_INCLUDE });
    if (!current || current.deliveryAssignments.some((assignment) =>
      assignment.status === DeliveryStatus.PICKED_UP || assignment.status === DeliveryStatus.OUT_FOR_DELIVERY
    )) {
      throw new ConflictException("This order has already been picked up and cannot be cancelled.");
    }
    order.deliveryAssignments = current.deliveryAssignments;
  }

  // Returns the notifications to queue once the transaction has committed, so
  // a rolled-back cancellation never notifies a delivery partner.
  private async cancelActiveDeliveryAssignments(
    tx: Prisma.TransactionClient,
    order: OrderRecord,
    reason?: string
  ) {
    const notifications: PendingDeliveryNotification[] = [];

    for (const assignment of order.deliveryAssignments) {
      if (
        assignment.status === DeliveryStatus.CANCELLED ||
        assignment.status === DeliveryStatus.DELIVERED ||
        assignment.status === DeliveryStatus.FAILED
      ) {
        continue;
      }

      await tx.deliveryAssignment.update({
        data: {
          failureReason: reason,
          status: DeliveryStatus.CANCELLED
        },
        where: {
          id: assignment.id
        }
      });
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryAssignmentId: assignment.id,
          note: reason,
          status: DeliveryStatus.CANCELLED
        }
      });
      if (this.queueService) {
        const notification = await tx.notificationLog.create({
          data: {
            channel: "delivery_partner",
            payload: {
              assignmentId: assignment.id,
              body: `Order ${order.orderNumber} is no longer assigned to you.`,
              readAt: null,
              title: "Delivery cancelled",
              type: "ASSIGNMENT_CANCELLED"
            },
            recipient: assignment.deliveryPartnerId,
            status: "PENDING",
            templateKey: "delivery_assignment_cancelled"
          }
        });
        notifications.push({
          assignmentId: assignment.id,
          deliveryPartnerId: assignment.deliveryPartnerId,
          notificationId: notification.id,
          orderNumber: order.orderNumber
        });
      }
    }

    return notifications;
  }

  private async sendDeliveryCancellationNotifications(
    notifications: PendingDeliveryNotification[]
  ) {
    for (const notification of notifications) {
      try {
        await this.queueService?.enqueueDeliveryAssignmentNotification({
          assignmentId: notification.assignmentId,
          body: `Order ${notification.orderNumber} is no longer assigned to you.`,
          deliveryPartnerId: notification.deliveryPartnerId,
          notificationId: notification.notificationId,
          requestedAt: new Date().toISOString(),
          title: "Delivery cancelled",
          version: 1
        });
      } catch {
        await this.prisma.notificationLog
          .update({
            data: { status: "QUEUE_FAILED" },
            where: { id: notification.notificationId }
          })
          .catch(() => undefined);
      }
    }
  }

  private async buildScopedWarehouseFilter(
    warehouseId: string | undefined,
    auth: AuthJwtPayload
  ) {
    if (warehouseId !== undefined) {
      await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
      return warehouseId;
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);

    return scope.allWarehouses
      ? undefined
      : {
          in: scope.warehouseIds
        };
  }

  private async generateOrderNumber(client: OrderClient) {
    const date = new Date();
    const datePart = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `ORD-${datePart}-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;
      const existing = await client.order.count({
        where: {
          orderNumber: candidate
        }
      });

      if (existing === 0) {
        return candidate;
      }
    }

    throw new BadRequestException("Could not generate a unique order number.");
  }

  private serializeOrder(order: OrderRecord) {
    return {
      createdAt: order.createdAt,
      billingAddress: serializeAddress(order.billingAddress),
      customer: {
        businessName: order.user.businessName,
        email: order.user.email,
        firstName: order.user.firstName,
        gstNumber: order.user.gstNumber,
        id: order.user.id,
        lastName: order.user.lastName,
        mobileNumber: order.user.mobileNumber
      },
      id: order.id,
      deliveryTracking: order.deliveryAssignments.map((assignment) => ({
        assignedAt: assignment.assignedAt,
        deliveredAt: assignment.deliveredAt,
        deliveryPartnerName: assignment.deliveryPartner?.fullName ?? null,
        failureReason: assignment.failureReason,
        id: assignment.id,
        pickedUpAt: assignment.pickedUpAt,
        proofOfDeliveryUrl:
          signPrivateFileUrl(assignment.proofOfDeliveryKey) ?? assignment.proofOfDeliveryUrl,
        status: assignment.status,
        statusHistory: assignment.statusHistory.map((entry) => ({
          createdAt: entry.createdAt,
          id: entry.id,
          latitude: decimalToNullableNumber(entry.latitude),
          longitude: decimalToNullableNumber(entry.longitude),
          note: entry.note,
          status: entry.status
        })),
        vehicleNumber: assignment.deliveryPartner?.vehicleNumber ?? null
      })),
      invoice: order.gstInvoice
        ? {
            id: order.gstInvoice.id,
            invoiceNumber: order.gstInvoice.invoiceNumber,
            issuedAt: order.gstInvoice.issuedAt,
            pdfStatus: order.gstInvoice.pdfStatus,
            taxBreakup: {
              cgst: decimalToNumber(order.gstInvoice.cgstTotal),
              igst: decimalToNumber(order.gstInvoice.igstTotal),
              sgst: decimalToNumber(order.gstInvoice.sgstTotal),
              taxType: order.gstInvoice.taxType
            },
            totals: {
              deliveryCharge: decimalToNumber(order.gstInvoice.shippingTotal),
              discount: decimalToNumber(order.gstInvoice.discountTotal),
              grandTotal: decimalToNumber(order.gstInvoice.grandTotal),
              subtotal: decimalToNumber(order.gstInvoice.subtotal),
              tax: decimalToNumber(order.gstInvoice.taxTotal)
            }
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.name,
        productId: item.productId,
        quantity: item.quantity,
        sku: item.sku,
        stockBatchId: item.stockBatchId,
        taxAmount: decimalToNumber(item.taxAmount),
        taxRate: decimalToNumber(item.taxRate),
        total: decimalToNumber(item.total),
        unitPrice: decimalToNumber(item.unitPrice),
        variantId: item.variantId,
        warehouseId: item.warehouseId
      })),
      orderNumber: order.orderNumber,
      paymentDetails: order.payments.map((payment) => ({
        amount: decimalToNumber(payment.amount),
        createdAt: payment.createdAt,
        id: payment.id,
        method: payment.method,
        paidAt: payment.paidAt,
        provider: payment.provider,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        status: payment.status,
        transactionRef: payment.transactionRef
      })),
      paymentMethod: order.payments[0]?.method ?? null,
      paymentStatus: order.paymentStatus,
      placedAt: order.placedAt,
      refunds: order.refunds.map((refund) => ({
        amount: decimalToNumber(refund.amount),
        createdAt: refund.createdAt,
        id: refund.id,
        processedAt: refund.processedAt,
        providerRefundId: refund.providerRefundId,
        reason: refund.reason,
        status: refund.status
      })),
      shippingAddress: serializeAddress(order.shippingAddress),
      status: order.status,
      statusHistory: order.statusHistory.map((entry) => ({
        changedById: entry.changedById,
        createdAt: entry.createdAt,
        id: entry.id,
        note: entry.note,
        status: entry.status
      })),
      totals: {
        deliveryCharge: decimalToNumber(order.shippingTotal),
        discount: decimalToNumber(order.discountTotal),
        grandTotal: decimalToNumber(order.grandTotal),
        subtotal: decimalToNumber(order.subtotal),
        tax: decimalToNumber(order.taxTotal)
      },
      updatedAt: order.updatedAt,
      warehouse: order.warehouse
        ? {
            code: order.warehouse.code,
            id: order.warehouse.id,
            name: order.warehouse.name
          }
        : null,
      warehouseId: order.warehouseId
    };
  }

  private serializeOrderSummary(order: OrderSummaryRecord) {
    return this.serializeOrder(order as unknown as OrderRecord);
  }
}

function sortBatchesForAllocation<
  T extends { createdAt?: Date; expiryDate: Date | null; id: string }
>(batches: T[]) {
  return [...batches].sort((left, right) => {
    if (left.expiryDate !== null && right.expiryDate !== null) {
      const expiryDifference = left.expiryDate.getTime() - right.expiryDate.getTime();

      if (expiryDifference !== 0) {
        return expiryDifference;
      }
    } else if (left.expiryDate !== null) {
      return -1;
    } else if (right.expiryDate !== null) {
      return 1;
    }

    const createdDifference =
      (left.createdAt?.getTime() ?? 0) - (right.createdAt?.getTime() ?? 0);

    return createdDifference === 0
      ? left.id.localeCompare(right.id)
      : createdDifference;
  });
}

function buildAllocationTotals(line: FulfillmentLine, quantity: number) {
  const subtotal = roundMoney(line.unitPrice * quantity);
  const tax = roundMoney(subtotal * (line.taxRate / 100));

  return {
    subtotal,
    tax,
    total: roundMoney(subtotal + tax)
  };
}

function calculateTotals(
  items: Array<{
    subtotal: number;
    tax: number;
    total: number;
  }>
) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0));
  const tax = roundMoney(items.reduce((sum, item) => sum + item.tax, 0));
  const discount = 0;
  const deliveryCharge = 0;

  return {
    deliveryCharge,
    discount,
    grandTotal: roundMoney(subtotal + tax + deliveryCharge - discount),
    subtotal,
    tax
  };
}

function stockUnavailableMessage(line: FulfillmentLine, availableQuantity: number) {
  if (availableQuantity > 0) {
    return `Only ${availableQuantity} unit(s) are available for ${line.name}. Please update your cart quantity.`;
  }

  return `${line.name} is out of stock. Please remove it from your cart.`;
}

function quoteOrderNote(input: CreateQuoteOrderInput) {
  return [`Created from quote ${input.quoteId}.`, input.notes]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function mergeOrderItemsForReorder(items: OrderRecord["items"]) {
  const merged = new Map<
    string,
    {
      productId: string;
      quantity: number;
      variantId: string | null;
    }
  >();

  for (const item of items) {
    if (!item.productId) {
      throw new BadRequestException(
        "Custom quote items cannot be reordered into cart."
      );
    }

    const key = `${item.productId}:${item.variantId ?? "base"}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(key, {
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId
      });
    }
  }

  return [...merged.values()];
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

function decimalToNullableNumber(value: DecimalValue | null) {
  return value === null ? null : decimalToNumber(value);
}

function buildCustomerMobileFilter(customerMobile: string | undefined) {
  const mobile = customerMobile?.trim();

  if (!mobile) {
    return undefined;
  }

  return {
    mobileNumber: {
      contains: mobile
    }
  };
}

function appendRefundNote(reason: string | null, note: string) {
  if (!reason) {
    return note;
  }

  return `${reason} Rejection note: ${note}`;
}

function buildDateRangeFilter(dateFrom?: string, dateTo?: string) {
  const gte = parseDateBoundary(dateFrom, "start");
  const lte = parseDateBoundary(dateTo, "end");

  if (!gte && !lte) {
    return undefined;
  }

  return stripUndefined({
    gte,
    lte
  });
}

function buildInsensitiveContainsFilter(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  return {
    contains: trimmed,
    mode: "insensitive" as const
  };
}

function parseDateBoundary(value: string | undefined, boundary: "end" | "start") {
  if (!value) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    if (!year || !month || !day) {
      return undefined;
    }

    return boundary === "start"
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

type SerializedOrder = ReturnType<OrdersService["serializeOrder"]>;

const RETURN_APPROVED_NOTE = "Return request approved.";

function isExpirableUnpaidOrder(order: OrderRecord) {
  return (
    order.status === OrderStatus.CREATED &&
    UNPAID_ORDER_STATUSES.has(order.paymentStatus) &&
    order.payments.some((payment) => payment.method === PaymentMethod.ONLINE) &&
    !order.payments.some(
      (payment) =>
        payment.status === PaymentStatus.PAID ||
        payment.status === PaymentStatus.AUTHORIZED
    )
  );
}

function hasPaidPayment(order: SerializedOrder) {
  return order.paymentDetails.some((payment) => payment.status === PaymentStatus.PAID);
}

function orderEmailContact(order: SerializedOrder): CustomerEmailContact {
  return {
    customerId: order.customer.id,
    email: order.customer.email,
    firstName: order.customer.firstName
  };
}

function orderReceivedEmail(order: SerializedOrder): CustomerEmailEvent {
  return {
    deliveryAddress: emailAddress(order.shippingAddress),
    discountTotal: emailMoney(order.totals.discount),
    grandTotal: emailMoney(order.totals.grandTotal),
    // Line amounts exclude tax so they add up to the subtotal row.
    items: emailLineItems(
      order.items.map((item) => ({
        lineTotal: item.total - item.taxAmount,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    ),
    orderId: order.id,
    orderNumber: order.orderNumber,
    payment:
      order.paymentMethod === PaymentMethod.COD
        ? "COD"
        : order.paymentStatus === PaymentStatus.PAID
          ? "ONLINE_PAID"
          : "ONLINE_PENDING",
    placedAt: (order.placedAt ?? order.createdAt).toISOString(),
    shippingTotal: emailMoney(order.totals.deliveryCharge),
    subtotal: emailMoney(order.totals.subtotal),
    taxTotal: emailMoney(order.totals.tax),
    template: "order-received"
  };
}

function serializeAddress(address: NonNullable<OrderRecord["shippingAddress"]> | null) {
  return address
    ? {
        city: address.city,
        country: address.country,
        fullName: address.fullName,
        id: address.id,
        line1: address.line1,
        line2: address.line2,
        mobileNumber: address.mobileNumber,
        pincode: address.pincode,
        state: address.state
      }
    : null;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeCheckoutIdempotencyKey(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : null;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
