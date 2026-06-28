import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type RazorpayCreateOrderInput = {
  amount: number;
  currency: "INR";
  notes: Record<string, string>;
  receipt: string;
};

export type RazorpayCreateOrderResult = {
  amount: number;
  currency: string;
  id: string;
  receipt: string;
  status: string;
};

export type RazorpayCreateRefundInput = {
  amount: number;
  notes: Record<string, string>;
  receipt: string;
  speed: "normal" | "optimum";
};

export type RazorpayCreateRefundResult = {
  amount: number;
  id: string;
  payment_id: string;
  status: "failed" | "pending" | "processed";
};

export type RazorpayFetchRefundResult = RazorpayCreateRefundResult;

@Injectable()
export class RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly requestTimeoutMs: number;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    this.keyId = configService.getOrThrow<string>("razorpayKeyId");
    this.keySecret = configService.getOrThrow<string>("razorpayKeySecret");
    this.requestTimeoutMs = Number(
      configService.get<number>("razorpayRequestTimeoutMs", 10000)
    );
    this.webhookSecret = configService.getOrThrow<string>("razorpayWebhookSecret");
  }

  getKeyId() {
    return this.keyId;
  }

  isConfigured() {
    return (
      isConfiguredValue(this.keyId) &&
      this.keyId.startsWith("rzp_") &&
      isConfiguredValue(this.keySecret) &&
      isConfiguredValue(this.webhookSecret)
    );
  }

  async createOrder(input: RazorpayCreateOrderInput) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Payment gateway is not configured yet."
      );
    }

    const response = await this.request("https://api.razorpay.com/v1/orders", {
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        notes: input.notes,
        receipt: input.receipt
      }),
      headers: {
        Authorization: this.authorizationHeader(),
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new BadGatewayException("Razorpay order creation failed.");
    }

    if (!isRazorpayCreateOrderResult(payload)) {
      throw new BadGatewayException("Razorpay returned an invalid order response.");
    }

    return payload;
  }

  async createRefund(paymentId: string, input: RazorpayCreateRefundInput) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Payment gateway is not configured yet."
      );
    }

    const response = await this.request(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        paymentId
      )}/refund`,
      {
        body: JSON.stringify({
          amount: input.amount,
          notes: input.notes,
          receipt: input.receipt,
          speed: input.speed
        }),
        headers: {
          Authorization: this.authorizationHeader(),
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new BadGatewayException("Razorpay refund creation failed.");
    }

    if (!isRazorpayCreateRefundResult(payload)) {
      throw new BadGatewayException("Razorpay returned an invalid refund response.");
    }

    return payload;
  }

  async fetchRefund(refundId: string) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Payment gateway is not configured yet."
      );
    }

    const response = await this.request(
      `https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`,
      {
        headers: {
          Authorization: this.authorizationHeader()
        },
        method: "GET"
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new BadGatewayException("Razorpay refund fetch failed.");
    }

    if (!isRazorpayCreateRefundResult(payload)) {
      throw new BadGatewayException("Razorpay returned an invalid refund response.");
    }

    return payload;
  }

  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ) {
    const expected = createHmac("sha256", this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    return safeCompareHex(signature, expected);
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string) {
    const expected = createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return safeCompareHex(signature, expected);
  }

  private authorizationHeader() {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString(
      "base64"
    )}`;
  }

  private async request(url: string, init: RequestInit) {
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      Number.isFinite(this.requestTimeoutMs) && this.requestTimeoutMs > 0
        ? this.requestTimeoutMs
        : 10000
    );

    try {
      return await fetch(url, {
        ...init,
        signal: abortController.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new BadGatewayException("Razorpay request timed out.");
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRazorpayCreateOrderResult(
  value: unknown
): value is RazorpayCreateOrderResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.amount === "number" &&
    typeof value.currency === "string" &&
    typeof value.id === "string" &&
    typeof value.receipt === "string" &&
    typeof value.status === "string"
  );
}

function isRazorpayCreateRefundResult(
  value: unknown
): value is RazorpayCreateRefundResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.amount === "number" &&
    typeof value.id === "string" &&
    typeof value.payment_id === "string" &&
    (value.status === "failed" ||
      value.status === "pending" ||
      value.status === "processed")
  );
}

function safeCompareHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfiguredValue(value: string) {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    !trimmed.toLowerCase().startsWith("replace-with") &&
    !trimmed.toLowerCase().includes("xxxxxxxx")
  );
}
