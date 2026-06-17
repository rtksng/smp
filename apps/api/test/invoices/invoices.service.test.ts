import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { AuthTokenAudience } from "../../src/modules/auth/common/auth-token.service";
import type { AuthJwtPayload } from "../../src/modules/auth/common/auth-token.service";
import { AdminRoleCode } from "../../src/modules/roles/roles.constants";
import { InvoiceFormat } from "../../src/modules/invoices/dto/invoice.dto";
import { prepareInvoiceHttpResponse } from "../../src/modules/invoices/invoice-http-response";
import { InvoicesService } from "../../src/modules/invoices/invoices.service";
import type { WarehouseAccessService } from "../../src/modules/warehouses/warehouse-access.service";

const now = new Date("2026-05-25T10:00:00.000Z");
const todayInvoicePrefix = buildTodayNumberPrefix("INV");

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

  async assertCanManageWarehouse(_auth: AuthJwtPayload, warehouseId: string) {
    this.assertedWarehouseIds.push(warehouseId);
  }
}

function createInvoicePrismaMock(input?: {
  billingState?: string;
  orderStatus?: string;
  paymentMethod?: "COD" | "ONLINE";
  paymentStatus?: string;
  warehouseState?: string;
}) {
  const invoices: Record<string, unknown>[] = [];
  const billingState = input?.billingState ?? "Maharashtra";
  const warehouseState = input?.warehouseState ?? "Maharashtra";
  const paymentMethod = input?.paymentMethod ?? "ONLINE";
  const order = {
    billingAddress: {
      city: "Mumbai",
      country: "India",
      fullName: "Ritika Singh",
      id: "billing-address-1",
      line1: "Clinic Road",
      line2: null,
      mobileNumber: "9999999999",
      pincode: "400001",
      state: billingState
    },
    createdAt: now,
    deletedAt: null,
    grandTotal: "236.00",
    id: "order-1",
    items: [
      {
        id: "order-item-1",
        name: "Curved Artery Forceps",
        productId: "product-1",
        quantity: 2,
        sku: "FORCEPS-001",
        taxAmount: "36.00",
        taxRate: "18.00",
        total: "236.00",
        unitPrice: "100.00"
      }
    ],
    orderNumber: "ORD-20260525-000001",
    paymentStatus: input?.paymentStatus ?? "PAID",
    payments: [
      {
        method: paymentMethod,
        status: input?.paymentStatus ?? "PAID"
      }
    ],
    shippingAddress: {
      city: "Mumbai",
      country: "India",
      fullName: "Ritika Singh",
      id: "shipping-address-1",
      line1: "Clinic Road",
      line2: null,
      mobileNumber: "9999999999",
      pincode: "400001",
      state: billingState
    },
    status: input?.orderStatus ?? "CONFIRMED",
    subtotal: "200.00",
    taxTotal: "36.00",
    updatedAt: now,
    user: {
      businessName: "Ritika Surgical Clinic",
      email: "ritika@example.com",
      firstName: "Ritika",
      gstNumber: "27ABCDE1234F1Z5",
      id: "customer-1",
      lastName: "Singh",
      mobileNumber: "9999999999"
    },
    userId: "customer-1",
    warehouse: {
      id: "warehouse-1",
      state: warehouseState
    },
    warehouseId: "warehouse-1"
  };
  const calls: Record<string, unknown[]> = {
    gSTInvoiceCount: [],
    gSTInvoiceCreate: [],
    gSTInvoiceFindFirst: [],
    orderFindFirst: []
  };
  const prisma = {
    calls,
    records: {
      invoices,
      order
    },
    gSTInvoice: {
      count: async (args: unknown) => {
        calls.gSTInvoiceCount.push(args);
        return invoices.length;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.gSTInvoiceCreate.push(args);
        const data = args.data as {
          items: { create: Record<string, unknown>[] };
        } & Record<string, unknown>;
        const invoice = {
          ...data,
          createdAt: now,
          id: "invoice-1",
          issuedAt: data.issuedAt ?? now,
          items: data.items.create.map((item, index) => ({
            ...item,
            createdAt: now,
            id: `invoice-item-${index + 1}`,
            invoiceId: "invoice-1",
            updatedAt: now
          })),
          order,
          updatedAt: now
        };

        invoices.push(invoice);
        return invoice;
      },
      findFirst: async (args: unknown) => {
        calls.gSTInvoiceFindFirst.push(args);
        return invoices[0] ?? null;
      }
    },
    order: {
      findFirst: async (args: unknown) => {
        calls.orderFindFirst.push(args);
        const where = (args as {
          where: { deletedAt?: null; id?: string; userId?: string };
        }).where;

        if (where.id !== order.id) {
          return null;
        }

        if (where.userId && where.userId !== order.userId) {
          return null;
        }

        return order;
      }
    }
  };

  return prisma;
}

test("getCustomerInvoice creates a same-state GST invoice with CGST and SGST from order item snapshots", async () => {
  const prisma = createInvoicePrismaMock();
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const invoice = await service.getCustomerInvoice("customer-1", "order-1");

  assert.match(invoice.invoiceNumber, new RegExp(`^${todayInvoicePrefix}-`));
  assert.equal(invoice.customer.gstNumber, "27ABCDE1234F1Z5");
  assert.equal(invoice.customer.businessName, "Ritika Surgical Clinic");
  assert.equal(invoice.taxBreakup.taxType, "CGST_SGST");
  assert.equal(invoice.taxBreakup.cgst, 18);
  assert.equal(invoice.taxBreakup.sgst, 18);
  assert.equal(invoice.taxBreakup.igst, 0);
  assert.equal(invoice.items[0].description, "Curved Artery Forceps");
  assert.equal(invoice.items[0].sku, "FORCEPS-001");
  assert.equal(invoice.items[0].cgstAmount, 18);
  assert.equal(invoice.items[0].sgstAmount, 18);
  assert.equal(invoice.items[0].igstAmount, 0);
  assert.match(invoice.html, /Curved Artery Forceps/);
  assert.match(invoice.html, /CGST/);
  assert.equal(invoice.pdf.available, true);
  assert.equal(invoice.pdf.status, "ON_DEMAND");
  assert.equal(prisma.calls.gSTInvoiceCreate.length, 1);
});

test("prepareInvoiceHttpResponse returns downloadable PDF bytes", async () => {
  const prisma = createInvoicePrismaMock();
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );
  const invoice = await service.getCustomerInvoice("customer-1", "order-1");
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => {
      headers.set(name.toLowerCase(), value);
    }
  };

  const body = prepareInvoiceHttpResponse(
    invoice,
    { format: InvoiceFormat.Pdf },
    response as never
  );

  assert.ok(Buffer.isBuffer(body));
  assert.equal(body.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.equal(headers.get("content-type"), "application/pdf");
  assert.equal(headers.get("content-length"), String(body.byteLength));
  assert.equal(
    headers.get("content-disposition"),
    `attachment; filename="${invoice.invoiceNumber}.pdf"`
  );
  const pdfSource = body.toString("utf8");
  assert.match(pdfSource, /GST Invoice/);
  assert.match(pdfSource, /Ritika Surgical Clinic/);
  assert.match(pdfSource, /Curved Artery Forceps/);
  assert.match(pdfSource, /Unit price/);
  assert.match(pdfSource, /Taxable value/);
  assert.match(pdfSource, /Grand total/);
});

test("getCustomerInvoice creates an interstate GST invoice with IGST only", async () => {
  const prisma = createInvoicePrismaMock({
    billingState: "Delhi",
    warehouseState: "Karnataka"
  });
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  const invoice = await service.getCustomerInvoice("customer-1", "order-1");

  assert.equal(invoice.taxBreakup.taxType, "IGST");
  assert.equal(invoice.taxBreakup.cgst, 0);
  assert.equal(invoice.taxBreakup.sgst, 0);
  assert.equal(invoice.taxBreakup.igst, 36);
  assert.equal(invoice.items[0].cgstAmount, 0);
  assert.equal(invoice.items[0].sgstAmount, 0);
  assert.equal(invoice.items[0].igstAmount, 36);
  assert.match(invoice.html, /IGST/);
});

test("getCustomerInvoice rejects orders that are not confirmed or paid", async () => {
  const prisma = createInvoicePrismaMock({
    orderStatus: "CREATED",
    paymentStatus: "PENDING"
  });
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    new FakeWarehouseAccess() as unknown as WarehouseAccessService
  );

  await assert.rejects(
    () => service.getCustomerInvoice("customer-1", "order-1"),
    BadRequestException
  );
  assert.equal(prisma.calls.gSTInvoiceCreate.length, 0);
});

test("getAdminInvoice applies warehouse scope before returning invoice data", async () => {
  const prisma = createInvoicePrismaMock();
  const warehouseAccess = new FakeWarehouseAccess();
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    warehouseAccess as unknown as WarehouseAccessService
  );

  const invoice = await service.getAdminInvoice("order-1", adminAuth());

  assert.equal(invoice.orderId, "order-1");
  assert.deepEqual(warehouseAccess.assertedWarehouseIds, ["warehouse-1"]);
}
);
