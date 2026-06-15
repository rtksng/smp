import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus
} from "../../generated/prisma/client";
import { ApiQueueService } from "../../queues/api-queue.service";
import type {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto
} from "./dto/payment.dto";
import { RazorpayClient } from "./razorpay.client";

const RAZORPAY_PROVIDER = "razorpay";
const RAZORPAY_CURRENCY = "INR" as const;
const VALID_ONLINE_PAYMENT_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.CREATED
]);

const ORDER_WITH_PAYMENTS_INCLUDE = {
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.OrderInclude;

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };
type OrderWithPayments = Prisma.OrderGetPayload<{
  include: typeof ORDER_WITH_PAYMENTS_INCLUDE;
}>;
type OrderPayment = OrderWithPayments["payments"][number];
type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: true;
  };
}>;
type PaymentClient =
  | Pick<
      Prisma.TransactionClient,
      | "cartItem"
      | "order"
      | "orderStatusHistory"
      | "payment"
      | "paymentWebhook"
      | "refund"
    >
  | PrismaService;
type RazorpayWebhookPayload = Record<string, unknown>;
type RazorpayPaymentEntity = {
  amount: number;
  id: string;
  orderId: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayClient: RazorpayClient,
    @Optional() private readonly queueService?: ApiQueueService
  ) {}

  getPaymentGatewayStatus() {
    const onlinePaymentEnabled = this.razorpayClient.isConfigured();

    return {
      message: onlinePaymentEnabled
        ? "Online payment is available."
        : "Payment gateway is not configured yet.",
      onlinePaymentEnabled,
      provider: RAZORPAY_PROVIDER
    };
  }

  async createRazorpayOrder(customerId: string, input: CreateRazorpayOrderDto) {
    this.assertPaymentGatewayConfigured();

    const order = await this.findCustomerOrder(this.prisma, customerId, input.orderId);
    const payment = this.findOnlinePayment(order);
    this.assertPaymentCanStart(order, payment);
    const amountPaise = this.resolvePaymentAmountPaise(order, payment);

    if (payment.providerOrderId) {
      return this.serializeRazorpayOrder(order, payment, amountPaise);
    }

    const razorpayOrder = await this.razorpayClient.createOrder({
      amount: amountPaise,
      currency: RAZORPAY_CURRENCY,
      notes: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id
      },
      receipt: order.orderNumber
    });
    const updatedPayment = await this.prisma.payment.update({
      data: {
        provider: RAZORPAY_PROVIDER,
        providerAmountPaise: razorpayOrder.amount,
        providerOrderId: razorpayOrder.id,
        transactionRef: razorpayOrder.id
      },
      where: {
        id: payment.id
      }
    });

    return this.serializeRazorpayOrder(order, updatedPayment, amountPaise);
  }

  async verifyRazorpayPayment(
    customerId: string,
    input: VerifyRazorpayPaymentDto
  ) {
    if (
      !this.razorpayClient.verifyPaymentSignature(
        input.razorpay_order_id,
        input.razorpay_payment_id,
        input.razorpay_signature
      )
    ) {
      throw new UnauthorizedException("Razorpay payment signature is invalid.");
    }

    let invoiceOrderId: string | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.findCustomerOrder(tx, customerId, input.orderId);
      const payment = this.findOnlinePayment(order);
      this.assertPaymentCanVerify(order, payment, input.razorpay_order_id);
      const amountPaise = this.resolvePaymentAmountPaise(order, payment);
      this.assertStoredProviderAmountMatches(payment, amountPaise);
      await this.assertProviderPaymentIdIsUnused(
        tx,
        input.razorpay_payment_id,
        payment.id
      );

      const paidAt = new Date();

      await tx.payment.update({
        data: {
          paidAt,
          provider: RAZORPAY_PROVIDER,
          providerAmountPaise: amountPaise,
          providerPaymentId: input.razorpay_payment_id,
          status: PaymentStatus.PAID,
          transactionRef: input.razorpay_payment_id
        },
        where: {
          id: payment.id
        }
      });

      const nextOrderStatus =
        order.status === OrderStatus.CREATED ? OrderStatus.CONFIRMED : order.status;

      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: nextOrderStatus
        },
        where: {
          id: order.id
        }
      });

      if (nextOrderStatus !== order.status) {
        await tx.orderStatusHistory.create({
          data: {
            note: "Payment captured through Razorpay.",
            orderId: order.id,
            status: nextOrderStatus
          }
        });
      }

      await this.clearCustomerCartItems(tx, customerId);
      invoiceOrderId = order.id;

      return {
        orderStatus: nextOrderStatus,
        paymentId: payment.id,
        paymentStatus: PaymentStatus.PAID
      };
    });

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    return result;
  }

  async handleRazorpayWebhook(
    rawBody: Buffer,
    payload: unknown,
    signature: string | undefined
  ) {
    if (!signature || !this.razorpayClient.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException("Razorpay webhook signature is invalid.");
    }

    const parsedPayload = normalizeWebhookPayload(payload);
    await this.queueService?.enqueuePaymentWebhook({
      payload: parsedPayload,
      provider: RAZORPAY_PROVIDER,
      providerEventId: readString(parsedPayload.id),
      rawBodyBase64: rawBody.toString("base64"),
      receivedAt: new Date().toISOString(),
      signature,
      version: 1
    });
    const result = await this.processRazorpayWebhookPayload(
      rawBody,
      parsedPayload,
      signature
    );

    return {
      ...result,
      queued: Boolean(this.queueService)
    };
  }

  private async processRazorpayWebhookPayload(
    rawBody: Buffer,
    parsedPayload: RazorpayWebhookPayload,
    signature: string
  ) {
    const providerEventId = readString(parsedPayload.id);

    if (providerEventId) {
      const existingWebhook = await this.prisma.paymentWebhook.findFirst({
        where: {
          providerEventId
        }
      });

      if (existingWebhook) {
        return {
          duplicate: true,
          processed: false,
          received: true
        };
      }
    }

    let invoiceOrderId: string | null = null;
    const result = await this.prisma.$transaction(async (tx) => {
      const paymentEntity = extractRazorpayPaymentEntity(parsedPayload);
      const payment = paymentEntity
        ? await tx.payment.findFirst({
            include: {
              order: true
            },
            where: {
              providerOrderId: paymentEntity.orderId
            }
          })
        : null;
      const webhook = await tx.paymentWebhook.create({
        data: {
          eventType: readString(parsedPayload.event) ?? "unknown",
          payload: toJsonValue(parsedPayload),
          paymentId: payment?.id,
          provider: RAZORPAY_PROVIDER,
          providerEventId,
          rawPayload: rawBody.toString("utf8"),
          signature
        }
      });

      const processed = payment
        ? await this.processSupportedWebhookEvent(
            tx,
            parsedPayload,
            payment,
            paymentEntity
          )
        : false;

      if (processed && readString(parsedPayload.event) === "payment.captured") {
        invoiceOrderId = payment?.orderId ?? null;
      }

      if (processed) {
        await tx.paymentWebhook.update({
          data: {
            processedAt: new Date()
          },
          where: {
            id: webhook.id
          }
        });
      }

      return {
        duplicate: false,
        processed,
        received: true
      };
    });

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    return result;
  }

  async createRefundPlaceholder(input: {
    amount: number;
    orderId: string;
    paymentId?: string;
    reason?: string;
  }) {
    return this.prisma.refund.create({
      data: {
        amount: input.amount,
        orderId: input.orderId,
        paymentId: input.paymentId,
        reason: input.reason,
        status: RefundStatus.PENDING
      }
    });
  }

  private async findCustomerOrder(
    client: PaymentClient,
    customerId: string,
    orderId: string
  ) {
    const order = await client.order.findFirst({
      include: ORDER_WITH_PAYMENTS_INCLUDE,
      where: {
        deletedAt: null,
        id: orderId,
        userId: customerId
      }
    });

    if (!order) {
      throw new NotFoundException("Order was not found.");
    }

    return order;
  }

  private assertPaymentGatewayConfigured() {
    if (!this.razorpayClient.isConfigured()) {
      throw new ServiceUnavailableException(
        "Payment gateway is not configured yet."
      );
    }
  }

  private async clearCustomerCartItems(client: PaymentClient, customerId: string) {
    await client.cartItem.deleteMany({
      where: {
        cart: {
          deletedAt: null,
          userId: customerId
        }
      }
    });
  }

  private findOnlinePayment(order: OrderWithPayments) {
    const payment = order.payments.find(
      (entry) => entry.method === PaymentMethod.ONLINE
    );

    if (!payment) {
      throw new BadRequestException("Order does not use online payment.");
    }

    return payment;
  }

  private assertPaymentCanStart(order: OrderWithPayments, payment: OrderPayment) {
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled orders cannot be paid online.");
    }

    if (!VALID_ONLINE_PAYMENT_ORDER_STATUSES.has(order.status)) {
      throw new BadRequestException("Order is not in a valid payment state.");
    }

    if (order.paymentStatus === PaymentStatus.PAID || payment.status === PaymentStatus.PAID) {
      throw new ConflictException("Order payment has already succeeded.");
    }

    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException("Order payment is not pending.");
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Online payment is not pending.");
    }
  }

  private assertPaymentCanVerify(
    order: OrderWithPayments,
    payment: OrderPayment,
    razorpayOrderId: string
  ) {
    this.assertPaymentCanStart(order, payment);

    if (!payment.providerOrderId) {
      throw new BadRequestException("Razorpay order has not been created.");
    }

    if (payment.providerOrderId !== razorpayOrderId) {
      throw new BadRequestException("Razorpay order id does not match this payment.");
    }
  }

  private async assertProviderPaymentIdIsUnused(
    client: PaymentClient,
    providerPaymentId: string,
    currentPaymentId: string
  ) {
    const existingPayment = await client.payment.findFirst({
      where: {
        providerPaymentId
      }
    });

    if (existingPayment && existingPayment.id !== currentPaymentId) {
      throw new ConflictException("Razorpay payment id is already recorded.");
    }
  }

  private resolvePaymentAmountPaise(
    order: Pick<OrderWithPayments, "grandTotal">,
    payment: Pick<OrderPayment, "amount">
  ) {
    const orderAmountPaise = decimalToPaise(order.grandTotal);
    const paymentAmountPaise = decimalToPaise(payment.amount);

    if (orderAmountPaise !== paymentAmountPaise) {
      throw new BadRequestException("Payment amount does not match the order total.");
    }

    return orderAmountPaise;
  }

  private assertStoredProviderAmountMatches(
    payment: Pick<OrderPayment, "providerAmountPaise">,
    amountPaise: number
  ) {
    if (
      payment.providerAmountPaise !== null &&
      payment.providerAmountPaise !== amountPaise
    ) {
      throw new BadRequestException("Stored Razorpay amount does not match.");
    }
  }

  private async processSupportedWebhookEvent(
    tx: Prisma.TransactionClient,
    payload: RazorpayWebhookPayload,
    payment: PaymentWithOrder,
    paymentEntity: RazorpayPaymentEntity | null
  ) {
    const event = readString(payload.event);

    if (!paymentEntity) {
      return false;
    }

    if (paymentEntity.amount !== decimalToPaise(payment.amount)) {
      throw new BadRequestException("Webhook payment amount does not match.");
    }

    if (event === "payment.captured") {
      if (payment.status === PaymentStatus.PAID) {
        return false;
      }

      await this.assertProviderPaymentIdIsUnused(tx, paymentEntity.id, payment.id);
      await tx.payment.update({
        data: {
          paidAt: new Date(),
          provider: RAZORPAY_PROVIDER,
          providerAmountPaise: paymentEntity.amount,
          providerPaymentId: paymentEntity.id,
          status: PaymentStatus.PAID,
          transactionRef: paymentEntity.id
        },
        where: {
          id: payment.id
        }
      });

      const nextOrderStatus =
        payment.order.status === OrderStatus.CREATED
          ? OrderStatus.CONFIRMED
          : payment.order.status;

      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: nextOrderStatus
        },
        where: {
          id: payment.orderId
        }
      });

      if (nextOrderStatus !== payment.order.status) {
        await tx.orderStatusHistory.create({
          data: {
            note: "Payment captured through Razorpay webhook.",
            orderId: payment.orderId,
            status: nextOrderStatus
          }
        });
      }

      await this.clearCustomerCartItems(tx, payment.order.userId);
      return true;
    }

    if (event === "payment.authorized" && payment.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        data: {
          provider: RAZORPAY_PROVIDER,
          providerAmountPaise: paymentEntity.amount,
          providerPaymentId: paymentEntity.id,
          status: PaymentStatus.AUTHORIZED,
          transactionRef: paymentEntity.id
        },
        where: {
          id: payment.id
        }
      });
      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.AUTHORIZED
        },
        where: {
          id: payment.orderId
        }
      });

      return true;
    }

    if (event === "payment.failed" && payment.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        data: {
          provider: RAZORPAY_PROVIDER,
          providerAmountPaise: paymentEntity.amount,
          providerPaymentId: paymentEntity.id,
          status: PaymentStatus.FAILED,
          transactionRef: paymentEntity.id
        },
        where: {
          id: payment.id
        }
      });
      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.FAILED
        },
        where: {
          id: payment.orderId
        }
      });

      return true;
    }

    return false;
  }

  private serializeRazorpayOrder(
    order: Pick<OrderWithPayments, "id">,
    payment: Pick<OrderPayment, "id" | "providerOrderId">,
    amountPaise: number
  ) {
    if (!payment.providerOrderId) {
      throw new BadRequestException("Razorpay order id is missing.");
    }

    return {
      orderId: order.id,
      paymentId: payment.id,
      razorpay: {
        amount: amountPaise,
        currency: RAZORPAY_CURRENCY,
        keyId: this.razorpayClient.getKeyId(),
        orderId: payment.providerOrderId
      }
    };
  }
}

function extractRazorpayPaymentEntity(
  payload: RazorpayWebhookPayload
): RazorpayPaymentEntity | null {
  const eventPayload = readRecord(payload.payload);
  const paymentWrapper = readRecord(eventPayload?.payment);
  const entity = readRecord(paymentWrapper?.entity);
  const id = readString(entity?.id);
  const orderId = readString(entity?.order_id);
  const amount = entity?.amount;

  if (!id || !orderId || typeof amount !== "number") {
    return null;
  }

  return {
    amount,
    id,
    orderId
  };
}

function normalizeWebhookPayload(payload: unknown): RazorpayWebhookPayload {
  if (!isRecord(payload)) {
    throw new BadRequestException("Razorpay webhook payload is invalid.");
  }

  return payload;
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

function decimalToPaise(value: DecimalValue) {
  return Math.round(decimalToNumber(value) * 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
