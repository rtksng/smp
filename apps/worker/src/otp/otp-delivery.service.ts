import { Inject, Injectable, Optional } from "@nestjs/common";
import type { SendOtpJobData } from "@surgical/types";
import { UnrecoverableError } from "bullmq";
import { WhatsAppApiError, WhatsAppCloudClient } from "./whatsapp-cloud.client";
import type { WhatsAppOtpConfig } from "./whatsapp-otp.config";

export const WHATSAPP_OTP_CONFIG = Symbol("WHATSAPP_OTP_CONFIG");
export const WHATSAPP_OTP_TRANSPORT = Symbol("WHATSAPP_OTP_TRANSPORT");

export type WhatsAppOtpTransport = Pick<WhatsAppCloudClient, "sendOtp">;

export type OtpDeliveryResult =
  | { messageId: string; status: "sent" }
  | { reason: "expired" | "sending_disabled"; status: "skipped" };

const E164_MOBILE_NUMBER = /^\+[1-9]\d{7,14}$/;

@Injectable()
export class OtpDeliveryService {
  private readonly transport: WhatsAppOtpTransport | null;

  constructor(
    @Inject(WHATSAPP_OTP_CONFIG) private readonly config: WhatsAppOtpConfig,
    @Optional() @Inject(WHATSAPP_OTP_TRANSPORT) transport?: WhatsAppOtpTransport
  ) {
    this.transport =
      transport ?? (config.enabled ? new WhatsAppCloudClient(config) : null);
  }

  async send(data: SendOtpJobData, now = Date.now()): Promise<OtpDeliveryResult> {
    if (!this.config.enabled || !this.transport) {
      return { reason: "sending_disabled", status: "skipped" };
    }

    // After a backlog the code may already be expired; sending it would cost
    // a message and confuse the user.
    if (now - Date.parse(data.requestedAt) > this.config.codeTtlSeconds * 1000) {
      return { reason: "expired", status: "skipped" };
    }

    if (!E164_MOBILE_NUMBER.test(data.mobileNumber)) {
      throw new UnrecoverableError("OTP mobile number must be in E.164 format");
    }

    try {
      return {
        ...(await this.transport.sendOtp({
          code: data.otp,
          to: data.mobileNumber.slice(1)
        })),
        status: "sent"
      };
    } catch (error) {
      if (error instanceof WhatsAppApiError && !error.retryable) {
        throw new UnrecoverableError(error.message);
      }

      throw error;
    }
  }
}
