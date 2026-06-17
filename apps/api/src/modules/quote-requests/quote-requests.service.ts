import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type {
  CreateQuoteRequestDto,
  QuoteRequestListQueryDto,
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
};

type QuoteLogRecord = Prisma.NotificationLogGetPayload<Record<string, never>>;

@Injectable()
export class QuoteRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async updateAdminQuoteRequestStatus(
    id: string,
    input: UpdateQuoteRequestStatusDto
  ) {
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
}

function normalizeQuotePayload(input: CreateQuoteRequestDto): QuotePayload {
  return {
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
    mobileNumber: input.mobileNumber.trim(),
    name: input.name.trim(),
    organization: input.organization?.trim() || null
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
    status: request.status
  };
}

function readQuotePayload(value: unknown): QuotePayload {
  const payload = value && typeof value === "object" ? value as Partial<QuotePayload> : {};

  return {
    email: typeof payload.email === "string" ? payload.email : "",
    message: typeof payload.message === "string" ? payload.message : "",
    mobileNumber:
      typeof payload.mobileNumber === "string" ? payload.mobileNumber : "",
    name: typeof payload.name === "string" ? payload.name : "",
    organization:
      typeof payload.organization === "string" ? payload.organization : null
  };
}

function toJsonValue(value: QuotePayload) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
