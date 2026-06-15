import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ApiQueueService } from "../../queues/api-queue.service";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  StockMovementType,
  WarehouseStatus
} from "../../generated/prisma/client";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";
import type {
  AdminOrderListQueryDto,
  CancelOrderDto,
  CreateOrderDto,
  OrderListQueryDto,
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
  gstInvoice: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
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
  gstInvoice: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
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

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED],
  [OrderStatus.PACKED]: [OrderStatus.ASSIGNED],
  [OrderStatus.ASSIGNED]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: []
};

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };
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
      | "inventoryStock"
      | "order"
      | "orderItem"
      | "orderStatusHistory"
      | "payment"
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

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly queueService?: ApiQueueService
  ) {}

  async createOrder(customerId: string, input: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
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
      const lines = cart.items.map((item) => this.buildFulfillmentLine(item));
      const allocations = await this.reserveInventory(tx, lines);
      const primaryWarehouseId = allocations[0]?.warehouseId ?? null;
      const totals = calculateTotals(
        allocations.map((allocation) =>
          buildAllocationTotals(allocation.line, allocation.quantity)
        )
      );
      const order = await tx.order.create({
        data: {
          billingAddressId: billingAddress.id,
          discountTotal: totals.discount,
          grandTotal: totals.grandTotal,
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
          amount: totals.grandTotal,
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

      if (input.paymentMethod === PaymentMethod.COD) {
        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id
          }
        });
      }

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });

    await this.queueService?.enqueueOrderConfirmation({
      customerId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      requestedAt: new Date().toISOString(),
      version: 1
    });

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

  async listAdminOrders(query: AdminOrderListQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      createdAt: buildDateRangeFilter(query.dateFrom, query.dateTo),
      deletedAt: null,
      orderNumber: buildInsensitiveContainsFilter(query.orderNumber),
      paymentStatus: query.paymentStatus,
      status: query.status,
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

  async getAdminOrder(orderId: string, auth: AuthJwtPayload) {
    const order = await this.findAdminOrder(orderId, auth);

    return this.serializeOrder(order);
  }

  async updateStatus(
    orderId: string,
    input: UpdateOrderStatusDto,
    context: AdminActionContext
  ) {
    if (input.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Use the cancel endpoint to cancel orders.");
    }

    let invoiceOrderId: string | null = null;
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await this.findAdminOrder(orderId, context.auth, tx);
      this.assertAllowedStatusTransition(order.status, input.status);

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

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    return updatedOrder;
  }

  async cancelOrder(
    orderId: string,
    input: CancelOrderDto,
    context: AdminActionContext
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findAdminOrder(orderId, context.auth, tx);

      if (!CANCELLABLE_STATUSES.has(order.status)) {
        throw new BadRequestException("Order cannot be cancelled in its current status.");
      }

      await this.releaseReservedInventoryForCancelledOrder(tx, order);
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

      return this.serializeOrder(await this.findOrderById(tx, order.id));
    });
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
    const name = variantName ? `${item.product.name} - ${variantName}` : item.product.name;
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
    const stocks = await tx.inventoryStock.findMany({
      orderBy: [{ warehouseId: "asc" }, { id: "asc" }],
      select: {
        availableQuantity: true,
        id: true,
        warehouseId: true
      },
      where: {
        availableQuantity: {
          gt: 0
        },
        productId: line.productId,
        variantId: line.variantId,
        warehouse: {
          deletedAt: null,
          status: WarehouseStatus.ACTIVE
        }
      }
    });

    return stocks.map((stock) => ({
      availableQuantity: stock.availableQuantity,
      stockId: stock.id,
      warehouseId: stock.warehouseId
    }));
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
>(
  batches: T[]
) {
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

    return createdDifference === 0 ? left.id.localeCompare(right.id) : createdDifference;
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
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.subtotal, 0)
  );
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

function serializeAddress(
  address: NonNullable<OrderRecord["shippingAddress"]> | null
) {
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
