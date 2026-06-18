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

  async sendAdminQuotation(id: string, input: SendQuoteResponseDto) {
    const request = await this.findQuoteRequest(id);
    const payload = readQuotePayload(request.payload);
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
    await this.findQuoteRequest(id);

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

    const status: QuoteRequestStatus = input.decision;
    const customerDecision: QuoteCustomerDecision = {
      decidedAt: new Date().toISOString(),
      note: trimmedOrNull(input.note),
      status
    };
    const updated = await this.prisma.notificationLog.update({
      data: {
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
    const cart = await this.cartService.replaceWithItems(customerId, cartItems);
    const updated = await this.prisma.notificationLog.update({
      data: {
        payload: toJsonValue({
          ...payload,
          convertedCartId: getCartId(cart),
          convertedOrderId: null
        }),
        status: "CONVERTED"
      },
      where: {
        id
      }
    });

    return {
      cart,
      quote: serializeQuoteRequest(updated)
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
  return {
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
    mobileNumber: input.mobileNumber.trim(),
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
  const items = input.items.map((item) => buildQuotationItem(item));
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.taxAmount, 0));
  const shippingTotal = roundMoney(input.shippingTotal ?? 0);

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
  const quantity = Math.trunc(input.quantity);
  const unitPrice = roundMoney(input.unitPrice);
  const taxRate = roundMoney(input.taxRate ?? 0);
  const lineSubtotal = roundMoney(quantity * unitPrice);
  const taxAmount = roundMoney(lineSubtotal * (taxRate / 100));

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
      recipient: customer.email.toLowerCase()
    });
  }

  if (customer.mobileNumber) {
    ownership.push({
      recipient: customer.mobileNumber
    });
  }

  return ownership;
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

function getCartId(cart: unknown) {
  if (cart && typeof cart === "object" && "id" in cart) {
    const id = (cart as { id?: unknown }).id;

    return typeof id === "string" ? id : null;
  }

  return null;
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
