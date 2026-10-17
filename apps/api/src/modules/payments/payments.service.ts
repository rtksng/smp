import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  RefundStatus,
  WebhookProcessingStatus
} from "../../generated/prisma/client";
import { ApiQueueService } from "../../queues/api-queue.service";
import {
  CustomerEmailNotifier,
  emailMoney
} from "../../queues/customer-email.notifier";
import type {
  CreateRazorpayOrderDto,
  VerifyRazorpayPaymentDto
} from "./dto/payment.dto";
import { RazorpayClient } from "./razorpay.client";

const RAZORPAY_PROVIDER = "razorpay";
const RAZORPAY_CURRENCY = "INR" as const;
const VALID_ONLINE_PAYMENT_ORDER_STATUSES = new Set<OrderStatus>([OrderStatus.CREATED]);
const STARTABLE_ORDER_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.FAILED
]);
const VERIFIABLE_ORDER_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED
]);
const VERIFIABLE_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED
]);

const ORDER_WITH_PAYMENTS_INCLUDE = {
  payments: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.OrderInclude;
const REFUND_WITH_PAYMENT_ORDER_INCLUDE = {
  order: true,
  payment: true
} as const satisfies Prisma.RefundInclude;

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type OrderWithPayments = Prisma.OrderGetPayload<{
  include: typeof ORDER_WITH_PAYMENTS_INCLUDE;
}>;
type OrderPayment = OrderWithPayments["payments"][number];
type PaymentWithOrder = Prisma.PaymentGetPayload<{
  include: {
    order: true;
  };
}>;
type RefundWithPaymentAndOrder = Prisma.RefundGetPayload<{
  include: typeof REFUND_WITH_PAYMENT_ORDER_INCLUDE;
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
type RazorpayRefundEntity = {
  amount: number;
  id: string;
  paymentId: string;
  status: "failed" | "pending" | "processed";
};
type WebhookEffects = {
  // Refund opened for a payment that arrived after the order was cancelled.
  cancelledOrderRefundId: string | null;
};

// A PROCESSING refund with no Razorpay id this old belongs to an attempt that
// crashed; it may be claimed again.
const STALE_REFUND_CLAIM_MS = 10 * 60_000;
const CANCELLED_ORDER_PAYMENT_MESSAGE =
  "This order was cancelled before your payment completed. The payment will be refunded.";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayClient: RazorpayClient,
    @Optional() private readonly queueService?: ApiQueueService,
    @Optional() private readonly customerEmails?: CustomerEmailNotifier
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
    let payment = this.findReusableOnlinePayment(order);

    this.assertOrderCanStartPayment(order);

    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          amount: decimalToNumber(order.grandTotal),
          method: PaymentMethod.ONLINE,
          orderId: order.id,
          status: PaymentStatus.PENDING
        }
      });

      if (order.paymentStatus !== PaymentStatus.PENDING) {
        await this.prisma.order.update({
          data: {
            paymentStatus: PaymentStatus.PENDING
          },
          where: {
            id: order.id
          }
        });
      }
    }

    this.assertPaymentCanStart(payment);
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
    // A double-tapped Pay button can reach this point twice. Only the first
    // Razorpay order is attached; the other request returns that one, so the
    // customer always pays an order this payment can be matched to.
    await this.prisma.payment.updateMany({
      data: {
        provider: RAZORPAY_PROVIDER,
        providerAmountPaise: razorpayOrder.amount,
        providerOrderId: razorpayOrder.id,
        transactionRef: razorpayOrder.id
      },
      where: {
        id: payment.id,
        providerOrderId: null
      }
    });
    const attachedPayment = await this.prisma.payment.findFirst({
      where: {
        id: payment.id
      }
    });

    if (!attachedPayment) {
      throw new NotFoundException("Payment was not found.");
    }

    return this.serializeRazorpayOrder(order, attachedPayment, amountPaise);
  }

  async verifyRazorpayPayment(customerId: string, input: VerifyRazorpayPaymentDto) {
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
    let paidOrder = null as { amount: DecimalValue; orderId: string; orderNumber: string } | null;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, input.orderId);
      const order = await this.findCustomerOrder(tx, customerId, input.orderId);
      const payment = this.findOnlinePaymentForProviderOrder(
        order,
        input.razorpay_order_id
      );

      if (order.status === OrderStatus.CANCELLED) {
        const amountPaise = this.resolvePaymentAmountPaise(order, payment);
        this.assertStoredProviderAmountMatches(payment, amountPaise);

        return {
          cancelledOrderRefundId: await this.recordPaymentOnCancelledOrder(tx, {
            amountPaise,
            orderId: order.id,
            payment,
            providerPaymentId: input.razorpay_payment_id,
            source: "verification"
          })
        };
      }

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
      paidOrder = { amount: payment.amount, orderId: order.id, orderNumber: order.orderNumber };

      return {
        orderStatus: nextOrderStatus,
        paymentId: payment.id,
        paymentStatus: PaymentStatus.PAID
      };
    });

    if ("cancelledOrderRefundId" in result) {
      if (result.cancelledOrderRefundId) {
        await this.startCancelledOrderRefund(result.cancelledOrderRefundId);
      }

      throw new ConflictException(CANCELLED_ORDER_PAYMENT_MESSAGE);
    }

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    // Shares its dedupe key with the webhook path, so the customer is told once.
    if (paidOrder) {
      await this.customerEmails?.notifyCustomer(
        customerId,
        {
          amount: emailMoney(decimalToNumber(paidOrder.amount)),
          orderId: paidOrder.orderId,
          orderNumber: paidOrder.orderNumber,
          paymentReference: input.razorpay_payment_id,
          status: "PAID",
          template: "payment-result"
        },
        `payment-result:${result.paymentId}:PAID`
      );
    }

    return result;
  }

  async handleRazorpayWebhook(
    rawBody: Buffer,
    payload: unknown,
    signature: string | undefined,
    eventId?: string
  ) {
    if (!signature || !this.razorpayClient.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException("Razorpay webhook signature is invalid.");
    }

    const parsedPayload = normalizeWebhookPayload(payload);
    // Razorpay identifies an event by the x-razorpay-event-id header; the
    // body has no top-level id.
    const providerEventId = readString(eventId?.trim()) ?? readString(parsedPayload.id);
    const receipt = await this.recordRazorpayWebhookReceipt(
      rawBody,
      parsedPayload,
      signature,
      providerEventId
    );

    if (receipt.duplicate) {
      return {
        duplicate: true,
        processed: false,
        queued: false,
        received: true,
        webhookId: receipt.webhookId
      };
    }

    if (this.queueService) {
      await this.queueService.enqueuePaymentWebhook({
        payload: parsedPayload,
        provider: RAZORPAY_PROVIDER,
        providerEventId,
        rawBodyBase64: rawBody.toString("base64"),
        receivedAt: new Date().toISOString(),
        signature,
        version: 1,
        webhookId: receipt.webhookId
      });

      return {
        duplicate: false,
        processed: false,
        queued: true,
        received: true,
        webhookId: receipt.webhookId
      };
    }

    const result = await this.processRazorpayWebhookPayload(
      rawBody,
      parsedPayload,
      signature,
      providerEventId,
      receipt.webhookId
    );

    return {
      ...result,
      queued: false,
      webhookId: receipt.webhookId
    };
  }

  private async recordRazorpayWebhookReceipt(
    rawBody: Buffer,
    parsedPayload: RazorpayWebhookPayload,
    signature: string,
    providerEventId: string | null
  ) {
    const eventType = readString(parsedPayload.event) ?? "unknown";

    if (providerEventId) {
      const existingWebhook = await this.prisma.paymentWebhook.findFirst({
        where: {
          providerEventId
        }
      });

      if (existingWebhook) {
        return {
          duplicate: true,
          webhookId: existingWebhook.id
        };
      }
    }

    try {
      const webhook = await this.prisma.paymentWebhook.create({
        data: {
          eventType,
          payload: toJsonValue(parsedPayload),
          provider: RAZORPAY_PROVIDER,
          providerEventId,
          rawPayload: rawBody.toString("utf8"),
          signature,
          processingStatus: WebhookProcessingStatus.RECEIVED
        }
      });

      return {
        duplicate: false,
        webhookId: webhook.id
      };
    } catch (error) {
      if (providerEventId && isUniqueConstraintError(error)) {
        const existingWebhook = await this.prisma.paymentWebhook.findFirst({
          where: {
            providerEventId
          }
        });

        if (existingWebhook) {
          return {
            duplicate: true,
            webhookId: existingWebhook.id
          };
        }
      }

      throw error;
    }
  }

  private async processRazorpayWebhookPayload(
    rawBody: Buffer,
    parsedPayload: RazorpayWebhookPayload,
    signature: string,
    providerEventId: string | null,
    webhookId?: string
  ) {
    if (providerEventId && !webhookId) {
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
    const effects: WebhookEffects = { cancelledOrderRefundId: null };
    const result = await this.prisma
      .$transaction(async (tx) => {
        const paymentEntity = extractRazorpayPaymentEntity(parsedPayload);
        const refundEntity = extractRazorpayRefundEntity(parsedPayload);
        const payment = paymentEntity
          ? await tx.payment.findFirst({
              include: {
                order: true
              },
              where: {
                providerOrderId: paymentEntity.orderId
              }
            })
          : refundEntity
            ? await tx.payment.findFirst({
                include: {
                  order: true
                },
                where: {
                  providerPaymentId: refundEntity.paymentId
                }
              })
            : null;
        const webhook =
          webhookId ??
          (
            await tx.paymentWebhook.create({
              data: {
                eventType: readString(parsedPayload.event) ?? "unknown",
                payload: toJsonValue(parsedPayload),
                paymentId: payment?.id,
                provider: RAZORPAY_PROVIDER,
                providerEventId,
                rawPayload: rawBody.toString("utf8"),
                signature,
                processingStatus: WebhookProcessingStatus.PROCESSING
              }
            })
          ).id;

        if (webhookId) {
          await tx.paymentWebhook.update({
            data: {
              lastProcessingError: null,
              paymentId: payment?.id,
              processingAttempts: {
                increment: 1
              },
              processingStatus: WebhookProcessingStatus.PROCESSING
            },
            where: {
              id: webhookId
            }
          });
        }

        const processed = payment
          ? await this.processSupportedWebhookEvent(
              tx,
              parsedPayload,
              payment,
              paymentEntity,
              refundEntity,
              effects
            )
          : false;

        if (
          processed &&
          readString(parsedPayload.event) === "payment.captured" &&
          !effects.cancelledOrderRefundId
        ) {
          invoiceOrderId = payment?.orderId ?? null;
        }

        await tx.paymentWebhook.update({
          data: {
            lastProcessingError: null,
            processedAt: processed ? new Date() : null,
            processingStatus: processed
              ? WebhookProcessingStatus.PROCESSED
              : WebhookProcessingStatus.IGNORED
          },
          where: {
            id: webhook
          }
        });

        return {
          duplicate: false,
          processed,
          received: true
        };
      })
      .catch(async (error) => {
        if (webhookId) {
          await this.prisma.paymentWebhook
            .update({
              data: {
                lastProcessingError: errorToMessage(error),
                processingStatus: WebhookProcessingStatus.FAILED
              },
              where: {
                id: webhookId
              }
            })
            .catch(() => undefined);
        }

        throw error;
      });

    if (invoiceOrderId) {
      await this.queueService?.enqueueInvoice({
        orderId: invoiceOrderId,
        requestedAt: new Date().toISOString(),
        version: 1
      });
    }

    if (effects.cancelledOrderRefundId) {
      await this.startCancelledOrderRefund(effects.cancelledOrderRefundId);
    }

    return result;
  }

  // Processes one refund through Razorpay. Used by the refund job and for
  // payments that arrive after their order was cancelled.
  async processRefund(refundId: string) {
    const refund = await this.prisma.refund.findFirst({
      include: REFUND_WITH_PAYMENT_ORDER_INCLUDE,
      where: {
        id: refundId
      }
    });

    if (!refund) {
      throw new NotFoundException("Refund was not found.");
    }

    if (!this.isPaidRazorpayRefund(refund)) {
      return this.serializeRefund(refund);
    }

    this.assertPaymentGatewayConfigured();

    return this.processRazorpayRefund(refund);
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

  async processPendingOrderRefund(orderId: string) {
    const refund = await this.prisma.refund.findFirst({
      include: REFUND_WITH_PAYMENT_ORDER_INCLUDE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        orderId,
        status: {
          in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.FAILED]
        }
      }
    });

    if (!refund) {
      return null;
    }

    if (!this.isPaidRazorpayRefund(refund)) {
      return this.serializeRefund(refund);
    }

    this.assertPaymentGatewayConfigured();

    return this.processRazorpayRefund(refund);
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
      throw new ServiceUnavailableException("Payment gateway is not configured yet.");
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

  private findOnlinePayments(order: OrderWithPayments) {
    const payments = order.payments.filter(
      (entry) => entry.method === PaymentMethod.ONLINE
    );

    if (payments.length === 0) {
      throw new BadRequestException("Order does not use online payment.");
    }

    return payments;
  }

  private findOnlinePaymentForProviderOrder(
    order: OrderWithPayments,
    providerOrderId: string
  ) {
    const payment = this.findOnlinePayments(order).find(
      (entry) => entry.providerOrderId === providerOrderId
    );

    if (!payment) {
      throw new BadRequestException("Razorpay order id does not match this payment.");
    }

    return payment;
  }

  private findReusableOnlinePayment(order: OrderWithPayments) {
    const payments = this.findOnlinePayments(order);

    if (payments.some((payment) => payment.status === PaymentStatus.PAID)) {
      throw new ConflictException("Order payment has already succeeded.");
    }

    return (
      payments.find(
        (payment) =>
          payment.status === PaymentStatus.PENDING && Boolean(payment.providerOrderId)
      ) ??
      payments.find((payment) => payment.status === PaymentStatus.PENDING) ??
      null
    );
  }

  private assertOrderCanStartPayment(order: OrderWithPayments) {
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled orders cannot be paid online.");
    }

    if (!VALID_ONLINE_PAYMENT_ORDER_STATUSES.has(order.status)) {
      throw new BadRequestException("Order is not in a valid payment state.");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException("Order payment has already succeeded.");
    }

    if (!STARTABLE_ORDER_PAYMENT_STATUSES.has(order.paymentStatus)) {
      throw new BadRequestException("Order payment is not pending.");
    }
  }

  private assertPaymentCanStart(payment: OrderPayment) {
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("Online payment is not pending.");
    }
  }

  private assertOrderCanVerifyPayment(order: OrderWithPayments) {
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException("Cancelled orders cannot be paid online.");
    }

    if (!VALID_ONLINE_PAYMENT_ORDER_STATUSES.has(order.status)) {
      throw new BadRequestException("Order is not in a valid payment state.");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new ConflictException("Order payment has already succeeded.");
    }

    if (!VERIFIABLE_ORDER_PAYMENT_STATUSES.has(order.paymentStatus)) {
      throw new BadRequestException("Order payment is not pending.");
    }
  }

  private assertPaymentCanVerify(
    order: OrderWithPayments,
    payment: OrderPayment,
    razorpayOrderId: string
  ) {
    this.assertOrderCanVerifyPayment(order);

    if (!payment.providerOrderId) {
      throw new BadRequestException("Razorpay order has not been created.");
    }

    if (payment.providerOrderId !== razorpayOrderId) {
      throw new BadRequestException("Razorpay order id does not match this payment.");
    }

    if (!VERIFIABLE_PAYMENT_STATUSES.has(payment.status)) {
      throw new BadRequestException("Online payment is not pending.");
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
    paymentEntity: RazorpayPaymentEntity | null,
    refundEntity: RazorpayRefundEntity | null,
    effects: WebhookEffects
  ) {
    const event = readString(payload.event);

    if (refundEntity) {
      return this.processSupportedRefundWebhookEvent(
        tx,
        event,
        payment,
        refundEntity
      );
    }

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

      if (payment.order.status === OrderStatus.CANCELLED) {
        effects.cancelledOrderRefundId = await this.recordPaymentOnCancelledOrder(tx, {
          amountPaise: paymentEntity.amount,
          orderId: payment.orderId,
          payment,
          providerPaymentId: paymentEntity.id,
          source: "webhook"
        });

        return true;
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

  private async processSupportedRefundWebhookEvent(
    tx: Prisma.TransactionClient,
    event: string | null,
    payment: PaymentWithOrder,
    refundEntity: RazorpayRefundEntity
  ) {
    if (event !== "refund.processed" && event !== "refund.failed") {
      return false;
    }

    if (payment.providerPaymentId !== refundEntity.paymentId) {
      throw new BadRequestException("Webhook refund payment id does not match.");
    }

    const refund = await tx.refund.findFirst({
      include: REFUND_WITH_PAYMENT_ORDER_INCLUDE,
      where: {
        providerRefundId: refundEntity.id
      }
    });

    if (!refund) {
      return false;
    }

    if (refund.paymentId !== payment.id) {
      throw new BadRequestException("Webhook refund does not match this payment.");
    }

    if (refundEntity.amount !== decimalToPaise(refund.amount)) {
      throw new BadRequestException("Webhook refund amount does not match.");
    }

    const status = mapRazorpayRefundStatus(refundEntity.status);

    if (refund.status === status) {
      return false;
    }

    await tx.refund.update({
      data: {
        processedAt: status === RefundStatus.COMPLETED ? new Date() : null,
        status
      },
      where: {
        id: refund.id
      }
    });

    if (status === RefundStatus.COMPLETED) {
      await this.updatePaymentRefundStatus(tx, payment.id);
    }

    return true;
  }

  private async processRazorpayRefund(refund: RefundWithPaymentAndOrder) {
    if (refund.providerRefundId) {
      return this.refreshRazorpayRefund(refund);
    }

    this.assertRefundCanUseRazorpay(refund);
    const payment = refund.payment;

    if (!payment?.providerPaymentId) {
      throw new BadRequestException(
        "Refund can be processed only after Razorpay payment capture."
      );
    }

    const amountPaise = decimalToPaise(refund.amount);

    if (amountPaise <= 0) {
      throw new BadRequestException("Refund amount must be greater than zero.");
    }

    // Only one caller may send this refund to Razorpay at a time.
    const claim = await this.prisma.refund.updateMany({
      data: {
        status: RefundStatus.PROCESSING
      },
      where: {
        id: refund.id,
        providerRefundId: null,
        OR: [
          { status: { in: [RefundStatus.PENDING, RefundStatus.FAILED] } },
          {
            status: RefundStatus.PROCESSING,
            updatedAt: { lt: new Date(Date.now() - STALE_REFUND_CLAIM_MS) }
          }
        ]
      }
    });

    if (claim.count !== 1) {
      throw new ConflictException("This refund is already being processed.");
    }

    let providerRefund: Awaited<ReturnType<RazorpayClient["createRefund"]>>;

    try {
      // An earlier attempt may have reached Razorpay and crashed before
      // saving the result; reuse that refund instead of refunding twice.
      const earlierRefund = (
        await this.razorpayClient.fetchPaymentRefunds(payment.providerPaymentId)
      ).find((entry) => entry.notes.refundId === refund.id);

      providerRefund =
        earlierRefund ??
        (await this.razorpayClient.createRefund(payment.providerPaymentId, {
          amount: amountPaise,
          notes: {
            orderId: refund.orderId,
            orderNumber: refund.order.orderNumber,
            refundId: refund.id
          },
          receipt: `refund-${refund.id}`,
          speed: "normal"
        }));
    } catch (error) {
      await this.releaseRefundClaim(refund.id);
      throw error;
    }

    if (providerRefund.amount !== amountPaise) {
      await this.releaseRefundClaim(refund.id);
      throw new BadRequestException("Razorpay refund amount does not match.");
    }

    const status = mapRazorpayRefundStatus(providerRefund.status);
    const processedAt = status === RefundStatus.COMPLETED ? new Date() : null;
    const updatedRefund = await this.prisma.refund.update({
      data: {
        processedAt,
        providerRefundId: providerRefund.id,
        status
      },
      where: {
        id: refund.id
      }
    });

    if (status === RefundStatus.COMPLETED) {
      await this.updatePaymentRefundStatus(this.prisma, payment.id);
    }

    await this.notifyRefundStatus(refund, status, providerRefund.id);

    return this.serializeRefund({
      ...refund,
      ...updatedRefund
    });
  }

  private async releaseRefundClaim(refundId: string) {
    await this.prisma.refund.updateMany({
      data: {
        status: RefundStatus.PENDING
      },
      where: {
        id: refundId,
        providerRefundId: null,
        status: RefundStatus.PROCESSING
      }
    });
  }

  // Serializes payment verification with cancellation, the unpaid order
  // expiry job and webhooks, which all update this order row.
  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  }

  // Money was captured for an order that is already cancelled (for example
  // by the unpaid order expiry). The order stays cancelled with its stock
  // released; the payment is recorded and a refund opened for it. Returns the
  // refund to process, or null when nothing is left to refund.
  private async recordPaymentOnCancelledOrder(
    tx: Prisma.TransactionClient,
    input: {
      amountPaise: number;
      orderId: string;
      payment: Pick<OrderPayment, "amount" | "id" | "status">;
      providerPaymentId: string;
      source: "verification" | "webhook";
    }
  ) {
    if (
      input.payment.status === PaymentStatus.REFUNDED ||
      input.payment.status === PaymentStatus.PARTIALLY_REFUNDED
    ) {
      return null;
    }

    if (input.payment.status !== PaymentStatus.PAID) {
      await this.assertProviderPaymentIdIsUnused(
        tx,
        input.providerPaymentId,
        input.payment.id
      );
      await tx.payment.update({
        data: {
          paidAt: new Date(),
          provider: RAZORPAY_PROVIDER,
          providerAmountPaise: input.amountPaise,
          providerPaymentId: input.providerPaymentId,
          status: PaymentStatus.PAID,
          transactionRef: input.providerPaymentId
        },
        where: {
          id: input.payment.id
        }
      });
      await tx.order.update({
        data: {
          paymentStatus: PaymentStatus.PAID
        },
        where: {
          id: input.orderId
        }
      });
    }

    const existingRefund = await tx.refund.findFirst({
      where: {
        paymentId: input.payment.id
      }
    });

    if (existingRefund) {
      return existingRefund.status === RefundStatus.COMPLETED ? null : existingRefund.id;
    }

    const refund = await tx.refund.create({
      data: {
        amount: decimalToNumber(input.payment.amount),
        orderId: input.orderId,
        paymentId: input.payment.id,
        reason: "Payment received after the order was cancelled.",
        status: RefundStatus.PENDING
      }
    });
    await tx.orderStatusHistory.create({
      data: {
        note: `Payment received after cancellation (Razorpay ${input.source}); refund started.`,
        orderId: input.orderId,
        status: OrderStatus.CANCELLED
      }
    });

    return refund.id;
  }

  // Runs after the payment transaction commits. The queue retries Razorpay
  // failures; a refund that still fails stays PENDING for an admin.
  private async startCancelledOrderRefund(refundId: string) {
    try {
      if (this.queueService) {
        await this.queueService.enqueueRefundProcessing(refundId);
        return;
      }

      await this.processRefund(refundId);
    } catch (error) {
      this.logger.error(
        `Refund ${refundId} for a payment on a cancelled order was not started: ${errorToMessage(error)}`
      );
    }
  }

  private async refreshRazorpayRefund(refund: RefundWithPaymentAndOrder) {
    this.assertRefundCanUseRazorpay(refund);
    const payment = refund.payment;

    if (!payment?.providerPaymentId) {
      throw new BadRequestException(
        "Refund status can be refreshed only after Razorpay payment capture."
      );
    }

    if (!refund.providerRefundId) {
      throw new BadRequestException("Refund does not have a Razorpay refund id.");
    }

    const providerRefund = await this.razorpayClient.fetchRefund(
      refund.providerRefundId
    );

    if (providerRefund.payment_id !== payment.providerPaymentId) {
      throw new BadRequestException("Razorpay refund payment id does not match.");
    }

    if (providerRefund.amount !== decimalToPaise(refund.amount)) {
      throw new BadRequestException("Razorpay refund amount does not match.");
    }

    const status = mapRazorpayRefundStatus(providerRefund.status);
    const processedAt =
      status === RefundStatus.COMPLETED
        ? refund.processedAt ?? new Date()
        : null;
    const updatedRefund = await this.prisma.refund.update({
      data: {
        processedAt,
        status
      },
      where: {
        id: refund.id
      }
    });

    if (status === RefundStatus.COMPLETED) {
      await this.updatePaymentRefundStatus(this.prisma, payment.id);
    }

    if (status !== refund.status) {
      await this.notifyRefundStatus(refund, status, refund.providerRefundId);
    }

    return this.serializeRefund({
      ...refund,
      ...updatedRefund
    });
  }

  private async notifyRefundStatus(
    refund: RefundWithPaymentAndOrder,
    status: RefundStatus,
    providerRefundId: string | null
  ) {
    const amount = decimalToNumber(refund.amount);

    await this.customerEmails?.notifyCustomer(
      refund.order.userId,
      {
        amount: emailMoney(amount),
        orderId: refund.orderId,
        orderNumber: refund.order.orderNumber,
        partial: amount < decimalToNumber(refund.order.grandTotal),
        refundReference: providerRefundId,
        status,
        template: "refund-update"
      },
      `refund-update:${refund.id}:${status}`
    );
  }

  private assertRefundCanUseRazorpay(refund: RefundWithPaymentAndOrder) {
    if (!refund.payment) {
      throw new BadRequestException("Refund is not linked to a payment.");
    }

    if (refund.payment.method !== PaymentMethod.ONLINE) {
      throw new BadRequestException(
        "Only online payments can be refunded through Razorpay."
      );
    }

    if (refund.payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException("Only paid payments can be refunded.");
    }

    if (refund.payment.provider !== RAZORPAY_PROVIDER) {
      throw new BadRequestException(
        "Refund can be processed only for Razorpay payments."
      );
    }
  }

  private isPaidRazorpayRefund(refund: RefundWithPaymentAndOrder) {
    return (
      refund.payment?.method === PaymentMethod.ONLINE &&
      refund.payment.status === PaymentStatus.PAID &&
      refund.payment.provider === RAZORPAY_PROVIDER
    );
  }

  private async updatePaymentRefundStatus(
    client: PaymentClient,
    paymentId: string
  ) {
    const payment = await client.payment.findFirst({
      where: {
        id: paymentId
      }
    });

    if (!payment) {
      throw new NotFoundException("Payment was not found for this refund.");
    }

    const completedRefunds = await client.refund.findMany({
      where: {
        paymentId,
        status: RefundStatus.COMPLETED
      }
    });
    const completedAmount = completedRefunds.reduce(
      (sum, refund) => sum + decimalToNumber(refund.amount),
      0
    );
    const paidAmount = decimalToNumber(payment.amount);
    const nextStatus =
      completedAmount >= paidAmount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await client.payment.update({
      data: {
        status: nextStatus
      },
      where: {
        id: paymentId
      }
    });
    await client.order.update({
      data: {
        paymentStatus: nextStatus
      },
      where: {
        id: payment.orderId
      }
    });
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

  private serializeRefund(
    refund: Pick<
      RefundWithPaymentAndOrder,
      | "amount"
      | "id"
      | "orderId"
      | "paymentId"
      | "processedAt"
      | "providerRefundId"
      | "reason"
      | "status"
    >
  ) {
    return {
      amount: decimalToNumber(refund.amount),
      id: refund.id,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      processedAt: refund.processedAt,
      providerRefundId: refund.providerRefundId,
      reason: refund.reason,
      status: refund.status
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

function extractRazorpayRefundEntity(
  payload: RazorpayWebhookPayload
): RazorpayRefundEntity | null {
  const eventPayload = readRecord(payload.payload);
  const refundWrapper = readRecord(eventPayload?.refund);
  const entity = readRecord(refundWrapper?.entity);
  const id = readString(entity?.id);
  const paymentId = readString(entity?.payment_id);
  const amount = entity?.amount;
  const status = readRazorpayRefundStatus(entity?.status);

  if (!id || !paymentId || typeof amount !== "number" || !status) {
    return null;
  }

  return {
    amount,
    id,
    paymentId,
    status
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

function mapRazorpayRefundStatus(status: "failed" | "pending" | "processed") {
  if (status === "processed") {
    return RefundStatus.COMPLETED;
  }

  if (status === "failed") {
    return RefundStatus.FAILED;
  }

  return RefundStatus.PROCESSING;
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

function readRazorpayRefundStatus(value: unknown) {
  return value === "failed" || value === "pending" || value === "processed"
    ? value
    : null;
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
