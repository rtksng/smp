import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
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
import { OrdersController } from "../../src/modules/orders/orders.controller";
import { OrdersService } from "../../src/modules/orders/orders.service";
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

function createOrdersPrismaMock(input?: {
  batchQuantity?: number;
  stockAvailable?: number;
}) {
  const calls: Record<string, unknown[]> = {
    cartFindFirst: [],
    cartItemDeleteMany: [],
    inventoryStockFindFirst: [],
    inventoryStockUpdateMany: [],
    orderCount: [],
    orderCreate: [],
    orderFindFirst: [],
    orderFindMany: [],
    orderItemCreate: [],
    orderUpdate: [],
    paymentCreate: [],
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
    warehouseId: string | null;
  }> = [];
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
  const cart = {
    deletedAt: null,
    id: "cart-1",
    items: [
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
    ],
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
  const warehouse = {
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
  };
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
  const invoice = {
    cgstTotal: "21.60",
    grandTotal: "283.20",
    id: "invoice-1",
    igstTotal: "0.00",
    invoiceNumber: "INV-20260525-000001",
    issuedAt: now,
    pdfStatus: "NOT_GENERATED",
    sgstTotal: "21.60",
    subtotal: "240.00",
    taxTotal: "43.20",
    taxType: "CGST_SGST"
  };
  const prisma = {
    calls,
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
    inventoryStock: {
      findFirst: async (args: unknown) => {
        calls.inventoryStockFindFirst.push(args);
        return {
          availableQuantity: stockAvailable,
          id: "stock-1",
          productId: "product-1",
          reservedQuantity: 0,
          variantId: null,
          warehouseId: "warehouse-1"
        };
      },
      updateMany: async (args: unknown) => {
        calls.inventoryStockUpdateMany.push(args);
        return { count: stockAvailable >= 2 ? 1 : 0 };
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
          id: "order-1",
          payments: [],
          statusHistory,
          updatedAt: now
        };
        orders.push(order);
        return order;
      },
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        const order = orders[0] ?? {
          createdAt: now,
          discountTotal: "0.00",
          grandTotal: "283.20",
          gstInvoice: invoice,
          id: "order-1",
          items: orderItems,
          orderNumber: "ORD-20260525-000001",
          paymentStatus: "PENDING",
          payments,
          placedAt: now,
          shippingTotal: "0.00",
          shippingAddress: address,
          status: "CREATED",
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
          gstInvoice: (order as { gstInvoice?: typeof invoice }).gstInvoice ?? null,
          items: orderItems,
          payments: (order as { payments?: typeof payments }).payments ?? payments,
          shippingAddress: address,
          statusHistory,
          user: (order as { user?: typeof customer }).user ?? customer,
          warehouse: (order as { warehouse?: typeof warehouse }).warehouse ?? warehouse
        };
      },
      findMany: async (args: unknown) => {
        calls.orderFindMany.push(args);
        return [];
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.orderUpdate.push(args);
        const existing = orders[0] ?? {};
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
    stockBatch: {
      findMany: async (args: unknown) => {
        calls.stockBatchFindMany.push(args);
        return [
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
      },
      updateMany: async (args: unknown) => {
        calls.stockBatchUpdateMany.push(args);
        return { count: batchQuantity >= 2 ? 1 : 0 };
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
        return [
          {
            id: "warehouse-1"
          }
        ];
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

test("order controllers use the correct auth and permission guards", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, OrdersController), [
    CustomerJwtGuard
  ]);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminOrdersController), [
    AdminJwtGuard,
    PermissionGuard
  ]);
});
