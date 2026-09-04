import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../../src/database/prisma.service";
import type { CartService } from "../../src/modules/cart/cart.service";
import type { OrdersService } from "../../src/modules/orders/orders.service";
import { QuoteRequestsService } from "../../src/modules/quote-requests/quote-requests.service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendQuoteResponseDto } from "../../src/modules/quote-requests/dto/quote-request.dto";

const now = new Date("2026-06-15T10:00:00.000Z");

function createQuoteRequestsPrismaMock() {
  const logs: Array<Record<string, unknown>> = [];
  const calls: Record<string, unknown[]> = {
    count: [],
    create: [],
    findFirst: [],
    findMany: [],
    update: [],
    userFindFirst: []
  };

  return {
    calls,
    logs,
    notificationLog: {
      count: async (args: unknown) => {
        calls.count.push(args);
        return filterLogs(logs, (args as { where?: Record<string, unknown> }).where)
          .length;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.create.push(args);
        const record = {
          userId: null,
          ...args.data,
          createdAt: now,
          id: `quote-${logs.length + 1}`,
          updatedAt: now
        };
        logs.push(record);
        return record;
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        calls.findFirst.push(args);
        return filterLogs(logs, args.where)[0] ?? null;
      },
      findMany: async (args: {
        skip?: number;
        take?: number;
        where?: Record<string, unknown>;
      }) => {
        calls.findMany.push(args);
        const filtered = filterLogs(logs, args.where);
        return filtered.slice(
          args.skip ?? 0,
          (args.skip ?? 0) + (args.take ?? filtered.length)
        );
      },
      update: async (args: {
        data: Record<string, unknown>;
        where: { id: string };
      }) => {
        calls.update.push(args);
        const record = logs.find((log) => log.id === args.where.id);

        if (!record) {
          return null;
        }

        Object.assign(record, args.data);
        return record;
      },
      updateMany: async (args: { data: Record<string, unknown>; where: Record<string, unknown> }) => {
        const records = filterLogs(logs, args.where);
        records.forEach(record => Object.assign(record, args.data));
        return { count: records.length };
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);

        return {
          email: "asha@example.com",
          id: "customer-1",
          isActive: true,
          mobileNumber: "+919876543210"
        };
      }
    }
  };
}

function createCartServiceMock(prisma?: ReturnType<typeof createQuoteRequestsPrismaMock>) {
  const calls: Record<string, unknown[]> = {
    replaceWithItems: []
  };

  return {
    calls,
    replaceWithItems: async (
      customerId: string,
      items: Array<{ productId: string; quantity: number; variantId?: string | null }>,
      onReplaced?: (client: unknown, cartId: string) => Promise<void>
    ) => {
      calls.replaceWithItems.push({ customerId, items });
      if (onReplaced) await onReplaced(prisma, "cart-1");

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
  };
}

function createOrdersServiceMock() {
  const calls: Record<string, unknown[]> = {
    createOrderFromQuote: []
  };

  return {
    calls,
    createOrderFromQuote: async (customerId: string, input: unknown) => {
      calls.createOrderFromQuote.push({ customerId, input });

      return {
        createdAt: now,
        id: "order-1",
        items: [],
        orderNumber: "ORD-20260615-QUOTE001",
        paymentMethod: "ONLINE",
        paymentStatus: "PENDING",
        placedAt: now,
        refunds: [],
        shippingAddress: null,
        status: "CREATED",
        statusHistory: [],
        totals: {
          deliveryCharge: 50,
          discount: 0,
          grandTotal: 600.4,
          subtotal: 500,
          tax: 50.4
        },
        updatedAt: now,
        warehouseId: null
      };
    }
  };
}

test("quote requests are saved, listed, and moved through admin status", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const cartService = createCartServiceMock(prisma);
  const service = new QuoteRequestsService(
    prisma as unknown as PrismaService,
    cartService as unknown as CartService
  );

  const created = await service.createQuoteRequest({
    email: "Asha@Example.com",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: "Asha Surgical Clinic"
  });

  assert.deepEqual(created, {
    createdAt: now,
    email: "asha@example.com",
    id: "quote-1",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: "Asha Surgical Clinic",
    quotation: null,
    customerDecision: null,
    convertedCartId: null,
    convertedOrderId: null,
    status: "NEW"
  });

  const list = await service.listAdminQuoteRequests({ status: "NEW" });

  assert.equal(list.items.length, 1);
  assert.deepEqual(
    (prisma.calls.findMany[0] as { where: Record<string, unknown> }).where,
    {
      channel: "support",
      status: "NEW",
      templateKey: "bulk_quote_request"
    }
  );

  const fetched = await service.getAdminQuoteRequest("quote-1");

  assert.equal(fetched.id, "quote-1");
  assert.equal(fetched.name, "Dr Asha Rao");

  const updated = await service.updateAdminQuoteRequestStatus("quote-1", {
    status: "CONTACTED"
  });

  assert.equal(updated.status, "CONTACTED");
  assert.equal(prisma.calls.update.length, 1);
});

test("admin can send an itemized quotation and customer can accept it", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const cartService = createCartServiceMock(prisma);
  const service = new QuoteRequestsService(
    prisma as unknown as PrismaService,
    cartService as unknown as CartService
  );

  await service.createQuoteRequest({
    email: "asha@example.com",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: null
  });

  const quoted = await service.sendAdminQuotation("quote-1", {
    items: [
      {
        name: "Curved Artery Forceps",
        productId: "product-1",
        quantity: 2,
        sku: "FORCEPS-001",
        taxRate: 18,
        unitPrice: 140,
        variantId: null
      },
      {
        name: "Sterile Draping Kit",
        quantity: 1,
        sku: "DRAPE-001",
        unitPrice: 220
      }
    ],
    notes: "Prices valid for current stock.",
    shippingTotal: 50,
    validUntil: "2099-06-30"
  });

  assert.equal(quoted.status, "QUOTED");
  assert.deepEqual(quoted.quotation?.totals, {
    grandTotal: 600.4,
    shippingTotal: 50,
    subtotal: 500,
    taxTotal: 50.4
  });
  assert.equal(quoted.quotation?.items[0]?.lineTotal, 330.4);

  const history = await service.listCustomerQuoteRequests("customer-1");

  assert.equal(history.items.length, 1);
  assert.equal(history.items[0]?.id, "quote-1");
  assert.equal(history.items[0]?.quotation?.items.length, 2);

  const accepted = await service.updateCustomerQuoteDecision("customer-1", "quote-1", {
    decision: "ACCEPTED",
    note: "Please prepare this for checkout."
  });

  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.customerDecision?.note, "Please prepare this for checkout.");
  assert.equal(accepted.customerDecision?.status, "ACCEPTED");
  assert.doesNotThrow(() =>
    new Date(accepted.customerDecision?.decidedAt ?? "").toISOString()
  );
});

test("accepted quotes with catalog items can be converted into the customer cart", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const cartService = createCartServiceMock(prisma);
  const service = new QuoteRequestsService(
    prisma as unknown as PrismaService,
    cartService as unknown as CartService
  );

  await service.createQuoteRequest({
    email: "asha@example.com",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: null
  });
  await service.sendAdminQuotation("quote-1", {
    items: [
      {
        name: "Curved Artery Forceps",
        productId: "product-1",
        quantity: 2,
        sku: "FORCEPS-001",
        unitPrice: 140,
        variantId: "variant-1"
      }
    ]
  });
  await service.updateCustomerQuoteDecision("customer-1", "quote-1", {
    decision: "ACCEPTED"
  });

  const converted = await service.convertCustomerQuoteToCart("customer-1", "quote-1");

  assert.equal(converted.cart.id, "cart-1");
  assert.equal(converted.quote.status, "CONVERTED");
  assert.equal(converted.quote.convertedCartId, "cart-1");
  assert.deepEqual(cartService.calls.replaceWithItems, [
    {
      customerId: "customer-1",
      items: [
        {
          productId: "product-1",
          quantity: 2,
          variantId: "variant-1"
        }
      ]
    }
  ]);
});

test("accepted quotes with custom lines can be converted into a customer order", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const cartService = createCartServiceMock(prisma);
  const ordersService = createOrdersServiceMock();
  const service = new QuoteRequestsService(
    prisma as unknown as PrismaService,
    cartService as unknown as CartService,
    ordersService as unknown as OrdersService
  );

  await service.createQuoteRequest({
    email: "asha@example.com",
    message: "Need custom draping kits for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: null
  });
  await service.sendAdminQuotation("quote-1", {
    items: [
      {
        name: "Custom sterile draping kit",
        quantity: 1,
        sku: "CUSTOM-DRAPE-001",
        taxRate: 18,
        unitPrice: 500
      }
    ],
    notes: "Custom kit built to requested dimensions.",
    shippingTotal: 50
  });
  await service.updateCustomerQuoteDecision("customer-1", "quote-1", {
    decision: "ACCEPTED"
  });

  const converted = await service.convertCustomerQuoteToOrder("customer-1", "quote-1");

  assert.equal(converted.order.id, "order-1");
  assert.equal(converted.quote.status, "CONVERTED");
  assert.equal(converted.quote.convertedOrderId, "order-1");
  assert.equal(converted.quote.convertedCartId, null);
  assert.deepEqual(ordersService.calls.createOrderFromQuote, [
    {
      customerId: "customer-1",
      input: {
        items: [
          {
            lineSubtotal: 500,
            lineTotal: 590,
            name: "Custom sterile draping kit",
            productId: null,
            quantity: 1,
            sku: "CUSTOM-DRAPE-001",
            taxAmount: 90,
            taxRate: 18,
            unitPrice: 500,
            variantId: null
          }
        ],
        notes: "Custom kit built to requested dimensions.",
        quoteId: "quote-1",
        totals: {
          grandTotal: 640,
          shippingTotal: 50,
          subtotal: 500,
          taxTotal: 90
        }
      }
    }
  ]);
});

function filterLogs(
  logs: Array<Record<string, unknown>>,
  where: Record<string, unknown> | undefined
) {
  if (!where) {
    return logs;
  }

  return logs.filter((log) => matchesWhere(log, where));
}

const requestInput = { name: "Quote test", email: "different@example.com", mobileNumber: "9876543210", message: "Two surgical instruments for our clinic" };
const quotationInput = { items: [{ name: "Custom kit", sku: "CUSTOM-KIT", quantity: 2, unitPrice: 100.25, taxRate: 5 }], shippingTotal: 25.5 };

test("mobile ownership includes a customer's requests with a different email without exposing another owner's request", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService, createCartServiceMock(prisma) as unknown as CartService);
  const quote = await service.createQuoteRequest(requestInput);
  assert.equal(quote.mobileNumber, "+919876543210");
  assert.equal((await service.listCustomerQuoteRequests("customer-1")).items[0]?.id, quote.id);
  prisma.logs[0]!.userId = "different-owner";
  assert.equal((await service.listCustomerQuoteRequests("customer-1")).items.length, 0);
  await assert.rejects(service.updateCustomerQuoteDecision("customer-1", quote.id, { decision: "ACCEPTED" }), /not found/);
});

test("legacy local-format mobile requests are visible to the matching verified mobile account", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService, createCartServiceMock(prisma) as unknown as CartService);
  await service.createQuoteRequest(requestInput);
  (prisma.logs[0]!.payload as Record<string, unknown>).mobileNumber = "9876543210";
  assert.equal((await service.listCustomerQuoteRequests("customer-1")).pagination.total, 1);
});

test("quote status transitions cannot bypass sending, customer acceptance, or conversion", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService, createCartServiceMock(prisma) as unknown as CartService);
  await service.createQuoteRequest(requestInput);
  for (const status of ["QUOTED", "ACCEPTED", "REJECTED", "CONVERTED"] as const) {
    await assert.rejects(service.updateAdminQuoteRequestStatus("quote-1", { status }), /workflow/);
  }
  await service.updateAdminQuoteRequestStatus("quote-1", { status: "CONTACTED" });
  await service.sendAdminQuotation("quote-1", quotationInput);
  await service.updateCustomerQuoteDecision("customer-1", "quote-1", { decision: "REJECTED" });
  await service.updateAdminQuoteRequestStatus("quote-1", { status: "CLOSED" });
  await assert.rejects(service.sendAdminQuotation("quote-1", quotationInput), /Closed or converted/);
  await service.updateAdminQuoteRequestStatus("quote-1", { status: "CONTACTED" });
  assert.equal((await service.sendAdminQuotation("quote-1", quotationInput)).status, "QUOTED");
});

test("expired quotes cannot be sent, accepted or converted but may be rejected", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const cart = createCartServiceMock(prisma);
  const orders = createOrdersServiceMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService, cart as unknown as CartService, orders as unknown as OrdersService);
  await service.createQuoteRequest(requestInput);
  await assert.rejects(service.sendAdminQuotation("quote-1", { ...quotationInput, validUntil: "2000-01-01" }), /expired/);
  await service.sendAdminQuotation("quote-1", quotationInput);
  const payload = prisma.logs[0]!.payload as { quotation: { validUntil: string | null } };
  payload.quotation.validUntil = "2000-01-01";
  await assert.rejects(service.updateCustomerQuoteDecision("customer-1", "quote-1", { decision: "ACCEPTED" }), /expired/);
  prisma.logs[0]!.status = "ACCEPTED";
  await assert.rejects(service.convertCustomerQuoteToCart("customer-1", "quote-1"), /expired/);
  await assert.rejects(service.convertCustomerQuoteToOrder("customer-1", "quote-1"), /expired/);
  assert.equal(cart.calls.replaceWithItems.length, 0);
  assert.equal(orders.calls.createOrderFromQuote.length, 0);
  await service.updateCustomerQuoteDecision("customer-1", "quote-1", { decision: "REJECTED" });
});

test("converted quotations keep their conversion reference and cannot be resent", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService, createCartServiceMock(prisma) as unknown as CartService);
  await service.createQuoteRequest(requestInput);
  await service.sendAdminQuotation("quote-1", { items: [{ ...quotationInput.items[0]!, productId: "product-1" }] });
  await service.updateCustomerQuoteDecision("customer-1", "quote-1", { decision: "ACCEPTED" });
  const result = await service.convertCustomerQuoteToCart("customer-1", "quote-1");
  assert.equal(result.quote.convertedCartId, "cart-1");
  await assert.rejects(service.sendAdminQuotation("quote-1", quotationInput), /Closed or converted/);
  await service.updateAdminQuoteRequestStatus("quote-1", { status: "CLOSED" });
  await assert.rejects(service.updateAdminQuoteRequestStatus("quote-1", { status: "CONTACTED" }), /workflow/);
});

test("quotation DTOs reject malformed identifiers, blank lines and unsafe numbers", async () => {
  const valid = { ...quotationInput, validUntil: "2099-06-30" };
  assert.equal((await validate(plainToInstance(SendQuoteResponseDto, valid))).length, 0);
  for (const override of [{ sku: " " }, { name: " " }, { quantity: 0 }, { quantity: 2.5 }, { quantity: 2_147_483_648 }, { unitPrice: true }, { unitPrice: "" }, { unitPrice: 1.234 }, { unitPrice: 10_000_000_000 }, { productId: "wrong" }, { variantId: "wrong" }, { taxRate: 101 }]) {
    const errors = await validate(plainToInstance(SendQuoteResponseDto, { ...valid, items: [{ ...quotationInput.items[0], ...override }] }));
    assert.ok(errors.length > 0, JSON.stringify(override));
  }
  for (const override of [{ shippingTotal: true }, { shippingTotal: -1 }, { shippingTotal: 10_000_000_000 }, { validUntil: "2026-02-30" }, { items: [] }]) {
    assert.ok((await validate(plainToInstance(SendQuoteResponseDto, { ...valid, ...override }))).length > 0);
  }
});

function matchesWhere(log: Record<string, unknown>, where: Record<string, unknown>) {
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) {
      continue;
    }

    if (key === "OR" && Array.isArray(value)) {
      if (!value.some((entry) => matchesWhere(log, entry as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    if (key === "payload" && value && typeof value === "object") {
      const filter = value as { path: string[]; equals: unknown };
      let entry: unknown = log.payload;
      for (const part of filter.path) entry = (entry as Record<string, unknown>)?.[part];
      if (entry !== filter.equals) return false;
      continue;
    }

    if (log[key] !== value) {
      return false;
    }
  }

  return true;
}
