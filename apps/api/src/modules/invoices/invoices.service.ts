import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma
} from "../../generated/prisma/client";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { WarehouseAccessService } from "../warehouses/warehouse-access.service";

const INVOICE_ORDER_INCLUDE = {
  billingAddress: true,
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  shippingAddress: true,
  user: true,
  warehouse: true
} as const satisfies Prisma.OrderInclude;

const INVOICE_INCLUDE = {
  items: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  order: {
    include: {
      billingAddress: true,
      shippingAddress: true,
      user: true,
      warehouse: true
    }
  }
} as const satisfies Prisma.GSTInvoiceInclude;

const INVOICEABLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.RETURNED
]);

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };
type InvoiceOrder = Prisma.OrderGetPayload<{
  include: typeof INVOICE_ORDER_INCLUDE;
}>;
type InvoiceRecord = Prisma.GSTInvoiceGetPayload<{
  include: typeof INVOICE_INCLUDE;
}>;
type InvoiceClient =
  | Pick<Prisma.TransactionClient, "gSTInvoice" | "order">
  | PrismaService;
type TaxType = "CGST_SGST" | "IGST";

type InvoiceDraftItem = {
  cgstAmount: number;
  cgstRate: number;
  description: string;
  hsnCode: string | null;
  igstAmount: number;
  igstRate: number;
  orderItemId: string;
  productId: string;
  quantity: number;
  sgstAmount: number;
  sgstRate: number;
  sku: string;
  taxableValue: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  unitPrice: number;
};

type InvoiceDraft = {
  billingAddress: string;
  billingName: string;
  cgstTotal: number;
  customerBusinessName: string | null;
  customerEmail: string | null;
  customerMobileNumber: string;
  customerName: string;
  destinationState: string;
  grandTotal: number;
  gstNumber: string | null;
  igstTotal: number;
  invoiceNumber: string;
  issuedAt: Date;
  items: InvoiceDraftItem[];
  orderId: string;
  orderNumber: string;
  pdfStatus: string;
  placeOfSupply: string;
  sgstTotal: number;
  sourceState: string | null;
  subtotal: number;
  taxTotal: number;
  taxType: TaxType;
};

type InvoiceResponseItem = Omit<InvoiceDraftItem, "orderItemId"> & {
  id: string;
  invoiceId: string;
  orderItemId: string | null;
};

export type InvoiceResponse = {
  billing: {
    address: string;
    name: string;
    placeOfSupply: string;
  };
  customer: {
    businessName: string | null;
    email: string | null;
    gstNumber: string | null;
    mobileNumber: string;
    name: string;
  };
  destinationState: string;
  html: string;
  id: string;
  invoiceNumber: string;
  issuedAt: Date;
  items: InvoiceResponseItem[];
  orderId: string;
  orderNumber: string;
  pdf: {
    available: false;
    message: string;
    status: string;
  };
  sourceState: string | null;
  taxBreakup: {
    cgst: number;
    igst: number;
    sgst: number;
    taxType: TaxType;
  };
  totals: {
    grandTotal: number;
    subtotal: number;
    tax: number;
  };
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService
  ) {}

  async getCustomerInvoice(customerId: string, orderId: string) {
    const order = await this.findInvoiceOrder(this.prisma, orderId, customerId);

    return this.getOrCreateInvoice(this.prisma, order);
  }

  async getAdminInvoice(orderId: string, auth: AuthJwtPayload) {
    const order = await this.findInvoiceOrder(this.prisma, orderId);

    if (order.warehouseId !== null) {
      await this.warehouseAccessService.assertCanManageWarehouse(
        auth,
        order.warehouseId
      );
    }

    return this.getOrCreateInvoice(this.prisma, order);
  }

  async generateForConfirmedOrder(client: InvoiceClient, orderId: string) {
    const order = await this.findInvoiceOrder(client, orderId);

    return this.getOrCreateInvoice(client, order);
  }

  private async getOrCreateInvoice(client: InvoiceClient, order: InvoiceOrder) {
    const existingInvoice = await client.gSTInvoice.findFirst({
      include: INVOICE_INCLUDE,
      where: {
        orderId: order.id
      }
    });

    if (existingInvoice) {
      return this.serializeInvoice(existingInvoice);
    }

    this.assertInvoiceable(order);

    const invoiceNumber = await this.generateInvoiceNumber(client);
    const issuedAt = new Date();
    const draft = this.buildInvoiceDraft(order, invoiceNumber, issuedAt);
    const html = renderInvoiceHtml(draft);
    const invoice = await client.gSTInvoice.create({
      data: {
        billingAddress: draft.billingAddress,
        billingName: draft.billingName,
        cgstTotal: draft.cgstTotal,
        customerBusinessName: draft.customerBusinessName,
        customerEmail: draft.customerEmail,
        customerMobileNumber: draft.customerMobileNumber,
        customerName: draft.customerName,
        destinationState: draft.destinationState,
        grandTotal: draft.grandTotal,
        gstNumber: draft.gstNumber,
        html,
        igstTotal: draft.igstTotal,
        invoiceNumber: draft.invoiceNumber,
        issuedAt,
        items: {
          create: draft.items.map((item) => ({
            cgstAmount: item.cgstAmount,
            cgstRate: item.cgstRate,
            description: item.description,
            hsnCode: item.hsnCode,
            igstAmount: item.igstAmount,
            igstRate: item.igstRate,
            orderItemId: item.orderItemId,
            productId: item.productId,
            quantity: item.quantity,
            sgstAmount: item.sgstAmount,
            sgstRate: item.sgstRate,
            sku: item.sku,
            taxableValue: item.taxableValue,
            taxAmount: item.taxAmount,
            taxRate: item.taxRate,
            total: item.total,
            unitPrice: item.unitPrice
          }))
        },
        orderId: draft.orderId,
        pdfStatus: draft.pdfStatus,
        placeOfSupply: draft.placeOfSupply,
        sgstTotal: draft.sgstTotal,
        sourceState: draft.sourceState,
        subtotal: draft.subtotal,
        taxTotal: draft.taxTotal,
        taxType: draft.taxType
      },
      include: INVOICE_INCLUDE
    });

    return this.serializeInvoice(invoice);
  }

  private async findInvoiceOrder(
    client: InvoiceClient,
    orderId: string,
    customerId?: string
  ) {
    const order = await client.order.findFirst({
      include: INVOICE_ORDER_INCLUDE,
      where: stripUndefined({
        deletedAt: null,
        id: orderId,
        userId: customerId
      })
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    return order;
  }

  private assertInvoiceable(order: InvoiceOrder) {
    if (!INVOICEABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        "Invoice can be generated only after the order is confirmed."
      );
    }

    const paymentMethod = order.payments[0]?.method ?? null;

    if (
      paymentMethod === PaymentMethod.ONLINE &&
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new BadRequestException(
        "Online order invoice can be generated only after payment succeeds."
      );
    }

    if (order.items.length === 0) {
      throw new BadRequestException("Order has no invoiceable items.");
    }
  }

  private buildInvoiceDraft(
    order: InvoiceOrder,
    invoiceNumber: string,
    issuedAt: Date
  ): InvoiceDraft {
    const customerName = formatCustomerName(order.user);
    const billingAddress = order.billingAddress ?? order.shippingAddress;
    const billingName = billingAddress?.fullName ?? customerName;
    const destinationState = billingAddress?.state ?? order.shippingAddress?.state ?? "";
    const sourceState = order.warehouse?.state ?? (destinationState || null);
    const taxType = isSameState(sourceState, destinationState)
      ? "CGST_SGST"
      : "IGST";
    const items = order.items.map((item) => buildInvoiceItem(item, taxType));
    const cgstTotal = roundMoney(
      items.reduce((sum, item) => sum + item.cgstAmount, 0)
    );
    const sgstTotal = roundMoney(
      items.reduce((sum, item) => sum + item.sgstAmount, 0)
    );
    const igstTotal = roundMoney(
      items.reduce((sum, item) => sum + item.igstAmount, 0)
    );

    return {
      billingAddress: billingAddress ? formatAddress(billingAddress) : "",
      billingName,
      cgstTotal,
      customerBusinessName: order.user.businessName,
      customerEmail: order.user.email,
      customerMobileNumber: order.user.mobileNumber,
      customerName,
      destinationState,
      grandTotal: decimalToNumber(order.grandTotal),
      gstNumber: order.user.gstNumber,
      igstTotal,
      invoiceNumber,
      issuedAt,
      items,
      orderId: order.id,
      orderNumber: order.orderNumber,
      pdfStatus: "NOT_GENERATED",
      placeOfSupply: destinationState,
      sgstTotal,
      sourceState,
      subtotal: decimalToNumber(order.subtotal),
      taxTotal: roundMoney(cgstTotal + sgstTotal + igstTotal),
      taxType
    };
  }

  private async generateInvoiceNumber(client: InvoiceClient) {
    const date = new Date();
    const datePart = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `INV-${datePart}-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;
      const existing = await client.gSTInvoice.count({
        where: {
          invoiceNumber: candidate
        }
      });

      if (existing === 0) {
        return candidate;
      }
    }

    throw new BadRequestException("Could not generate a unique invoice number.");
  }

  private serializeInvoice(invoice: InvoiceRecord): InvoiceResponse {
    return {
      billing: {
        address: invoice.billingAddress,
        name: invoice.billingName,
        placeOfSupply: invoice.placeOfSupply
      },
      customer: {
        businessName: invoice.customerBusinessName,
        email: invoice.customerEmail,
        gstNumber: invoice.gstNumber,
        mobileNumber: invoice.customerMobileNumber,
        name: invoice.customerName
      },
      destinationState: invoice.destinationState,
      html: invoice.html,
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      items: invoice.items.map((item) => ({
        cgstAmount: decimalToNumber(item.cgstAmount),
        cgstRate: decimalToNumber(item.cgstRate),
        description: item.description,
        hsnCode: item.hsnCode,
        id: item.id,
        igstAmount: decimalToNumber(item.igstAmount),
        igstRate: decimalToNumber(item.igstRate),
        invoiceId: item.invoiceId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        quantity: item.quantity,
        sgstAmount: decimalToNumber(item.sgstAmount),
        sgstRate: decimalToNumber(item.sgstRate),
        sku: item.sku,
        taxableValue: decimalToNumber(item.taxableValue),
        taxAmount: decimalToNumber(item.taxAmount),
        taxRate: decimalToNumber(item.taxRate),
        total: decimalToNumber(item.total),
        unitPrice: decimalToNumber(item.unitPrice)
      })),
      orderId: invoice.orderId,
      orderNumber: invoice.order.orderNumber,
      pdf: {
        available: false,
        message: "PDF generation is reserved for the async invoice worker.",
        status: invoice.pdfStatus
      },
      sourceState: invoice.sourceState,
      taxBreakup: {
        cgst: decimalToNumber(invoice.cgstTotal),
        igst: decimalToNumber(invoice.igstTotal),
        sgst: decimalToNumber(invoice.sgstTotal),
        taxType: invoice.taxType as TaxType
      },
      totals: {
        grandTotal: decimalToNumber(invoice.grandTotal),
        subtotal: decimalToNumber(invoice.subtotal),
        tax: decimalToNumber(invoice.taxTotal)
      }
    };
  }
}

function buildInvoiceItem(
  item: InvoiceOrder["items"][number],
  taxType: TaxType
): InvoiceDraftItem {
  const taxableValue = roundMoney(decimalToNumber(item.unitPrice) * item.quantity);
  const taxRate = decimalToNumber(item.taxRate);
  const taxAmount = decimalToNumber(item.taxAmount);
  const taxSplit =
    taxType === "CGST_SGST"
      ? {
          cgstAmount: roundMoney(taxAmount / 2),
          cgstRate: roundMoney(taxRate / 2),
          igstAmount: 0,
          igstRate: 0,
          sgstAmount: roundMoney(taxAmount / 2),
          sgstRate: roundMoney(taxRate / 2)
        }
      : {
          cgstAmount: 0,
          cgstRate: 0,
          igstAmount: taxAmount,
          igstRate: taxRate,
          sgstAmount: 0,
          sgstRate: 0
        };

  return {
    ...taxSplit,
    description: item.name,
    hsnCode: null,
    orderItemId: item.id,
    productId: item.productId,
    quantity: item.quantity,
    sku: item.sku,
    taxableValue,
    taxAmount,
    taxRate,
    total: decimalToNumber(item.total),
    unitPrice: decimalToNumber(item.unitPrice)
  };
}

function renderInvoiceHtml(invoice: InvoiceDraft) {
  const taxColumns =
    invoice.taxType === "CGST_SGST"
      ? "<th>CGST</th><th>SGST</th>"
      : "<th>IGST</th>";
  const rows = invoice.items
    .map((item) => {
      const taxCells =
        invoice.taxType === "CGST_SGST"
          ? `<td>${formatMoney(item.cgstAmount)} (${formatRate(item.cgstRate)}%)</td><td>${formatMoney(item.sgstAmount)} (${formatRate(item.sgstRate)}%)</td>`
          : `<td>${formatMoney(item.igstAmount)} (${formatRate(item.igstRate)}%)</td>`;

      return `<tr><td>${escapeHtml(item.description)}<br><span>${escapeHtml(item.sku)}</span></td><td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td>${formatMoney(item.taxableValue)}</td>${taxCells}<td>${formatMoney(item.total)}</td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>GST Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { color: #111827; font-family: Arial, sans-serif; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    h2 { font-size: 14px; margin: 24px 0 8px; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .meta { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; margin-bottom: 24px; }
    .muted, span { color: #6b7280; }
    .totals { margin-left: auto; margin-top: 16px; width: 320px; }
  </style>
</head>
<body>
  <h1>GST Invoice</h1>
  <div class="meta">
    <div>
      <strong>Invoice:</strong> ${escapeHtml(invoice.invoiceNumber)}<br>
      <strong>Order:</strong> ${escapeHtml(invoice.orderNumber)}<br>
      <strong>Issued:</strong> ${invoice.issuedAt.toISOString()}
    </div>
    <div>
      <strong>Tax type:</strong> ${invoice.taxType}<br>
      <strong>Source state:</strong> ${escapeHtml(invoice.sourceState ?? "")}<br>
      <strong>Place of supply:</strong> ${escapeHtml(invoice.placeOfSupply)}
    </div>
  </div>
  <h2>Bill To</h2>
  <p>
    <strong>${escapeHtml(invoice.billingName)}</strong><br>
    ${escapeHtml(invoice.billingAddress)}<br>
    <span>Customer: ${escapeHtml(invoice.customerName)}</span><br>
    <span>GSTIN: ${escapeHtml(invoice.gstNumber ?? "Not provided")}</span>
  </p>
  <h2>Items</h2>
  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Taxable value</th>${taxColumns}<th>Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tbody>
      <tr><th>Subtotal</th><td>${formatMoney(invoice.subtotal)}</td></tr>
      <tr><th>CGST</th><td>${formatMoney(invoice.cgstTotal)}</td></tr>
      <tr><th>SGST</th><td>${formatMoney(invoice.sgstTotal)}</td></tr>
      <tr><th>IGST</th><td>${formatMoney(invoice.igstTotal)}</td></tr>
      <tr><th>Tax total</th><td>${formatMoney(invoice.taxTotal)}</td></tr>
      <tr><th>Grand total</th><td>${formatMoney(invoice.grandTotal)}</td></tr>
    </tbody>
  </table>
</body>
</html>`;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAddress(
  address: NonNullable<InvoiceOrder["billingAddress"]>
) {
  const cityStatePincode = [address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(" ");

  return [
    address.line1,
    address.line2,
    cityStatePincode,
    address.country
  ]
    .filter(Boolean)
    .join(", ");
}

function formatCustomerName(user: InvoiceOrder["user"]) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.businessName || user.mobileNumber;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatRate(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function isSameState(sourceState: string | null, destinationState: string) {
  if (!sourceState || !destinationState) {
    return true;
  }

  return normalizeState(sourceState) === normalizeState(destinationState);
}

function normalizeState(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
