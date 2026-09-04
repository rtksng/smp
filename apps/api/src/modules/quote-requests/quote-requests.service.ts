import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CartService } from "../cart/cart.service";
import { OrdersService } from "../orders/orders.service";
import { assertQuotationIsCurrent, quoteLineKey } from "./quote-cart-pricing";
import type {
  CreateQuoteRequestDto,
  QuoteRequestListQueryDto,
  QuoteCustomerDecisionStatus,
  QuoteRequestStatus,
  SendQuoteItemDto,
  SendQuoteResponseDto,
  UpdateCustomerQuoteDecisionDto,
  UpdateQuoteRequestStatusDto
} from "./dto/quote-request.dto";

const QUOTE_REQUEST_TEMPLATE_KEY = "bulk_quote_request";
const QUOTE_REQUEST_CHANNEL = "support";

type QuotePayload = {
  email: string;
  message: string;
  mobileNumber: string;
  name: string;
  organization: string | null;
  quotation: QuoteQuotation | null;
  customerDecision: QuoteCustomerDecision | null;
  convertedCartId: string | null;
  convertedOrderId: string | null;
};

type QuoteQuotation = {
  items: QuoteQuotationItem[];
  notes: string | null;
  respondedAt: string;
  totals: QuoteQuotationTotals;
  validUntil: string | null;
};

type QuoteQuotationItem = {
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

type QuoteQuotationTotals = {
  grandTotal: number;
  shippingTotal: number;
  subtotal: number;
  taxTotal: number;
};

type QuoteCustomerDecision = {
  decidedAt: string;
  note: string | null;
  status: QuoteCustomerDecisionStatus;
};

type QuoteLogRecord = Prisma.NotificationLogGetPayload<Record<string, never>>;
type CustomerOwner = Pick<QuoteCustomerRecord, "email" | "id" | "mobileNumber">;
type QuoteCustomerRecord = Prisma.UserGetPayload<{
  select: {
    email: true;
    id: true;
    mobileNumber: true;
  };
}>;

@Injectable()
export class QuoteRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    @Optional() private readonly ordersService?: OrdersService
  ) {}

  async createQuoteRequest(input: CreateQuoteRequestDto) {
    const payload = normalizeQuotePayload(input);
    const request = await this.prisma.notificationLog.create({
      data: {
        channel: QUOTE_REQUEST_CHANNEL,
        payload: toJsonValue(payload),
        recipient: payload.email,
        status: "NEW",
        templateKey: QUOTE_REQUEST_TEMPLATE_KEY
      }
    });

    return serializeQuoteRequest(request);
  }

  async listCustomerQuoteRequests(
    customerId: string,
    query: QuoteRequestListQueryDto = {}
  ) {
    const customer = await this.findActiveCustomer(customerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationLogWhereInput = {
      channel: QUOTE_REQUEST_CHANNEL,
      OR: buildCustomerQuoteOwnershipWhere(customer),
      status: query.status,
      templateKey: QUOTE_REQUEST_TEMPLATE_KEY
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.notificationLog.count({
        where: stripUndefined(where)
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((item) => serializeQuoteRequest(item)),
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

  async listAdminQuoteRequests(query: QuoteRequestListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationLogWhereInput = {
      channel: QUOTE_REQUEST_CHANNEL,
      status: query.status,
      templateKey: QUOTE_REQUEST_TEMPLATE_KEY
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.notificationLog.count({
        where: stripUndefined(where)
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((item) => serializeQuoteRequest(item)),
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

  async getAdminQuoteRequest(id: string) {
    const request = await this.findQuoteRequest(id);

    return serializeQuoteRequest(request);
  }

  async sendAdminQuotation(id: string, input: SendQuoteResponseDto) {
    const request = await this.findQuoteRequest(id);
    const payload = readQuotePayload(request.payload);
    assertQuoteCanBeEdited(request.status, payload);
    const quotation = buildQuotation(input);
    const updated = await this.prisma.notificationLog.update({
      data: {
        payload: toJsonValue({
          ...payload,
          convertedCartId: null,
          convertedOrderId: null,
          customerDecision: null,
          quotation
        }),
        status: "QUOTED"
      },
      where: {
        id
      }
    });

    return serializeQuoteRequest(updated);
  }

  async updateAdminQuoteRequestStatus(id: string, input: UpdateQuoteRequestStatusDto) {
    const request = await this.findQuoteRequest(id);
    const payload = readQuotePayload(request.payload);
    if (input.status === request.status) return serializeQuoteRequest(request);
    const allowed = request.status === "CLOSED"
      ? (payload.convertedCartId || payload.convertedOrderId ? [] : ["CONTACTED"])
      : request.status === "NEW" ? ["CONTACTED", "CLOSED"]
      : request.status === "CONTACTED" && !payload.quotation ? ["NEW", "CLOSED"]
      : ["CLOSED"];
    if (!allowed.includes(input.status)) {
      throw new BadRequestException("Send a quotation, record the customer decision, or convert it through the quote workflow instead of setting that status manually.");
    }

    const updated = await this.prisma.notificationLog.update({
      data: {
        status: input.status
      },
      where: {
        id
      }
    });

    return serializeQuoteRequest(updated);
  }

  async updateCustomerQuoteDecision(
    customerId: string,
    id: string,
    input: UpdateCustomerQuoteDecisionDto
  ) {
    const request = await this.findCustomerQuoteRequest(customerId, id);
    const payload = readQuotePayload(request.payload);

    if (!payload.quotation) {
      throw new BadRequestException("No quotation has been sent for this request.");
    }

    if (!["QUOTED", "ACCEPTED", "REJECTED"].includes(request.status)) {
      throw new BadRequestException(
        "Only quoted requests can be accepted or rejected."
      );
    }
    if (input.decision === "ACCEPTED") assertQuotationIsCurrent(payload.quotation);

    const status: QuoteRequestStatus = input.decision;
    const customerDecision: QuoteCustomerDecision = {
      decidedAt: new Date().toISOString(),
      note: trimmedOrNull(input.note),
      status
    };
    const updated = await this.prisma.notificationLog.update({
      data: {
        userId: customerId,
        payload: toJsonValue({
          ...payload,
          convertedCartId: status === "REJECTED" ? null : payload.convertedCartId,
          convertedOrderId: status === "REJECTED" ? null : payload.convertedOrderId,
          customerDecision
        }),
        status
      },
      where: {
        id
      }
    });

    return serializeQuoteRequest(updated);
  }

  async convertCustomerQuoteToCart(customerId: string, id: string) {
    const request = await this.findCustomerQuoteRequest(customerId, id);
    const payload = readQuotePayload(request.payload);

    if (!payload.quotation) {
      throw new BadRequestException("No quotation has been sent for this request.");
    }

    if (!["ACCEPTED", "CONVERTED"].includes(request.status)) {
      throw new BadRequestException("Accept the quotation before preparing the cart.");
    }
    if (payload.convertedOrderId) throw new BadRequestException("This quotation already has an order. View the existing order instead.");
    assertQuotationIsCurrent(payload.quotation);

    const cartItems = payload.quotation.items.map((item) => {
      if (!item.productId) {
        throw new BadRequestException(
          "Quote contains custom lines that cannot be sent to cart."
        );
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId
      };
    });
    const cart = await this.cartService.replaceWithItems(customerId, cartItems, async (tx, cartId) => {
      const update = await tx.notificationLog.updateMany({
      data: {
        payload: toJsonValue({
          ...payload,
          convertedCartId: cartId,
          convertedOrderId: null
        }),
        status: "CONVERTED"
      },
      where: {
        id,
        status: request.status,
        updatedAt: request.updatedAt
      }
    });
      if (update.count !== 1) throw new BadRequestException("The quotation changed. Refresh it before preparing the cart.");
    });

    return {
      cart,
      quote: serializeQuoteRequest(await this.findQuoteRequest(id))
    };
  }

  async convertCustomerQuoteToOrder(customerId: string, id: string) {
    if (!this.ordersService) {
      throw new BadRequestException("Order service is unavailable.");
    }

    const request = await this.findCustomerQuoteRequest(customerId, id);
    const payload = readQuotePayload(request.payload);

    if (!payload.quotation) {
      throw new BadRequestException("No quotation has been sent for this request.");
    }

    if (!["ACCEPTED", "CONVERTED"].includes(request.status)) {
      throw new BadRequestException("Accept the quotation before creating an order.");
    }

    if (payload.convertedOrderId) {
      return {
        order: await this.ordersService.getMyOrder(
          customerId,
          payload.convertedOrderId
        ),
        quote: serializeQuoteRequest(request)
      };
    }
    assertQuotationIsCurrent(payload.quotation);

    const containsCustomLines = payload.quotation.items.some((item) => !item.productId);

    if (!containsCustomLines) {
      throw new BadRequestException(
        "Quote contains only catalog items. Prepare the cart instead."
      );
    }

    const order = await this.ordersService.createOrderFromQuote(customerId, {
      items: payload.quotation.items,
      notes: payload.quotation.notes,
      quoteId: id,
      totals: payload.quotation.totals
    });
    const updated = await this.prisma.notificationLog.update({
      data: {
        payload: toJsonValue({
          ...payload,
          convertedCartId: null,
          convertedOrderId: getOrderId(order)
        }),
        status: "CONVERTED"
      },
      where: {
        id
      }
    });

    return {
      order,
      quote: serializeQuoteRequest(updated)
    };
  }

  private async findQuoteRequest(id: string) {
    const request = await this.prisma.notificationLog.findFirst({
      where: {
        channel: QUOTE_REQUEST_CHANNEL,
        id,
        templateKey: QUOTE_REQUEST_TEMPLATE_KEY
      }
    });

    if (!request) {
      throw new NotFoundException("Quote request was not found.");
    }

    return request;
  }

  private async findCustomerQuoteRequest(customerId: string, id: string) {
    const customer = await this.findActiveCustomer(customerId);
    const request = await this.prisma.notificationLog.findFirst({
      where: {
        channel: QUOTE_REQUEST_CHANNEL,
        id,
        OR: buildCustomerQuoteOwnershipWhere(customer),
        templateKey: QUOTE_REQUEST_TEMPLATE_KEY
      }
    });

    if (!request) {
      throw new NotFoundException("Quote request was not found.");
    }

    return request;
  }

  private async findActiveCustomer(customerId: string) {
    const customer = await this.prisma.user.findFirst({
      select: {
        email: true,
        id: true,
        mobileNumber: true
      },
      where: {
        deletedAt: null,
        id: customerId,
        isActive: true
      }
    });

    if (!customer) {
      throw new UnauthorizedException("Customer account is inactive.");
    }

    return customer;
  }
}

function normalizeQuotePayload(input: CreateQuoteRequestDto): QuotePayload {
  if (input.name.trim().length < 2 || input.message.trim().length < 10) {
    throw new BadRequestException("Enter your name and describe the requested items.");
  }
  return {
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
    mobileNumber: normalizeQuoteMobile(input.mobileNumber),
    name: input.name.trim(),
    organization: input.organization?.trim() || null,
    quotation: null,
    customerDecision: null,
    convertedCartId: null,
    convertedOrderId: null
  };
}

function serializeQuoteRequest(request: QuoteLogRecord) {
  const payload = readQuotePayload(request.payload);

  return {
    createdAt: request.createdAt,
    email: payload.email,
    id: request.id,
    message: payload.message,
    mobileNumber: payload.mobileNumber,
    name: payload.name,
    organization: payload.organization,
    quotation: payload.quotation,
    customerDecision: payload.customerDecision,
    convertedCartId: payload.convertedCartId,
    convertedOrderId: payload.convertedOrderId,
    status: request.status
  };
}

function readQuotePayload(value: unknown): QuotePayload {
  const payload =
    value && typeof value === "object" ? (value as Partial<QuotePayload>) : {};

  return {
    email: typeof payload.email === "string" ? payload.email : "",
    message: typeof payload.message === "string" ? payload.message : "",
    mobileNumber: typeof payload.mobileNumber === "string" ? payload.mobileNumber : "",
    name: typeof payload.name === "string" ? payload.name : "",
    organization:
      typeof payload.organization === "string" ? payload.organization : null,
    quotation: readQuotation(payload.quotation),
    customerDecision: readCustomerDecision(payload.customerDecision),
    convertedCartId:
      typeof payload.convertedCartId === "string" ? payload.convertedCartId : null,
    convertedOrderId:
      typeof payload.convertedOrderId === "string" ? payload.convertedOrderId : null
  };
}

function buildQuotation(input: SendQuoteResponseDto): QuoteQuotation {
  if (!input.items.length || input.items.length > 100) {
    throw new BadRequestException("A quotation must contain between 1 and 100 items.");
  }
  if (input.validUntil) assertQuotationIsCurrent({ validUntil: input.validUntil });
  const items = input.items.map((item) => buildQuotationItem(item));
  const catalogKeys = items.filter(item => item.productId).map(quoteLineKey);
  if (new Set(catalogKeys).size !== catalogKeys.length) {
    throw new BadRequestException("Combine repeated catalog items into a single quotation line.");
  }
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.taxAmount, 0));
  const shippingTotal = roundMoney(input.shippingTotal ?? 0);
  assertQuoteMoney(shippingTotal, "Shipping");
  assertQuoteMoney(subtotal + taxTotal + shippingTotal, "Quotation total");

  return {
    items,
    notes: trimmedOrNull(input.notes),
    respondedAt: new Date().toISOString(),
    totals: {
      grandTotal: roundMoney(subtotal + taxTotal + shippingTotal),
      shippingTotal,
      subtotal,
      taxTotal
    },
    validUntil: trimmedOrNull(input.validUntil)
  };
}

function buildQuotationItem(input: SendQuoteItemDto): QuoteQuotationItem {
  if (!input.sku.trim() || !input.name.trim()) {
    throw new BadRequestException("Each quotation line needs a SKU and item name.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 2_147_483_647) {
    throw new BadRequestException("Quotation quantities must be positive whole numbers within the supported range.");
  }
  assertQuoteMoney(input.unitPrice, "Unit price");
  if (!Number.isFinite(input.taxRate ?? 0) || (input.taxRate ?? 0) < 0 || (input.taxRate ?? 0) > 100) {
    throw new BadRequestException("Tax rate must be between 0 and 100.");
  }
  const quantity = Math.trunc(input.quantity);
  const unitPrice = roundMoney(input.unitPrice);
  const taxRate = roundMoney(input.taxRate ?? 0);
  const lineSubtotal = roundMoney(quantity * unitPrice);
  const taxAmount = roundMoney(lineSubtotal * (taxRate / 100));
  assertQuoteMoney(lineSubtotal + taxAmount, "Line total");

  return {
    lineSubtotal,
    lineTotal: roundMoney(lineSubtotal + taxAmount),
    name: input.name.trim(),
    productId: trimmedOrNull(input.productId),
    quantity,
    sku: input.sku.trim(),
    taxAmount,
    taxRate,
    unitPrice,
    variantId: trimmedOrNull(input.variantId)
  };
}

function readQuotation(value: unknown): QuoteQuotation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const quotation = value as Partial<QuoteQuotation>;
  const items = Array.isArray(quotation.items)
    ? quotation.items
        .map((item) => readQuotationItem(item))
        .filter((item): item is QuoteQuotationItem => item !== null)
    : [];

  if (items.length === 0 || !quotation.totals || typeof quotation.totals !== "object") {
    return null;
  }

  const totals = quotation.totals as Partial<QuoteQuotationTotals>;

  return {
    items,
    notes: typeof quotation.notes === "string" ? quotation.notes : null,
    respondedAt: typeof quotation.respondedAt === "string" ? quotation.respondedAt : "",
    totals: {
      grandTotal: toNumber(totals.grandTotal),
      shippingTotal: toNumber(totals.shippingTotal),
      subtotal: toNumber(totals.subtotal),
      taxTotal: toNumber(totals.taxTotal)
    },
    validUntil: typeof quotation.validUntil === "string" ? quotation.validUntil : null
  };
}

function readQuotationItem(value: unknown): QuoteQuotationItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<QuoteQuotationItem>;

  return {
    lineSubtotal: toNumber(item.lineSubtotal),
    lineTotal: toNumber(item.lineTotal),
    name: typeof item.name === "string" ? item.name : "",
    productId: typeof item.productId === "string" ? item.productId : null,
    quantity: Math.max(1, Math.trunc(toNumber(item.quantity))),
    sku: typeof item.sku === "string" ? item.sku : "",
    taxAmount: toNumber(item.taxAmount),
    taxRate: toNumber(item.taxRate),
    unitPrice: toNumber(item.unitPrice),
    variantId: typeof item.variantId === "string" ? item.variantId : null
  };
}

function readCustomerDecision(value: unknown): QuoteCustomerDecision | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const decision = value as Partial<QuoteCustomerDecision>;

  if (decision.status !== "ACCEPTED" && decision.status !== "REJECTED") {
    return null;
  }

  return {
    decidedAt: typeof decision.decidedAt === "string" ? decision.decidedAt : "",
    note: typeof decision.note === "string" ? decision.note : null,
    status: decision.status
  };
}

function toJsonValue(value: QuotePayload) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildCustomerQuoteOwnershipWhere(customer: CustomerOwner) {
  const ownership: Prisma.NotificationLogWhereInput[] = [
    {
      userId: customer.id
    }
  ];

  if (customer.email) {
    ownership.push({
      userId: null,
      recipient: customer.email.toLowerCase()
    });
  }

  if (customer.mobileNumber) {
    const normalized = normalizeQuoteMobile(customer.mobileNumber);
    const local = normalized.slice(3);
    for (const mobileNumber of new Set([customer.mobileNumber, normalized, local, `91${local}`, `0${local}`])) {
      ownership.push({ userId: null, payload: { path: ["mobileNumber"], equals: mobileNumber } });
    }
  }

  return ownership;
}

function normalizeQuoteMobile(value: string) {
  const digits = value.replace(/[\s()+-]/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
    : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new BadRequestException("Enter a valid Indian mobile number.");
  }
  return `+91${local}`;
}

function assertQuoteCanBeEdited(status: string, payload: QuotePayload) {
  if (status === "CLOSED" || status === "CONVERTED" || payload.convertedCartId || payload.convertedOrderId) {
    throw new BadRequestException("Closed or converted requests cannot receive a new quotation. Reopen an unconverted request or submit a new one.");
  }
}

function assertQuoteMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 9_999_999_999.99) {
    throw new BadRequestException(`${label} must be between 0 and 9999999999.99.`);
  }
}

function trimmedOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getOrderId(order: unknown) {
  if (order && typeof order === "object" && "id" in order) {
    const id = (order as { id?: unknown }).id;

    return typeof id === "string" ? id : null;
  }

  return null;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
