import { Inject, Injectable, Optional } from "@nestjs/common";
import type { SendCustomerEmailJobData } from "@surgical/types";
import { UnrecoverableError } from "bullmq";
import { renderCustomerEmail } from "./customer/render";
import { buildCustomerEmailVariables } from "./customer/variables";
import { CustomerEmailLogRepository } from "./customer-email-log.repository";
import type { CustomerEmailConfig } from "./email.config";
import { ResendApiError, ResendEmailClient } from "./resend.client";

export const CUSTOMER_EMAIL_CONFIG = Symbol("CUSTOMER_EMAIL_CONFIG");
export const CUSTOMER_EMAIL_TRANSPORT = Symbol("CUSTOMER_EMAIL_TRANSPORT");

export type CustomerEmailTransport = Pick<ResendEmailClient, "send">;

export type CustomerEmailResult =
  | { emailId: string; status: "sent" }
  | { reason: "already_sent" | "sending_disabled"; status: "skipped" };

@Injectable()
export class CustomerEmailService {
  private readonly transport: CustomerEmailTransport | null;

  constructor(
    private readonly logs: CustomerEmailLogRepository,
    @Inject(CUSTOMER_EMAIL_CONFIG) private readonly config: CustomerEmailConfig,
    @Optional() @Inject(CUSTOMER_EMAIL_TRANSPORT) transport?: CustomerEmailTransport
  ) {
    this.transport =
      transport ?? (config.enabled ? new ResendEmailClient(config.apiKey) : null);
  }

  async send(data: SendCustomerEmailJobData): Promise<CustomerEmailResult> {
    if (!this.config.enabled || !this.transport) {
      return { reason: "sending_disabled", status: "skipped" };
    }

    if ((await this.logs.findStatus(data.dedupeKey)) === "SENT") {
      return { reason: "already_sent", status: "skipped" };
    }

    const template = data.event.template;
    const logEntry = {
      customerId: data.recipient.customerId,
      dedupeKey: data.dedupeKey,
      email: data.recipient.email,
      requestedAt: data.requestedAt,
      template
    };
    let rendered: ReturnType<typeof renderCustomerEmail>;

    try {
      rendered = renderCustomerEmail(
        template,
        buildCustomerEmailVariables(data.event, data.recipient, this.config)
      );
    } catch (error) {
      await this.logs.record({
        ...logEntry,
        emailId: null,
        failure: "invalid_content",
        status: "FAILED"
      });
      throw new UnrecoverableError(
        `Customer email content is invalid: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      const { id } = await this.transport.send({
        from: this.config.from,
        html: rendered.html,
        idempotencyKey: data.dedupeKey,
        replyTo: this.config.replyTo,
        subject: rendered.subject,
        tags: [{ name: "template", value: template }],
        text: rendered.text,
        to: data.recipient.email
      });

      await this.logs.record({ ...logEntry, emailId: id, failure: null, status: "SENT" });

      return { emailId: id, status: "sent" };
    } catch (error) {
      if (error instanceof ResendApiError && !error.retryable) {
        await this.logs.record({
          ...logEntry,
          emailId: null,
          failure: error.errorType,
          status: "FAILED"
        });
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  }
}
