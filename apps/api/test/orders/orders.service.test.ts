import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { AdminJwtGuard } from "../../src/modules/auth/guards/admin-jwt.guard";
import { CustomerJwtGuard } from "../../src/modules/auth/guards/customer-jwt.guard";
import { PermissionGuard } from "../../src/modules/auth/guards/permission.guard";
import type { ApiQueueService } from "../../src/queues/api-queue.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import { AdminOrdersController } from "../../src/modules/orders/admin-orders.controller";
import type { CartService } from "../../src/modules/cart/cart.service";
import { OrdersController } from "../../src/modules/orders/orders.controller";
import { OrdersService } from "../../src/modules/orders/orders.service";
import { AdminOrderListQueryDto } from "../../src/modules/orders/dto/order.dto";
import { DeliveryChargesService } from "../../src/modules/delivery-charges/delivery-charges.service";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

const now = new Date("2026-05-25T10:00:00.000Z");
const todayOrderPrefix = buildTodayNumberPrefix("ORD");

function adminAuth(role = AdminRoleCode.OrderManager): AuthJwtPayload {
  return {
    audience: AuthTokenAudience.Admin,
    permissions: [],
    role,
    sessionId: "admin-session-1",
    sub: "admin-1",
    tokenType: "access"
  };
}

function buildTodayNumberPrefix(prefix: string) {
  const date = new Date();
  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");

  return `${prefix}-${datePart}`;
}

class FakeWarehouseAccess {
  readonly assertedWarehouseIds: string[] = [];

  constructor(private readonly scopeWarehouseIds: string[] = ["warehouse-1"]) {}

  async assertCanManageWarehouse(_auth: AuthJwtPayload, warehouseId: string) {
    this.assertedWarehouseIds.push(warehouseId);
  }

  async getWarehouseScope(auth: AuthJwtPayload) {
    if (auth.role === AdminRoleCode.SuperAdmin) {
      return {
        allWarehouses: true as const
      };
    }

    return {
      allWarehouses: false as const,
      warehouseIds: this.scopeWarehouseIds
    };
  }
}

class FakeOrderQueue {
  readonly invoiceJobs: unknown[] = [];
  readonly notificationJobs: unknown[] = [];

  async enqueueInvoice(data: unknown) {
    this.invoiceJobs.push(data);
  }

  async enqueueOrderConfirmation(data: unknown) {
    this.notificationJobs.push(data);
  }

  async generateForConfirmedOrder() {
    return {
      id: "invoice-sync-fallback"
    };
  }
}

class FakeReorderCartService {
  readonly replaceWithItemsCalls: Array<{
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      variantId: string | null;
    }>;
  }> = [];

  async replaceWithItems(
    customerId: string,
    items: Array<{
      productId: string;
      quantity: number;
      variantId: string | null;
    }>
  ) {
    this.replaceWithItemsCalls.push({ customerId, items });

    return {
      id: "cart-1",
      itemCount: items.length,
      items: [],
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totals: {
        deliveryCharge: 0,
        discount: 0,
        grandTotal: 0,
        subtotal: 0,
        tax: 0
      },
      updatedAt: now
    };
  }
}

class FakeRefundProcessor {
  readonly orderIds: string[] = [];

  async processPendingOrderRefund(orderId: string) {
    this.orderIds.push(orderId);

    return {
      id: "refund-1",
      orderId,
      status: "COMPLETED"
    };
  }
}

class FakeDeliveryChargesService {
  readonly calls: unknown[] = [];

  constructor(private readonly deliveryCharge = 75) {}

  async calculateDeliveryCharge(input: unknown) {
    this.calls.push(input);

    return {
      deliveryCharge: this.deliveryCharge,
      rule: {
        id: "rule-1",
        name: "Delhi delivery"
      }
    };
  }
}

test("checkout preserves accepted catalog quote prices, tax and shipping in the order and payment", async () => {
  const prisma = createOrdersPrismaMock({ quotation: { payload: {
    customerDecision: { status: "ACCEPTED" },
    quotation: { items: [{ productId: "product-1", variantId: null, quantity: 2, unitPrice: 100.25, taxRate: 5 }], validUntil: null, totals: { shippingTotal: 25.5 } }
  } } });
  const service = new OrdersService(prisma as unknown as PrismaService, new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService);
  const order = await service.createOrder("customer-1", { paymentMethod: "COD", shippingAddressId: "address-1" });
  assert.equal(order.totals.grandTotal, 236.03);
  assert.equal(order.items[0]?.unitPrice, 100.25);
  assert.equal(order.items[0]?.taxRate, 5);
  assert.equal((prisma.calls.paymentCreate[0] as { data: { amount: number } }).data.amount, 236.03);
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 1);
});

test("expired accepted quotations cannot silently proceed at catalog prices", async () => {
  const prisma = createOrdersPrismaMock({ quotation: { payload: {
    customerDecision: { status: "ACCEPTED" },
    quotation: { items: [{ productId: "product-1", variantId: null, quantity: 2, unitPrice: 100, taxRate: 5 }], validUntil: "2000-01-01", totals: { shippingTotal: 0 } }
  } } });
  const service = new OrdersService(prisma as unknown as PrismaService, new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService);
  await assert.rejects(service.createOrder("customer-1", { paymentMethod: "COD", shippingAddressId: "address-1" }), /quotation has expired/);
  assert.equal(prisma.calls.orderCreate.length, 0);
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 0);
});

test("custom quote order retries return one order and mixed catalog lines reserve stock", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(prisma as unknown as PrismaService, new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService);
  const input = { quoteId: "quote-retry", notes: null, totals: { subtotal: 250.5, taxTotal: 10.03, shippingTotal: 25.5, grandTotal: 286.03 }, items: [
    { productId: null, variantId: null, name: "Custom kit", sku: "CUSTOM", quantity: 1, unitPrice: 50, taxRate: 0, taxAmount: 0, lineSubtotal: 50, lineTotal: 50 },
    { productId: "product-1", variantId: null, name: "Catalog forceps", sku: "FORCEPS", quantity: 2, unitPrice: 100.25, taxRate: 5, taxAmount: 10.03, lineSubtotal: 200.5, lineTotal: 210.53 }
  ] };
  const first = await service.createOrderFromQuote("customer-1", input);
  const retry = await service.createOrderFromQuote("customer-1", input);
  assert.equal(retry.id, first.id);
  assert.equal(first.totals.grandTotal, 286.03);
  assert.equal(prisma.calls.orderCreate.length, 1);
  assert.equal(prisma.calls.paymentCreate.length, 1);
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 1);
  assert.equal(prisma.calls.stockMovementCreate.length, 1);
  assert.equal(prisma.calls.orderItemCreate.length, 2);
});

function createOrdersPrismaMock(input?: {
  quotation?: { payload: unknown };
  batchQuantity?: number;
  couponIsActive?: boolean;
  couponUsageLimit?: number | null;
  couponUsedCount?: number;
  couponUsedCountAtClaim?: number;
  existingOrderItems?: Array<{
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    stockBatchId: string | null;
    total: number | string;
    unitPrice: number | string;
    variantId?: string | null;
    warehouseId: string | null;
  }>;
  orderStatus?: string;
  paymentStatus?: string;
  splitWarehouseStock?: boolean;
  stockAvailable?: number;
}) {
  const calls: Record<string, unknown[]> = {
    cartFindFirst: [],
    cartItemDeleteMany: [],
    couponFindFirst: [],
    couponUpdateMany: [],
    deliveryAssignmentUpdate: [],
    deliveryStatusHistoryCreate: [],
    inventoryStockFindMany: [],
    inventoryStockFindFirst: [],
    inventoryStockUpdateMany: [],
    orderCount: [],
    orderCreate: [],
    orderFindFirst: [],
    orderFindMany: [],
    orderItemCreate: [],
    orderUpdate: [],
    paymentCreate: [],
    refundCreate: [],
    refundFindFirst: [],
    refundUpdate: [],
    stockBatchFindMany: [],
    stockBatchUpdateMany: [],
    stockMovementCreate: [],
    statusHistoryCreate: [],
    userFindFirst: [],
    addressFindFirst: [],
    warehouseFindMany: []
  };
  const orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    stockBatchId: string | null;
    total: number | string;
    unitPrice: number | string;
    variantId?: string | null;
    warehouseId: string | null;
  }> = [...(input?.existingOrderItems ?? [])];
  const statusHistory: Array<{
    changedById: string | null;
    createdAt: Date;
    id: string;
    note: string | null;
    orderId: string;
    status: string;
  }> = [];
  const orders: Array<Record<string, unknown>> = [];
  const stockAvailable = input?.stockAvailable ?? 10;
  const batchQuantity = input?.batchQuantity ?? 10;
  const splitWarehouseStock = input?.splitWarehouseStock ?? false;
  const warehouses = splitWarehouseStock
    ? [
        {
          address: "Warehouse Road",
          city: "Delhi",
          code: "DEL-01",
          contactNumber: "9876543210",
          contactPerson: "Warehouse Lead",
          id: "warehouse-1",
          name: "Delhi warehouse",
          pincode: "110001",
          state: "Delhi",
          status: "ACTIVE"
        },
        {
          address: "Warehouse Avenue",
          city: "Mumbai",
          code: "MUM-01",
          contactNumber: "9876543211",
          contactPerson: "Warehouse Lead",
          id: "warehouse-2",
          name: "Mumbai warehouse",
          pincode: "400001",
          state: "Maharashtra",
          status: "ACTIVE"
        }
      ]
    : [
        {
          address: "Warehouse Road",
          city: "Delhi",
          code: "DEL-01",
          contactNumber: "9876543210",
          contactPerson: "Warehouse Lead",
          id: "warehouse-1",
          name: "Delhi warehouse",
          pincode: "110001",
          state: "Delhi",
          status: "ACTIVE"
        }
      ];
  const cartItems = splitWarehouseStock
    ? [
        {
          id: "cart-item-1",
          productId: "product-1",
          quantity: 2,
          variantId: null,
          product: {
            deletedAt: null,
            id: "product-1",
            name: "Curved Artery Forceps",
            sellingPrice: "120.00",
            sku: "FORCEPS-001",
            status: "ACTIVE",
            taxRate: "18.00"
          },
          variant: null
        },
        {
          id: "cart-item-2",
          productId: "product-2",
          quantity: 3,
          variantId: null,
          product: {
            deletedAt: null,
            id: "product-2",
            name: "Sterile Surgical Drapes",
            sellingPrice: "80.00",
            sku: "DRAPE-001",
            status: "ACTIVE",
            taxRate: "12.00"
          },
          variant: null
        }
      ]
    : [
        {
          id: "cart-item-1",
          productId: "product-1",
          quantity: 2,
          variantId: null,
          product: {
            deletedAt: null,
            id: "product-1",
            name: "Curved Artery Forceps",
            sellingPrice: "120.00",
            sku: "FORCEPS-001",
            status: "ACTIVE",
            taxRate: "18.00"
          },
          variant: null
        }
      ];
  const inventoryStocks = splitWarehouseStock
    ? [
        {
          availableQuantity: 2,
          id: "stock-1",
          productId: "product-1",
          reservedQuantity: 0,
          variantId: null,
          warehouseId: "warehouse-1"
        },
        {
          availableQuantity: 3,
          id: "stock-2",
          productId: "product-2",
          reservedQuantity: 0,
          variantId: null,
          warehouseId: "warehouse-2"
        }
      ]
    : [
        {
          availableQuantity: stockAvailable,
          id: "stock-1",
          productId: "product-1",
          reservedQuantity: 0,
          variantId: null,
          warehouseId: "warehouse-1"
        }
      ];
  const stockBatches = splitWarehouseStock
    ? [
        {
          batchNumber: "BATCH-1",
          expiryDate: new Date("2026-07-01T00:00:00.000Z"),
          id: "batch-1",
          productId: "product-1",
          quantity: 2,
          variantId: null,
          warehouseId: "warehouse-1"
        },
        {
          batchNumber: "BATCH-2",
          expiryDate: new Date("2026-08-01T00:00:00.000Z"),
          id: "batch-2",
          productId: "product-2",
          quantity: 3,
          variantId: null,
          warehouseId: "warehouse-2"
        }
      ]
    : [
        {
          batchNumber: "BATCH-1",
          expiryDate: new Date("2026-07-01T00:00:00.000Z"),
          id: "batch-1",
          productId: "product-1",
          quantity: batchQuantity,
          variantId: null,
          warehouseId: "warehouse-1"
        }
      ];
  const cart = {
    deletedAt: null,
    id: "cart-1",
    items: cartItems,
    userId: "customer-1"
  };
  const address = {
    city: "Delhi",
    country: "India",
    deletedAt: null,
    fullName: "Ritika Singh",
    id: "address-1",
    line1: "Clinic Road",
    line2: null,
    mobileNumber: "9999999999",
    pincode: "110001",
    state: "Delhi",
    userId: "customer-1"
  };
  const customer = {
    businessName: "Ritika Surgical Clinic",
    email: "ritika@example.com",
    firstName: "Ritika",
    gstNumber: "27ABCDE1234F1Z5",
    id: "customer-1",
    lastName: "Singh",
    mobileNumber: "9999999999"
  };
  const warehouse = warehouses[0];
  const payments = [
    {
      amount: "283.20",
      createdAt: now,
      id: "payment-1",
      method: "COD",
      paidAt: null,
      provider: null,
      providerOrderId: null,
      providerPaymentId: null,
      status: "PENDING",
      transactionRef: "COD-order-1",
      updatedAt: now
    }
  ];
  const refunds: Array<{
    amount: number | string;
    createdAt: Date;
    id: string;
    paymentId: string | null;
    processedAt: Date | null;
    providerRefundId: string | null;
    reason: string | null;
    status: string;
    updatedAt: Date;
  }> = [];
  const deliveryStatusHistory = [
    {
      createdAt: now,
      id: "delivery-history-1",
      latitude: "28.613939",
      longitude: "77.209023",
      note: "Assigned to delivery partner.",
      status: "ASSIGNED",
      updatedAt: now
    }
  ];
  const deliveryAssignments = [
    {
      assignedAt: now,
      createdAt: now,
      deliveredAt: null,
      deliveryPartner: {
        fullName: "Asha Driver",
        id: "partner-1",
        vehicleNumber: "DL01AB1234"
      },
      deliveryPartnerId: "partner-1",
      failureReason: null,
      id: "assignment-1",
      orderId: "order-1",
      pickedUpAt: null,
      proofOfDeliveryUrl: null,
      status: "ASSIGNED",
      statusHistory: deliveryStatusHistory,
      updatedAt: now
    }
  ];
  const coupon = {
    code: "SURGICAL10",
    createdAt: now,
    deletedAt: null,
    expiresAt: new Date("2026-12-31T23:59:59.999Z"),
    id: "coupon-1",
    isActive: input?.couponIsActive ?? true,
    maxDiscount: "50.00",
    minOrderAmount: "200.00",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    type: "PERCENTAGE",
    updatedAt: now,
    usageLimit: input?.couponUsageLimit === undefined ? 100 : input.couponUsageLimit,
    usedCount: input?.couponUsedCount ?? 0,
    value: "10.00"
  };
  const invoice = {
    cgstTotal: "21.60",
    discountTotal: "0.00",
    grandTotal: "283.20",
    id: "invoice-1",
    igstTotal: "0.00",
    invoiceNumber: "INV-20260525-000001",
    issuedAt: now,
    pdfStatus: "NOT_GENERATED",
    sgstTotal: "21.60",
    shippingTotal: "0.00",
    subtotal: "240.00",
    taxTotal: "43.20",
    taxType: "CGST_SGST"
  };
  const prisma = {
    calls,
    notificationLog: { findFirst: async () => input?.quotation ?? null },
    product: { findFirst: async () => ({ id: "product-1", status: "ACTIVE" }) },
    productVariant: { findFirst: async () => ({ id: "variant-1", status: "ACTIVE" }) },
    $transaction: async <T>(callback: (tx: typeof prisma) => Promise<T>) =>
      callback(prisma),
    address: {
      findFirst: async (args: unknown) => {
        calls.addressFindFirst.push(args);
        return address;
      }
    },
    cart: {
      findFirst: async (args: unknown) => {
        calls.cartFindFirst.push(args);
        return cart;
      }
    },
    cartItem: {
      deleteMany: async (args: unknown) => {
        calls.cartItemDeleteMany.push(args);
        return { count: cart.items.length };
      }
    },
    coupon: {
      fields: { usageLimit: { modelName: "Coupon", name: "usageLimit" } },
      findFirst: async (args: unknown) => {
        calls.couponFindFirst.push(args);
        return { ...coupon };
      },
      updateMany: async (args: { data: { usedCount?: { increment?: number } } }) => {
        calls.couponUpdateMany.push(args);
        if (input?.couponUsedCountAtClaim !== undefined) {
          coupon.usedCount = input.couponUsedCountAtClaim;
        }
        if (
          !coupon.isActive ||
          (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
        ) {
          return { count: 0 };
        }
        coupon.usedCount += args.data.usedCount?.increment ?? 0;
        return { count: 1 };
      }
    },
    inventoryStock: {
      findMany: async (args: unknown) => {
        calls.inventoryStockFindMany.push(args);
        const where = (args as {
          where?: {
            availableQuantity?: { gt?: number; gte?: number };
            productId?: string;
            variantId?: string | null;
            warehouseId?: string;
          };
        }).where ?? {};
        const minimum =
          where.availableQuantity?.gt ?? where.availableQuantity?.gte ?? -1;

        return inventoryStocks
          .filter(
            (stock) =>
              (where.productId === undefined || stock.productId === where.productId) &&
              (!("variantId" in where) || stock.variantId === where.variantId) &&
              (where.warehouseId === undefined ||
                stock.warehouseId === where.warehouseId) &&
              stock.availableQuantity > minimum
          )
          .sort((left, right) =>
            left.warehouseId === right.warehouseId
              ? left.id.localeCompare(right.id)
              : left.warehouseId.localeCompare(right.warehouseId)
          );
      },
      findFirst: async (args: unknown) => {
        calls.inventoryStockFindFirst.push(args);
        const where = (args as {
          where?: {
            availableQuantity?: { gte?: number };
            productId?: string;
            variantId?: string | null;
            warehouseId?: string;
          };
        }).where ?? {};

        return (
          inventoryStocks.find(
            (stock) =>
              (where.productId === undefined || stock.productId === where.productId) &&
              (!("variantId" in where) || stock.variantId === where.variantId) &&
              (where.warehouseId === undefined ||
                stock.warehouseId === where.warehouseId) &&
              stock.availableQuantity >= (where.availableQuantity?.gte ?? 0)
          ) ?? null
        );
      },
      updateMany: async (args: unknown) => {
        calls.inventoryStockUpdateMany.push(args);
        const updateArgs = args as {
          data: {
            availableQuantity?: { decrement?: number; increment?: number };
            reservedQuantity?: { decrement?: number; increment?: number };
          };
          where: {
            availableQuantity?: { gte?: number };
            id?: string;
            productId?: string;
            reservedQuantity?: { gte?: number };
            variantId?: string | null;
            warehouseId?: string;
          };
        };
        const stock = inventoryStocks.find(
          (entry) =>
            (updateArgs.where.id === undefined ||
              entry.id === updateArgs.where.id) &&
            (updateArgs.where.productId === undefined ||
              entry.productId === updateArgs.where.productId) &&
            (!("variantId" in updateArgs.where) ||
              entry.variantId === updateArgs.where.variantId) &&
            (updateArgs.where.warehouseId === undefined ||
              entry.warehouseId === updateArgs.where.warehouseId)
        );
        const requiredAvailable = updateArgs.where.availableQuantity?.gte ?? 0;
        const requiredReserved = updateArgs.where.reservedQuantity?.gte ?? 0;

        if (
          !stock ||
          stock.availableQuantity < requiredAvailable ||
          stock.reservedQuantity < requiredReserved
        ) {
          return { count: 0 };
        }

        stock.availableQuantity +=
          updateArgs.data.availableQuantity?.increment ?? 0;
        stock.availableQuantity -=
          updateArgs.data.availableQuantity?.decrement ?? 0;
        stock.reservedQuantity += updateArgs.data.reservedQuantity?.increment ?? 0;
        stock.reservedQuantity -= updateArgs.data.reservedQuantity?.decrement ?? 0;

        return { count: 1 };
      }
    },
    order: {
      count: async (args: unknown) => {
        calls.orderCount.push(args);
        return orders.length;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.orderCreate.push(args);
        const order = {
          ...args.data,
          createdAt: now,
          deliveryAssignments: [],
          id: "order-1",
          payments: [],
          refunds,
          statusHistory,
          updatedAt: now
        };
        orders.push(order);
        return order;
      },
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        const where = (args as {
          where?: {
            checkoutIdempotencyKey?: string;
            deletedAt?: null;
            id?: string;
            userId?: string;
          };
        }).where ?? {};

        if (where.checkoutIdempotencyKey !== undefined) {
          const matchingOrder = orders.find(
            (entry) =>
              entry.checkoutIdempotencyKey === where.checkoutIdempotencyKey &&
              entry.userId === where.userId
          );

          if (!matchingOrder) {
            return null;
          }

          return {
            ...matchingOrder,
            billingAddress: address,
            deliveryAssignments:
              (
                matchingOrder as {
                  deliveryAssignments?: typeof deliveryAssignments;
                }
              ).deliveryAssignments ?? deliveryAssignments,
            gstInvoice:
              (matchingOrder as { gstInvoice?: typeof invoice }).gstInvoice ??
              null,
            items: orderItems,
            payments:
              (matchingOrder as { payments?: typeof payments }).payments ??
              payments,
            refunds:
              (matchingOrder as { refunds?: typeof refunds }).refunds ?? refunds,
            shippingAddress: address,
            statusHistory,
            user: (matchingOrder as { user?: typeof customer }).user ?? customer,
            warehouse:
              (matchingOrder as { warehouse?: typeof warehouse }).warehouse ??
              warehouse
          };
        }

        const order = orders[0] ?? {
          createdAt: now,
          discountTotal: "0.00",
          grandTotal: "283.20",
          gstInvoice: invoice,
          id: "order-1",
          items: orderItems,
          orderNumber: "ORD-20260525-000001",
          paymentStatus: input?.paymentStatus ?? "PENDING",
          payments,
          placedAt: now,
          refunds,
          shippingTotal: "0.00",
          shippingAddress: address,
          status: input?.orderStatus ?? "CREATED",
          statusHistory,
          subtotal: "240.00",
          taxTotal: "43.20",
          updatedAt: now,
          user: customer,
          userId: "customer-1",
          warehouse,
          warehouseId: "warehouse-1"
        };

        return {
          ...order,
          billingAddress: address,
          deliveryAssignments:
            (order as { deliveryAssignments?: typeof deliveryAssignments })
              .deliveryAssignments ?? deliveryAssignments,
          gstInvoice: (order as { gstInvoice?: typeof invoice }).gstInvoice ?? null,
          items: orderItems,
          payments: (order as { payments?: typeof payments }).payments ?? payments,
          refunds: (order as { refunds?: typeof refunds }).refunds ?? refunds,
          shippingAddress: address,
          statusHistory,
          user: (order as { user?: typeof customer }).user ?? customer,
          warehouse: (order as { warehouse?: typeof warehouse }).warehouse ?? warehouse
        };
      },
      findMany: async (args: unknown) => {
        calls.orderFindMany.push(args);
        const defaultOrder = {
          createdAt: now,
          discountTotal: "0.00",
          grandTotal: "283.20",
          gstInvoice: invoice,
          id: "order-1",
          items: orderItems,
          orderNumber: "ORD-20260525-000001",
          paymentStatus: input?.paymentStatus ?? "PENDING",
          payments,
          placedAt: now,
          refunds,
          shippingTotal: "0.00",
          shippingAddress: address,
          status: input?.orderStatus ?? "CREATED",
          statusHistory,
          subtotal: "240.00",
          taxTotal: "43.20",
          updatedAt: now,
          user: customer,
          userId: "customer-1",
          warehouse,
          warehouseId: "warehouse-1"
        };

        if (refunds.length === 0) {
          return [];
        }

        return [
          {
            ...defaultOrder,
            billingAddress: address,
            deliveryAssignments,
            items: orderItems,
            payments,
            refunds,
            shippingAddress: address,
            statusHistory,
            user: customer,
            warehouse
          }
        ];
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.orderUpdate.push(args);
        const existing = orders[0] ?? {
          createdAt: now,
          discountTotal: "0.00",
          grandTotal: "283.20",
          gstInvoice: invoice,
          id: "order-1",
          orderNumber: "ORD-20260525-000001",
          paymentStatus: input?.paymentStatus ?? "PENDING",
          payments,
          placedAt: now,
          refunds,
          shippingTotal: "0.00",
          status: input?.orderStatus ?? "CREATED",
          subtotal: "240.00",
          taxTotal: "43.20",
          updatedAt: now,
          userId: "customer-1",
          warehouseId: "warehouse-1"
        };
        const updated = {
          ...existing,
          ...args.data,
          id: args.where.id,
          items: orderItems,
          statusHistory
        };
        orders[0] = updated;
        return updated;
      }
    },
    orderItem: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.orderItemCreate.push(args);
        const item = {
          ...args.data,
          id: "order-item-1"
        } as {
          id: string;
          orderId: string;
          productId: string;
          quantity: number;
          stockBatchId: string | null;
          total: number | string;
          unitPrice: number | string;
          warehouseId: string | null;
        };
        orderItems.push(item);
        return item;
      }
    },
    payment: {
      create: async (args: unknown) => {
        calls.paymentCreate.push(args);
        return { id: "payment-1" };
      }
    },
    refund: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.refundCreate.push(args);
        const refund = {
          amount: args.data.amount as number | string,
          createdAt: now,
          id: `refund-${refunds.length + 1}`,
          paymentId: (args.data.paymentId as string | null | undefined) ?? null,
          processedAt: null,
          providerRefundId: (args.data.providerRefundId as string | null | undefined) ?? null,
          reason: (args.data.reason as string | null | undefined) ?? null,
          status: args.data.status as string,
          updatedAt: now
        };
        refunds.push(refund);
        return refund;
      },
      findFirst: async (args: {
        where?: {
          orderId?: string;
          status?: { in?: string[] } | string;
        };
      }) => {
        calls.refundFindFirst.push(args);
        const where = args.where ?? {};

        return (
          refunds.find((refund) => {
            if (where.orderId !== undefined && where.orderId !== "order-1") {
              return false;
            }

            if (typeof where.status === "string") {
              return refund.status === where.status;
            }

            if (where.status?.in) {
              return where.status.in.includes(refund.status);
            }

            return true;
          }) ?? null
        );
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.refundUpdate.push(args);
        const refund = refunds.find((entry) => entry.id === args.where.id);

        if (!refund) {
          throw new Error("Refund not found.");
        }

        Object.assign(refund, args.data, { updatedAt: now });
        return refund;
      }
    },
    deliveryAssignment: {
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.deliveryAssignmentUpdate.push(args);
        Object.assign(deliveryAssignments[0], args.data);
        return deliveryAssignments[0];
      }
    },
    deliveryStatusHistory: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryStatusHistoryCreate.push(args);
        const history = {
          createdAt: now,
          id: `delivery-history-${deliveryStatusHistory.length + 1}`,
          latitude: null,
          longitude: null,
          note: (args.data.note as string | null | undefined) ?? null,
          status: args.data.status as string,
          updatedAt: now
        };
        deliveryStatusHistory.push(history);
        return history;
      }
    },
    stockBatch: {
      findMany: async (args: unknown) => {
        calls.stockBatchFindMany.push(args);
        const where = (args as {
          where?: {
            productId?: string;
            quantity?: { gt?: number };
            variantId?: string | null;
            warehouseId?: string;
          };
        }).where ?? {};
        const minimum = where.quantity?.gt ?? -1;

        return stockBatches.filter(
          (batch) =>
            (where.productId === undefined || batch.productId === where.productId) &&
            (!("variantId" in where) || batch.variantId === where.variantId) &&
            (where.warehouseId === undefined ||
              batch.warehouseId === where.warehouseId) &&
            batch.quantity > minimum
        );
      },
      updateMany: async (args: unknown) => {
        calls.stockBatchUpdateMany.push(args);
        const updateArgs = args as {
          data: { quantity: { decrement?: number; increment?: number } };
          where: {
            id: string;
            quantity?: { gte?: number };
          };
        };
        const batch = stockBatches.find((entry) => entry.id === updateArgs.where.id);
        const requiredQuantity = updateArgs.where.quantity?.gte ?? 0;

        if (!batch || batch.quantity < requiredQuantity) {
          return { count: 0 };
        }

        batch.quantity += updateArgs.data.quantity.increment ?? 0;
        batch.quantity -= updateArgs.data.quantity.decrement ?? 0;

        return { count: 1 };
      }
    },
    stockMovement: {
      create: async (args: unknown) => {
        calls.stockMovementCreate.push(args);
        return { id: `stock-movement-${calls.stockMovementCreate.length}` };
      }
    },
    orderStatusHistory: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.statusHistoryCreate.push(args);
        const history = {
          changedById: (args.data.changedById as string | null | undefined) ?? null,
          createdAt: now,
          id: `history-${statusHistory.length + 1}`,
          note: (args.data.note as string | null | undefined) ?? null,
          orderId: args.data.orderId as string,
          status: args.data.status as string
        };
        statusHistory.push(history);
        return history;
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);
        return {
          deletedAt: null,
          id: "customer-1",
          isActive: true
        };
      }
    },
    warehouse: {
      findMany: async (args: unknown) => {
        calls.warehouseFindMany.push(args);
        return warehouses.map((entry) => ({
          id: entry.id
        }));
      }
    }
  };

  return prisma;
}

test("createOrder reserves stock from a warehouse batch, snapshots items, creates payment and clears cart", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const order = await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });

  assert.equal(order.status, "CREATED");
  assert.equal(order.warehouseId, "warehouse-1");
  assert.equal(order.totals.subtotal, 240);
  assert.equal(order.totals.tax, 43.2);
  assert.equal(order.totals.grandTotal, 283.2);
  assert.match(order.orderNumber, new RegExp(`^${todayOrderPrefix}-`));
  assert.deepEqual(prisma.calls.inventoryStockUpdateMany[0], {
    data: {
      availableQuantity: {
        decrement: 2
      },
      reservedQuantity: {
        increment: 2
      }
    },
    where: {
      availableQuantity: {
        gte: 2
      },
      id: "stock-1"
    }
  });
  assert.equal(prisma.calls.stockBatchUpdateMany.length, 1);
  assert.equal(prisma.calls.orderItemCreate.length, 1);
  assert.equal(
    (prisma.calls.orderItemCreate[0] as { data: { name: string } }).data.name,
    "Curved Artery Forceps"
  );
  assert.equal(prisma.calls.paymentCreate.length, 1);
  assert.equal(prisma.calls.statusHistoryCreate.length, 1);
  assert.equal(prisma.calls.cartItemDeleteMany.length, 1);
});

test("createOrder allocates available cart lines across different warehouses", async () => {
  const prisma = createOrdersPrismaMock({ splitWarehouseStock: true });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  const order = await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });

  assert.deepEqual(
    order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      warehouseId: item.warehouseId
    })),
    [
      {
        productId: "product-1",
        quantity: 2,
        warehouseId: "warehouse-1"
      },
      {
        productId: "product-2",
        quantity: 3,
        warehouseId: "warehouse-2"
      }
    ]
  );
  assert.equal(prisma.calls.orderItemCreate.length, 2);
  assert.equal(prisma.calls.stockMovementCreate.length, 2);
  assert.equal(prisma.calls.cartItemDeleteMany.length, 1);
});

test("createOrder keeps the cart intact for pending online payment orders", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.createOrder("customer-1", {
    paymentMethod: "ONLINE",
    shippingAddressId: "address-1"
  });

  assert.equal(prisma.calls.orderCreate.length, 1);
  assert.equal(prisma.calls.paymentCreate.length, 1);
  assert.equal(prisma.calls.cartItemDeleteMany.length, 0);
});

test("createOrder returns the existing order for duplicate checkout idempotency keys", async () => {
  const prisma = createOrdersPrismaMock();
  const queue = new FakeOrderQueue();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    queue as unknown as ApiQueueService,
    undefined,
    undefined,
    new FakeDeliveryChargesService(50) as never
  );

  const input = {
    idempotencyKey: "checkout-20260627-001",
    paymentMethod: "ONLINE" as const,
    shippingAddressId: "address-1"
  };

  const first = await service.createOrder("customer-1", input);
  const second = await service.createOrder("customer-1", input);

  assert.equal(second.id, first.id);
  assert.equal(prisma.calls.orderCreate.length, 1);
  assert.equal(prisma.calls.paymentCreate.length, 1);
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 1);
  assert.equal(queue.notificationJobs.length, 1);
});

test("createOrder applies a valid coupon to order and payment totals", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.createOrder("customer-1", {
    couponCode: " surgical10 ",
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });

  assert.equal(prisma.calls.couponFindFirst.length, 1);
  assert.deepEqual(
    (prisma.calls.orderCreate[0] as { data: Record<string, unknown> }).data,
    {
      billingAddressId: "address-1",
      couponId: "coupon-1",
      discountTotal: 24,
      grandTotal: 259.2,
      orderNumber: (
        prisma.calls.orderCreate[0] as { data: { orderNumber: string } }
      ).data.orderNumber,
      paymentStatus: "PENDING",
      placedAt: (
        prisma.calls.orderCreate[0] as { data: { placedAt: Date } }
      ).data.placedAt,
      shippingAddressId: "address-1",
      shippingTotal: 0,
      status: "CREATED",
      subtotal: 240,
      taxTotal: 43.2,
      userId: "customer-1",
      warehouseId: "warehouse-1"
    }
  );
  assert.equal(
    (prisma.calls.paymentCreate[0] as { data: { amount: number } }).data.amount,
    259.2
  );
  assert.equal(prisma.calls.couponUpdateMany.length, 1);
  const claim = prisma.calls.couponUpdateMany[0] as {
    data: unknown;
    where: { AND: unknown[]; deletedAt: null; id: string; isActive: boolean };
  };
  assert.deepEqual(claim.data, { usedCount: { increment: 1 } });
  assert.equal(claim.where.id, "coupon-1");
  assert.equal(claim.where.deletedAt, null);
  assert.equal(claim.where.isActive, true);
  assert.deepEqual(claim.where.AND[2], {
    OR: [
      { usageLimit: null },
      { usedCount: { lt: prisma.coupon.fields.usageLimit } }
    ]
  });
});

test("createOrder rejects a coupon whose last use was claimed after validation", async () => {
  const prisma = createOrdersPrismaMock({
    couponUsageLimit: 1,
    couponUsedCount: 0,
    couponUsedCountAtClaim: 1
  });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () => service.createOrder("customer-1", {
      couponCode: "SURGICAL10",
      paymentMethod: "COD",
      shippingAddressId: "address-1"
    }),
    /Coupon is no longer available/
  );
  assert.equal(prisma.calls.couponUpdateMany.length, 1);
  assert.equal(prisma.calls.orderCreate.length, 0);
  assert.equal(prisma.calls.paymentCreate.length, 0);
  assert.equal(prisma.calls.cartItemDeleteMany.length, 0);
});

test("createOrder revalidates inactive and exhausted coupons before accepting an order", async () => {
  for (const input of [
    { couponIsActive: false },
    { couponUsageLimit: 1, couponUsedCount: 1 }
  ]) {
    const prisma = createOrdersPrismaMock(input);
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      new FakeWarehouseAccess() as unknown as WarehouseAccessService
    );
    await assert.rejects(
      () => service.createOrder("customer-1", {
        couponCode: "SURGICAL10",
        paymentMethod: "COD",
        shippingAddressId: "address-1"
      }),
      BadRequestException
    );
    assert.equal(prisma.calls.orderCreate.length, 0);
    assert.equal(prisma.calls.couponUpdateMany.length, 0);
  }
});

test("createOrder counts an unlimited coupon only once for a retried checkout", async () => {
  const prisma = createOrdersPrismaMock({ couponUsageLimit: null, couponUsedCount: 100 });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );
  const input = {
    couponCode: "SURGICAL10",
    idempotencyKey: "checkout-coupon-retry",
    paymentMethod: "ONLINE" as const,
    shippingAddressId: "address-1"
  };

  await service.createOrder("customer-1", input);
  await service.createOrder("customer-1", input);

  assert.equal(prisma.calls.couponUpdateMany.length, 1);
  assert.equal(prisma.calls.orderCreate.length, 1);
});

test("createOrder stores dynamic delivery charge on order and payment totals", async () => {
  const prisma = createOrdersPrismaMock();
  const deliveryCharges = new FakeDeliveryChargesService(75);
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined,
    undefined,
    undefined,
    deliveryCharges as never
  );

  const order = await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });

  assert.equal(order.totals.deliveryCharge, 75);
  assert.equal(order.totals.grandTotal, 358.2);
  assert.deepEqual(deliveryCharges.calls[0], {
    pincode: "110001",
    subtotal: 240,
    warehouseId: "warehouse-1"
  });
  assert.equal(
    (prisma.calls.orderCreate[0] as { data: { shippingTotal: number } }).data
      .shippingTotal,
    75
  );
  assert.equal(
    (prisma.calls.paymentCreate[0] as { data: { amount: number } }).data.amount,
    358.2
  );
});

test("createOrder persists the same warehouse-specific shipping charge used by cart previews", async () => {
  const prisma = createOrdersPrismaMock();
  const baseRule = {
    charge: "80", createdAt: now, deletedAt: null, freeDeliveryThreshold: null,
    id: "default", isActive: true, maxOrderAmount: null, minOrderAmount: null,
    name: "Default", pincode: null, priority: 0, updatedAt: now, warehouseId: null
  };
  const deliveryCharges = new DeliveryChargesService({ deliveryChargeRule: {
    findMany: async () => [baseRule, { ...baseRule, charge: "150", id: "warehouse", warehouseId: "warehouse-1" }]
  } } as unknown as PrismaService);
  const service = new OrdersService(prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined, undefined, undefined, deliveryCharges);

  const order = await service.createOrder("customer-1", { paymentMethod: "COD", shippingAddressId: "address-1" });
  assert.equal(order.totals.deliveryCharge, 150);
  assert.equal(order.totals.grandTotal, 433.2);
  assert.equal((prisma.calls.orderCreate[0] as { data: { shippingTotal: number } }).data.shippingTotal, 150);
  assert.equal((prisma.calls.paymentCreate[0] as { data: { amount: number } }).data.amount, 433.2);
});

test("createOrder enqueues an order confirmation notification after checkout succeeds", async () => {
  const prisma = createOrdersPrismaMock();
  const queue = new FakeOrderQueue();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    queue as unknown as ApiQueueService
  );

  const order = await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });

  assert.equal(queue.notificationJobs.length, 1);
  assert.deepEqual(
    {
      customerId: (queue.notificationJobs[0] as { customerId: string }).customerId,
      orderId: (queue.notificationJobs[0] as { orderId: string }).orderId,
      orderNumber: (queue.notificationJobs[0] as { orderNumber: string })
        .orderNumber,
      version: (queue.notificationJobs[0] as { version: number }).version
    },
    {
      customerId: "customer-1",
      orderId: order.id,
      orderNumber: order.orderNumber,
      version: 1
    }
  );
  assert.ok(
    Date.parse((queue.notificationJobs[0] as { requestedAt: string }).requestedAt)
  );
});

test("createOrder rejects checkout when no warehouse can satisfy the cart", async () => {
  const prisma = createOrdersPrismaMock({ stockAvailable: 1 });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () =>
      service.createOrder("customer-1", {
        paymentMethod: "ONLINE",
        shippingAddressId: "address-1"
      }),
    BadRequestException
  );
  assert.equal(prisma.calls.orderCreate.length, 0);
  assert.equal(prisma.calls.cartItemDeleteMany.length, 0);
});

test("reorder rebuilds the token customer's cart from an owned order", async () => {
  const prisma = createOrdersPrismaMock({
    existingOrderItems: [
      {
        id: "order-item-1",
        orderId: "order-1",
        productId: "product-1",
        quantity: 2,
        stockBatchId: "batch-1",
        total: "283.20",
        unitPrice: "120.00",
        variantId: null,
        warehouseId: "warehouse-1"
      },
      {
        id: "order-item-2",
        orderId: "order-1",
        productId: "product-2",
        quantity: 3,
        stockBatchId: "batch-2",
        total: "268.80",
        unitPrice: "80.00",
        variantId: "variant-2",
        warehouseId: "warehouse-2"
      },
      {
        id: "order-item-3",
        orderId: "order-1",
        productId: "product-1",
        quantity: 1,
        stockBatchId: "batch-3",
        total: "141.60",
        unitPrice: "120.00",
        variantId: null,
        warehouseId: "warehouse-2"
      }
    ]
  });
  const cartService = new FakeReorderCartService();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined,
    cartService as unknown as CartService
  );

  const cart = await service.reorder("customer-1", "order-1");

  assert.deepEqual(cartService.replaceWithItemsCalls, [
    {
      customerId: "customer-1",
      items: [
        {
          productId: "product-1",
          quantity: 3,
          variantId: null
        },
        {
          productId: "product-2",
          quantity: 3,
          variantId: "variant-2"
        }
      ]
    }
  ]);
  assert.equal(cart.itemCount, 2);
  assert.equal(cart.totalQuantity, 6);
  assert.deepEqual((prisma.calls.orderFindFirst[0] as { where: unknown }).where, {
    deletedAt: null,
    id: "order-1",
    userId: "customer-1"
  });
});

test("cancelMyOrder lets a customer cancel an eligible owned order and releases reserved stock", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });
  const order = await service.cancelMyOrder("customer-1", "order-1", {
    reason: "Needed different quantity"
  });

  assert.equal(order.status, "CANCELLED");
  assert.equal(order.paymentStatus, "CANCELLED");
  assert.equal(prisma.calls.orderUpdate.length, 1);
  assert.equal(
    (prisma.calls.orderUpdate[0] as { data: { status: string } }).data.status,
    "CANCELLED"
  );
  assert.equal(
    (
      prisma.calls.statusHistoryCreate[1] as {
        data: { note: string; status: string };
      }
    ).data.note,
    "Needed different quantity"
  );
  assert.equal(prisma.calls.inventoryStockUpdateMany.length, 2);
});

test("requestMyOrderReturn creates one pending refund request for a delivered order", async () => {
  const prisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const order = await service.requestMyOrderReturn("customer-1", "order-1", {
    reason: "Seal was damaged on arrival"
  });

  assert.equal(prisma.calls.refundCreate.length, 1);
  assert.deepEqual(order.refunds, [
    {
      amount: 283.2,
      createdAt: now,
      id: "refund-1",
      processedAt: null,
      providerRefundId: null,
      reason: "Seal was damaged on arrival",
      status: "PENDING"
    }
  ]);
});

test("getMyOrder serializes delivery tracking updates for the customer", async () => {
  const prisma = createOrdersPrismaMock({
    orderStatus: "ASSIGNED"
  });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const order = await service.getMyOrder("customer-1", "order-1");

  assert.deepEqual(order.deliveryTracking, [
    {
      assignedAt: now,
      deliveredAt: null,
      deliveryPartnerName: "Asha Driver",
      failureReason: null,
      id: "assignment-1",
      pickedUpAt: null,
      proofOfDeliveryUrl: null,
      status: "ASSIGNED",
      statusHistory: [
        {
          createdAt: now,
          id: "delivery-history-1",
          latitude: 28.613939,
          longitude: 77.209023,
          note: "Assigned to delivery partner.",
          status: "ASSIGNED"
        }
      ],
      vehicleNumber: "DL01AB1234"
    }
  ]);
});

test("listAdminOrders scopes non-super-admins to assigned warehouses", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await service.listAdminOrders({}, adminAuth(AdminRoleCode.OrderManager));

  assert.deepEqual(
    (prisma.calls.orderFindMany[0] as { where: unknown }).where,
    {
      deletedAt: null,
      warehouseId: {
        in: ["warehouse-1", "warehouse-2"]
      }
    }
  );
});

test("listAdminOrders applies status, payment, date, customer, order number, and warehouse filters", async () => {
  const prisma = createOrdersPrismaMock();
  const warehouseAccess = new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]);
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    warehouseAccess as unknown as WarehouseAccessService
  );

  await service.listAdminOrders(
    {
      customerMobile: "9999",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-26",
      orderNumber: "ORD-20260525",
      paymentStatus: "PAID",
      status: "CONFIRMED",
      warehouseId: "warehouse-1"
    } as Parameters<OrdersService["listAdminOrders"]>[0] & Record<string, string>,
    adminAuth(AdminRoleCode.OrderManager)
  );

  assert.deepEqual(warehouseAccess.assertedWarehouseIds, ["warehouse-1"]);
  assert.deepEqual(
    (prisma.calls.orderFindMany[0] as { where: unknown }).where,
    {
      createdAt: {
        gte: new Date("2026-05-01T00:00:00.000Z"),
        lte: new Date("2026-05-26T23:59:59.999Z")
      },
      deletedAt: null,
      orderNumber: {
        contains: "ORD-20260525",
        mode: "insensitive"
      },
      paymentStatus: "PAID",
      status: "CONFIRMED",
      user: {
        mobileNumber: {
          contains: "9999"
        }
      },
      warehouseId: "warehouse-1"
    }
  );
});

test("pending-only order requests validate query booleans instead of treating false as true", () => {
  // The test transpiler omits the type metadata emitted by the production compiler.
  Reflect.defineMetadata("design:type", Boolean, AdminOrderListQueryDto.prototype, "pendingOnly");
  for (const [value, expected] of [["true", true], ["false", false]] as const) {
    const query = plainToInstance(AdminOrderListQueryDto, { pendingOnly: value }, { enableImplicitConversion: true });
    assert.equal(query.pendingOnly, expected);
    assert.deepEqual(validateSync(query), []);
  }
  assert.ok(validateSync(plainToInstance(AdminOrderListQueryDto, { pendingOnly: "yes" }, { enableImplicitConversion: true })).length > 0);
});

test("listAdminOrders intersects pending status scope and keeps other report filters for rows and counts", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1"]) as unknown as WarehouseAccessService
  );
  const cases = [
    { expected: ["CREATED", "CONFIRMED", "PACKED", "ASSIGNED", "OUT_FOR_DELIVERY"], status: undefined },
    { expected: ["CONFIRMED"], status: "CONFIRMED" as const },
    { expected: [], status: "CANCELLED" as const }
  ];

  for (const [index, { expected, status }] of cases.entries()) {
    await service.listAdminOrders({
      dateFrom: "2026-07-05",
      dateTo: "2026-09-03",
      paymentStatus: "PENDING",
      pendingOnly: true,
      status,
      warehouseId: "warehouse-1"
    }, adminAuth());

    const where = (prisma.calls.orderFindMany[index] as { where: unknown }).where;
    assert.deepEqual(where, {
      createdAt: {
        gte: new Date("2026-07-05T00:00:00.000Z"),
        lte: new Date("2026-09-03T23:59:59.999Z")
      },
      deletedAt: null,
      paymentStatus: "PENDING",
      status: { in: expected },
      warehouseId: "warehouse-1"
    });
    assert.deepEqual((prisma.calls.orderCount[index] as { where: unknown }).where, where);
  }
});

test("listAdminReturnRequests filters pending returns with order, customer, payment, and refund context", async () => {
  const prisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess(["warehouse-1", "warehouse-2"]) as unknown as WarehouseAccessService
  );

  await service.requestMyOrderReturn("customer-1", "order-1", {
    reason: "Seal was damaged on arrival"
  });

  const result = await service.listAdminReturnRequests(
    {
      page: 1,
      status: "PENDING"
    },
    adminAuth(AdminRoleCode.OrderManager)
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.orderNumber, "ORD-20260525-000001");
  assert.equal(result.items[0]?.customer.mobileNumber, "9999999999");
  assert.equal(result.items[0]?.paymentDetails[0]?.status, "PENDING");
  assert.equal(result.items[0]?.refunds[0]?.status, "PENDING");
  assert.equal(result.items[0]?.refunds[0]?.reason, "Seal was damaged on arrival");
  assert.deepEqual(
    (prisma.calls.orderFindMany[0] as { where: unknown }).where,
    {
      deletedAt: null,
      refunds: {
        some: {
          status: "PENDING"
        }
      },
      warehouseId: {
        in: ["warehouse-1", "warehouse-2"]
      }
    }
  );
});

test("getAdminOrder serializes customer, warehouse, payment, and invoice details for the admin detail page", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const order = await service.getAdminOrder("order-1", adminAuth());

  assert.deepEqual(order.customer, {
    businessName: "Ritika Surgical Clinic",
    email: "ritika@example.com",
    firstName: "Ritika",
    gstNumber: "27ABCDE1234F1Z5",
    id: "customer-1",
    lastName: "Singh",
    mobileNumber: "9999999999"
  });
  assert.deepEqual(order.warehouse, {
    code: "DEL-01",
    id: "warehouse-1",
    name: "Delhi warehouse"
  });
  assert.deepEqual(order.paymentDetails, [
    {
      amount: 283.2,
      createdAt: now,
      id: "payment-1",
      method: "COD",
      paidAt: null,
      provider: null,
      providerOrderId: null,
      providerPaymentId: null,
      status: "PENDING",
      transactionRef: "COD-order-1"
    }
  ]);
  assert.deepEqual(order.invoice, {
    id: "invoice-1",
    invoiceNumber: "INV-20260525-000001",
    issuedAt: now,
    pdfStatus: "NOT_GENERATED",
    taxBreakup: {
      cgst: 21.6,
      igst: 0,
      sgst: 21.6,
      taxType: "CGST_SGST"
    },
    totals: {
      deliveryCharge: 0,
      discount: 0,
      grandTotal: 283.2,
      subtotal: 240,
      tax: 43.2
    }
  });
});

test("cancelOrder releases reserved inventory and records a cancelled history entry", async () => {
  const prisma = createOrdersPrismaMock();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });
  await service.cancelOrder(
    "order-1",
    {
      reason: "Customer requested cancellation"
    },
    {
      auth: adminAuth(),
      ipAddress: "127.0.0.1",
      userAgent: "node-test"
    }
  );

  assert.equal(prisma.calls.orderUpdate.length, 1);
  assert.equal(
    (prisma.calls.orderUpdate[0] as { data: { status: string } }).data.status,
    "CANCELLED"
  );
  assert.deepEqual(prisma.calls.inventoryStockUpdateMany[1], {
    data: {
      availableQuantity: {
        increment: 2
      },
      reservedQuantity: {
        decrement: 2
      }
    },
    where: {
      productId: "product-1",
      reservedQuantity: {
        gte: 2
      },
      variantId: null,
      warehouseId: "warehouse-1"
    }
  });
  assert.equal(
    (
      prisma.calls.statusHistoryCreate[1] as {
        data: { status: string };
      }
    ).data.status,
    "CANCELLED"
  );
});

test("updateStatus enqueues invoice generation when an admin confirms an order", async () => {
  const prisma = createOrdersPrismaMock();
  const queue = new FakeOrderQueue();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    queue as unknown as ApiQueueService
  );

  await service.createOrder("customer-1", {
    paymentMethod: "COD",
    shippingAddressId: "address-1"
  });
  await service.updateStatus(
    "order-1",
    {
      status: "CONFIRMED"
    },
    {
      auth: adminAuth(),
      ipAddress: "127.0.0.1",
      userAgent: "node-test"
    }
  );

  assert.equal(queue.invoiceJobs.length, 1);
  assert.deepEqual(
    {
      orderId: (queue.invoiceJobs[0] as { orderId: string }).orderId,
      version: (queue.invoiceJobs[0] as { version: number }).version
    },
    {
      orderId: "order-1",
      version: 1
    }
  );
  assert.ok(Date.parse((queue.invoiceJobs[0] as { requestedAt: string }).requestedAt));
});

test("updateStatus processes pending refund when an admin accepts a delivered return", async () => {
  const prisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const refunds = new FakeRefundProcessor();
  const service = new OrdersService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined,
    undefined,
    refunds as never
  );

  const order = await service.updateStatus(
    "order-1",
    {
      note: "Returned item received by warehouse.",
      status: "RETURNED"
    },
    {
      auth: adminAuth(),
      ipAddress: "127.0.0.1",
      userAgent: "node-test"
    }
  );

  assert.equal(order.status, "RETURNED");
  assert.deepEqual(refunds.orderIds, ["order-1"]);
});

test("admin return actions approve, reject, and process refund requests", async () => {
  const approvePrisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const approveRefunds = new FakeRefundProcessor();
  const approveService = new OrdersService(
    approvePrisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined,
    undefined,
    approveRefunds as never
  );
  const context = {
    auth: adminAuth(),
    ipAddress: "127.0.0.1",
    userAgent: "node-test"
  };

  await approveService.requestMyOrderReturn("customer-1", "order-1", {
    reason: "Seal was damaged on arrival"
  });

  const approved = await approveService.approveAdminReturn(
    "order-1",
    {
      note: "Returned item received by warehouse."
    },
    context
  );

  assert.equal(approved.status, "RETURNED");
  assert.deepEqual(approveRefunds.orderIds, ["order-1"]);

  const rejectPrisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const rejectService = new OrdersService(
    rejectPrisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await rejectService.requestMyOrderReturn("customer-1", "order-1", {
    reason: "Seal was damaged on arrival"
  });

  const rejected = await rejectService.rejectAdminReturn(
    "order-1",
    {
      note: "Return rejected after inspection."
    },
    context
  );

  assert.equal(rejected.refunds[0]?.status, "CANCELLED");
  assert.equal(rejectPrisma.calls.refundUpdate.length, 1);
  assert.equal(
    (
      rejectPrisma.calls.refundUpdate[0] as {
        data: { reason: string; status: string };
      }
    ).data.status,
    "CANCELLED"
  );

  const processPrisma = createOrdersPrismaMock({
    orderStatus: "DELIVERED",
    paymentStatus: "PAID"
  });
  const processRefunds = new FakeRefundProcessor();
  const processService = new OrdersService(
    processPrisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService,
    undefined,
    undefined,
    processRefunds as never
  );

  await processService.requestMyOrderReturn("customer-1", "order-1", {
    reason: "Seal was damaged on arrival"
  });

  const processed = await processService.processAdminReturnRefund(
    "order-1",
    context
  );

  assert.equal(processed.id, "order-1");
  assert.deepEqual(processRefunds.orderIds, ["order-1"]);
});

test("order controllers use the correct auth and permission guards", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, OrdersController), [
    CustomerJwtGuard
  ]);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminOrdersController), [
    AdminJwtGuard,
    PermissionGuard
  ]);
});
