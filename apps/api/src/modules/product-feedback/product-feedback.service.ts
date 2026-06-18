import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, ProductStatus } from "../../generated/prisma/client";
import type {
  AdminProductFeedbackListQueryDto,
  AdminProductFeedbackType,
  AnswerProductQuestionDto,
  CreateProductQuestionDto,
  CreateProductReviewDto,
  ModerateProductQuestionDto,
  ModerateProductReviewDto
} from "./dto/product-feedback.dto";

const REVIEW_TEMPLATE_KEY = "product_review";
const QUESTION_TEMPLATE_KEY = "product_question";
const PRODUCT_FEEDBACK_CHANNEL = "product_feedback";
const PUBLIC_REVIEW_STATUS = "PUBLISHED";
const PUBLIC_QUESTION_STATUS = "ANSWERED";

type FeedbackPayload = {
  answer?: string | null;
  comment?: string;
  customerName: string;
  moderatedAt?: string | null;
  moderationNote?: string | null;
  question?: string;
  rating?: number;
  title?: string | null;
};
type FeedbackLogRecord = Prisma.NotificationLogGetPayload<Record<string, never>>;

@Injectable()
export class ProductFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async listFeedback(slug: string) {
    const product = await this.findPublicProduct(slug);
    const records = await this.prisma.notificationLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: {
        channel: PRODUCT_FEEDBACK_CHANNEL,
        recipient: product.id,
        OR: [
          {
            status: PUBLIC_REVIEW_STATUS,
            templateKey: REVIEW_TEMPLATE_KEY
          },
          {
            status: PUBLIC_QUESTION_STATUS,
            templateKey: QUESTION_TEMPLATE_KEY
          }
        ]
      }
    });

    return {
      questions: records
        .filter((record) => record.templateKey === QUESTION_TEMPLATE_KEY)
        .map((record) => serializeQuestion(record)),
      reviews: records
        .filter((record) => record.templateKey === REVIEW_TEMPLATE_KEY)
        .map((record) => serializeReview(record))
    };
  }

  async listAdminFeedback(query: AdminProductFeedbackListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const type = query.type;
    const status = query.status?.trim().toUpperCase();
    const productId = query.productId?.trim();
    const where: Prisma.NotificationLogWhereInput = {
      channel: PRODUCT_FEEDBACK_CHANNEL,
      recipient: productId || undefined,
      status: status || undefined,
      templateKey: type
        ? feedbackTypeToTemplateKey(type)
        : {
            in: [REVIEW_TEMPLATE_KEY, QUESTION_TEMPLATE_KEY]
          }
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
      items: items.map((record) => serializeAdminFeedback(record)),
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

  async createReview(
    customerId: string,
    slug: string,
    input: CreateProductReviewDto
  ) {
    const product = await this.findPublicProduct(slug);
    const customer = await this.findCustomer(customerId);
    const created = await this.prisma.notificationLog.create({
      data: {
        channel: PRODUCT_FEEDBACK_CHANNEL,
        payload: toJsonValue({
          comment: input.comment.trim(),
          customerName: formatCustomerName(customer),
          moderatedAt: null,
          moderationNote: null,
          rating: input.rating,
          title: input.title?.trim() || null
        }),
        recipient: product.id,
        status: "PENDING_REVIEW",
        templateKey: REVIEW_TEMPLATE_KEY,
        userId: customerId
      }
    });
    const feedback = await this.listFeedback(slug);

    return {
      ...feedback,
      reviews: [serializeReview(created), ...feedback.reviews]
    };
  }

  async createQuestion(
    customerId: string,
    slug: string,
    input: CreateProductQuestionDto
  ) {
    const product = await this.findPublicProduct(slug);
    const customer = await this.findCustomer(customerId);
    const created = await this.prisma.notificationLog.create({
      data: {
        channel: PRODUCT_FEEDBACK_CHANNEL,
        payload: toJsonValue({
          answer: null,
          customerName: formatCustomerName(customer),
          moderatedAt: null,
          moderationNote: null,
          question: input.question.trim()
        }),
        recipient: product.id,
        status: "PENDING",
        templateKey: QUESTION_TEMPLATE_KEY,
        userId: customerId
      }
    });
    const feedback = await this.listFeedback(slug);

    return {
      ...feedback,
      questions: [serializeQuestion(created), ...feedback.questions]
    };
  }

  async answerQuestion(id: string, input: AnswerProductQuestionDto) {
    const question = await this.prisma.notificationLog.findFirst({
      where: {
        channel: PRODUCT_FEEDBACK_CHANNEL,
        id,
        templateKey: QUESTION_TEMPLATE_KEY
      }
    });

    if (!question) {
      throw new NotFoundException("Product question was not found.");
    }

    const payload = {
      ...readPayload(question.payload),
      answer: input.answer.trim(),
      moderatedAt: new Date().toISOString(),
      moderationNote: "Answered by admin."
    };
    const updated = await this.prisma.notificationLog.update({
      data: {
        payload: toJsonValue(payload),
        status: "ANSWERED"
      },
      where: {
        id
      }
    });

    return serializeAdminFeedback(updated);
  }

  async moderateReview(id: string, input: ModerateProductReviewDto) {
    const updated = await this.updateFeedbackStatus(
      id,
      REVIEW_TEMPLATE_KEY,
      input.status,
      input.moderationNote
    );

    return serializeAdminFeedback(updated);
  }

  async moderateQuestion(id: string, input: ModerateProductQuestionDto) {
    const updated = await this.updateFeedbackStatus(
      id,
      QUESTION_TEMPLATE_KEY,
      input.status,
      input.moderationNote
    );

    return serializeAdminFeedback(updated);
  }

  private async findPublicProduct(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        OR: [{ slug }, { id: slug }],
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK]
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }

    return product;
  }

  private async findCustomer(customerId: string) {
    const customer = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: customerId,
        isActive: true
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    return customer;
  }

  private async updateFeedbackStatus(
    id: string,
    templateKey: string,
    status: string,
    moderationNote?: string | null
  ) {
    const feedback = await this.prisma.notificationLog.findFirst({
      where: {
        channel: PRODUCT_FEEDBACK_CHANNEL,
        id,
        templateKey
      }
    });

    if (!feedback) {
      throw new NotFoundException("Product feedback was not found.");
    }

    const payload = {
      ...readPayload(feedback.payload),
      moderatedAt: new Date().toISOString(),
      moderationNote: moderationNote?.trim() || null
    };

    return this.prisma.notificationLog.update({
      data: {
        payload: toJsonValue(payload),
        status
      },
      where: {
        id
      }
    });
  }
}

function serializeReview(record: FeedbackLogRecord) {
  const payload = readPayload(record.payload);

  return {
    comment: payload.comment ?? "",
    createdAt: record.createdAt,
    customerName: payload.customerName,
    id: record.id,
    rating: payload.rating ?? 0,
    title: payload.title ?? null
  };
}

function serializeQuestion(record: FeedbackLogRecord) {
  const payload = readPayload(record.payload);

  return {
    answer: payload.answer ?? null,
    createdAt: record.createdAt,
    customerName: payload.customerName,
    id: record.id,
    question: payload.question ?? "",
    status: record.status
  };
}

function serializeAdminFeedback(record: FeedbackLogRecord) {
  const payload = readPayload(record.payload);
  const type: AdminProductFeedbackType =
    record.templateKey === QUESTION_TEMPLATE_KEY ? "QUESTION" : "REVIEW";

  return {
    answer: type === "QUESTION" ? payload.answer : null,
    comment: type === "REVIEW" ? payload.comment : null,
    createdAt: record.createdAt,
    customerName: payload.customerName,
    id: record.id,
    moderationNote: payload.moderationNote ?? null,
    moderatedAt: payload.moderatedAt ?? null,
    productId: record.recipient,
    question: type === "QUESTION" ? payload.question : null,
    rating: type === "REVIEW" ? payload.rating : null,
    status: record.status,
    title: type === "REVIEW" ? payload.title : null,
    type
  };
}

function feedbackTypeToTemplateKey(type: AdminProductFeedbackType) {
  return type === "QUESTION" ? QUESTION_TEMPLATE_KEY : REVIEW_TEMPLATE_KEY;
}

function readPayload(value: unknown): FeedbackPayload {
  const payload: Partial<FeedbackPayload> =
    value && typeof value === "object" ? (value as FeedbackPayload) : {};

  return {
    answer: typeof payload.answer === "string" ? payload.answer : null,
    comment: typeof payload.comment === "string" ? payload.comment : "",
    customerName:
      typeof payload.customerName === "string" ? payload.customerName : "Customer",
    moderatedAt:
      typeof payload.moderatedAt === "string" ? payload.moderatedAt : null,
    moderationNote:
      typeof payload.moderationNote === "string" ? payload.moderationNote : null,
    question: typeof payload.question === "string" ? payload.question : "",
    rating: typeof payload.rating === "number" ? payload.rating : 0,
    title: typeof payload.title === "string" ? payload.title : null
  };
}

function formatCustomerName(customer: {
  businessName: string | null;
  firstName: string;
  lastName: string | null;
  mobileNumber: string;
}) {
  return (
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.businessName ||
    customer.mobileNumber
  );
}

function toJsonValue(value: FeedbackPayload) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
