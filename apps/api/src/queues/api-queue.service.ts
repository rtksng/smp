import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  CUSTOMER_EMAIL_JOB_NAMES,
  INVOICE_JOB_NAMES,
  LOW_STOCK_ALERT_JOB_NAMES,
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  NOTIFICATION_JOB_NAMES,
  ORDER_MAINTENANCE_JOB_NAMES,
  OTP_JOB_NAMES,
  PAYMENT_WEBHOOK_JOB_NAMES,
  type CustomerEmailJobName,
  type GenerateGstInvoiceJobData,
  type InvoiceJobName,
  type LowStockAlertJobName,
  type NearExpiryAlertJobName,
  type NotificationJobName,
  type OrderMaintenanceJobName,
  type OtpJobName,
  type PaymentWebhookJobName,
  type ProcessPaymentWebhookJobData,
  type ProcessRefundJobData,
  type SendCustomerEmailJobData,
  type SendLowStockAlertJobData,
  type SendDeliveryAssignmentNotificationJobData,
  type SendNearExpiryAlertJobData,
  type SendOrderConfirmationJobData,
  type SendOtpJobData
} from "@surgical/types";
import type { JobsOptions, Queue } from "bullmq";

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    delay: 5000,
    type: "exponential"
  },
  removeOnComplete: 1000,
  removeOnFail: 5000
};

// More attempts than other jobs so Resend rate limits and brief outages recover
// on their own; the worker stops early on permanent provider errors.
const CUSTOMER_EMAIL_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 6,
  backoff: {
    delay: 10000,
    type: "exponential"
  }
};

// OTP jobs carry the login code in plain text, so they are deleted as soon as
// they finish or fail; the worker logs the outcome without the code. Retries
// are quick because the code expires within minutes.
export const OTP_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    delay: 2000,
    type: "exponential"
  },
  removeOnComplete: true,
  removeOnFail: true
};

const UNPAID_ORDER_EXPIRY_SCHEDULER_ID = "expire-unpaid-orders";

// The worker queues the same job, with matching options, for payments that
// arrive by webhook after the order was cancelled.
function refundJobOptions(refundId: string): JobsOptions {
  return {
    attempts: 5,
    backoff: {
      delay: 60_000,
      type: "exponential"
    },
    jobId: `refund-${refundId}`,
    removeOnComplete: true,
    removeOnFail: 500
  };
}

@Injectable()
export class ApiQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.otp)
    private readonly otpQueue: Queue<SendOtpJobData, void, OtpJobName>,
    @InjectQueue(QUEUE_NAMES.notifications)
    private readonly notificationsQueue: Queue<
      SendDeliveryAssignmentNotificationJobData | SendOrderConfirmationJobData,
      void,
      NotificationJobName
    >,
    @InjectQueue(QUEUE_NAMES.customerEmail)
    private readonly customerEmailQueue: Queue<
      SendCustomerEmailJobData,
      void,
      CustomerEmailJobName
    >,
    @InjectQueue(QUEUE_NAMES.invoice)
    private readonly invoiceQueue: Queue<
      GenerateGstInvoiceJobData,
      void,
      InvoiceJobName
    >,
    @InjectQueue(QUEUE_NAMES.paymentWebhook)
    private readonly paymentWebhookQueue: Queue<
      ProcessPaymentWebhookJobData,
      void,
      PaymentWebhookJobName
    >,
    @InjectQueue(QUEUE_NAMES.lowStockAlert)
    private readonly lowStockAlertQueue: Queue<
      SendLowStockAlertJobData,
      void,
      LowStockAlertJobName
    >,
    @InjectQueue(QUEUE_NAMES.nearExpiryAlert)
    private readonly nearExpiryAlertQueue: Queue<
      SendNearExpiryAlertJobData,
      void,
      NearExpiryAlertJobName
    >,
    @InjectQueue(QUEUE_NAMES.orderMaintenance)
    private readonly orderMaintenanceQueue: Queue<
      ProcessRefundJobData | Record<string, never>,
      void,
      OrderMaintenanceJobName
    >
  ) {}

  // Job schedulers are stored in Redis by id, so every API replica can call
  // this on startup and there is still one schedule.
  async scheduleUnpaidOrderExpiry(everyMs: number) {
    await this.orderMaintenanceQueue.upsertJobScheduler(
      UNPAID_ORDER_EXPIRY_SCHEDULER_ID,
      { every: everyMs },
      {
        data: {},
        name: ORDER_MAINTENANCE_JOB_NAMES.expireUnpaidOrders,
        opts: {
          removeOnComplete: 100,
          removeOnFail: 500
        }
      }
    );
  }

  // One job per refund (the job id dedupes repeats). Retries cover Razorpay
  // outages; a refund that keeps failing stays PENDING for an admin.
  async enqueueRefundProcessing(refundId: string) {
    await this.orderMaintenanceQueue.add(
      ORDER_MAINTENANCE_JOB_NAMES.processRefund,
      { refundId, requestedAt: new Date().toISOString(), version: 1 },
      refundJobOptions(refundId)
    );
  }

  async removeUnpaidOrderExpirySchedule() {
    await this.orderMaintenanceQueue.removeJobScheduler(
      UNPAID_ORDER_EXPIRY_SCHEDULER_ID
    );
  }

  async enqueueOtp(data: SendOtpJobData) {
    await this.otpQueue.add(OTP_JOB_NAMES.sendOtp, data, OTP_JOB_OPTIONS);
  }

  async enqueueOrderConfirmation(data: SendOrderConfirmationJobData) {
    await this.notificationsQueue.add(
      NOTIFICATION_JOB_NAMES.sendOrderConfirmation,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }

  async enqueueDeliveryAssignmentNotification(
    data: SendDeliveryAssignmentNotificationJobData
  ) {
    await this.notificationsQueue.add(
      NOTIFICATION_JOB_NAMES.sendDeliveryAssignment,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }

  async enqueueCustomerEmail(data: SendCustomerEmailJobData) {
    await this.customerEmailQueue.add(
      CUSTOMER_EMAIL_JOB_NAMES.sendCustomerEmail,
      data,
      CUSTOMER_EMAIL_JOB_OPTIONS
    );
  }

  async enqueueInvoice(data: GenerateGstInvoiceJobData) {
    await this.invoiceQueue.add(
      INVOICE_JOB_NAMES.generateInvoice,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }

  async enqueuePaymentWebhook(data: ProcessPaymentWebhookJobData) {
    await this.paymentWebhookQueue.add(
      PAYMENT_WEBHOOK_JOB_NAMES.processRazorpayWebhook,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }

  async enqueueLowStockAlert(data: SendLowStockAlertJobData) {
    await this.lowStockAlertQueue.add(
      LOW_STOCK_ALERT_JOB_NAMES.sendLowStockAlert,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }

  async enqueueNearExpiryAlert(data: SendNearExpiryAlertJobData) {
    await this.nearExpiryAlertQueue.add(
      NEAR_EXPIRY_ALERT_JOB_NAMES.sendNearExpiryAlert,
      data,
      DEFAULT_JOB_OPTIONS
    );
  }
}
