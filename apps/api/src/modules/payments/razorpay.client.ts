import { createHmac, timingSafeEqual } from "node:crypto";
import { BadGatewayException, Injectable } from "@nestjs/common";
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

@Injectable()
export class RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService) {
    this.keyId = configService.getOrThrow<string>("razorpayKeyId");
    this.keySecret = configService.getOrThrow<string>("razorpayKeySecret");
    this.webhookSecret = configService.getOrThrow<string>("razorpayWebhookSecret");
  }

  getKeyId() {
    return this.keyId;
  }

  async createOrder(input: RazorpayCreateOrderInput) {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        notes: input.notes,
        receipt: input.receipt
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.keyId}:${this.keySecret}`
        ).toString("base64")}`,
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
