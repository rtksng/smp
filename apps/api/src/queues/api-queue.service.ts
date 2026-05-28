import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES } from "@surgical/config";
import {
  INVOICE_JOB_NAMES,
  LOW_STOCK_ALERT_JOB_NAMES,
  NEAR_EXPIRY_ALERT_JOB_NAMES,
  NOTIFICATION_JOB_NAMES,
  OTP_JOB_NAMES,
  PAYMENT_WEBHOOK_JOB_NAMES,
  type GenerateGstInvoiceJobData,
  type InvoiceJobName,
  type LowStockAlertJobName,
  type NearExpiryAlertJobName,
  type NotificationJobName,
  type OtpJobName,
  type PaymentWebhookJobName,
  type ProcessPaymentWebhookJobData,
  type SendLowStockAlertJobData,
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

@Injectable()
export class ApiQueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.otp)
    private readonly otpQueue: Queue<SendOtpJobData, void, OtpJobName>,
    @InjectQueue(QUEUE_NAMES.notifications)
    private readonly notificationsQueue: Queue<
      SendOrderConfirmationJobData,
      void,
      NotificationJobName
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
    >
  ) {}

  async enqueueOtp(data: SendOtpJobData) {
    await this.otpQueue.add(OTP_JOB_NAMES.sendOtp, data, DEFAULT_JOB_OPTIONS);
  }

  async enqueueOrderConfirmation(data: SendOrderConfirmationJobData) {
    await this.notificationsQueue.add(
      NOTIFICATION_JOB_NAMES.sendOrderConfirmation,
      data,
      DEFAULT_JOB_OPTIONS
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
