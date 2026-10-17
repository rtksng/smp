import assert from "node:assert/strict";
import { test } from "node:test";
import { OTP_JOB_NAMES, type SendOtpJobData } from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import {
  OtpDeliveryService,
  type WhatsAppOtpTransport
} from "../src/otp/otp-delivery.service";
import {
  WhatsAppApiError,
  WhatsAppCloudClient,
  type WhatsAppOtpMessage
} from "../src/otp/whatsapp-cloud.client";
import { loadWhatsAppOtpConfig, type WhatsAppOtpConfig } from "../src/otp/whatsapp-otp.config";
import { OtpProcessor } from "../src/queues/otp.processor";
import type { StructuredLogger } from "../src/structured-logger.service";

const SETTINGS = {
  accessToken: "EAAG-test-token",
  apiVersion: "v23.0",
  phoneNumberId: "1234567890",
  templateLanguage: "en_US",
  templateName: "login_otp"
};

const ENABLED_CONFIG: WhatsAppOtpConfig = {
  ...SETTINGS,
  codeTtlSeconds: 300,
  enabled: true
};

const REQUESTED_AT = "2026-10-17T06:30:00.000Z";
const JUST_AFTER_REQUEST = Date.parse(REQUESTED_AT) + 5_000;

function otpJob(overrides: Partial<SendOtpJobData> = {}): SendOtpJobData {
  return {
    mobileNumber: "+919876543210",
    otp: "482915",
    purpose: "customer",
    requestedAt: REQUESTED_AT,
    version: 1,
    ...overrides
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

class FakeTransport implements WhatsAppOtpTransport {
  readonly sent: WhatsAppOtpMessage[] = [];
  constructor(private readonly outcome: Error | null = null) {}

  async sendOtp(message: WhatsAppOtpMessage) {
    this.sent.push(message);
    if (this.outcome) throw this.outcome;
    return { messageId: "wamid.sent" };
  }
}

test("WhatsApp client posts an authentication template with the code in body and button", async () => {
  const calls: Array<{ init: RequestInit; url: string }> = [];
  const client = new WhatsAppCloudClient(SETTINGS, async (url, init) => {
    calls.push({ init, url });
    return jsonResponse(200, {
      contacts: [{ input: "919876543210", wa_id: "919876543210" }],
      messages: [{ id: "wamid.HBgM" }],
      messaging_product: "whatsapp"
    });
  });

  const result = await client.sendOtp({ code: "482915", to: "919876543210" });

  assert.deepEqual(result, { messageId: "wamid.HBgM" });
  assert.equal(calls[0]?.url, "https://graph.facebook.com/v23.0/1234567890/messages");
  assert.equal(calls[0]?.init.method, "POST");
  assert.ok(calls[0]?.init.signal, "requests have a timeout");
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer EAAG-test-token");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    template: {
      components: [
        { parameters: [{ text: "482915", type: "text" }], type: "body" },
        {
          index: "0",
          parameters: [{ text: "482915", type: "text" }],
          sub_type: "url",
          type: "button"
        }
      ],
      language: { code: "en_US" },
      name: "login_otp"
    },
    to: "919876543210",
    type: "template"
  });
});

test("WhatsApp errors are classified as retryable or permanent", async () => {
  const cases: Array<[number, number | null, boolean]> = [
    [400, 130429, true], // throughput limit
    [400, 131056, true], // pair rate limit
    [400, 80007, true], // account rate limit
    [400, 4, true], // app request limit
    [429, null, true],
    [500, 131000, true],
    [503, null, true],
    [401, 190, false], // expired access token
    [400, 131026, false], // number not on WhatsApp
    [400, 132001, false], // template does not exist
    [400, 100, false], // invalid parameter
    [400, null, false]
  ];

  for (const [status, code, retryable] of cases) {
    const client = new WhatsAppCloudClient(SETTINGS, async () =>
      jsonResponse(status, {
        error: {
          code,
          message: "Recipient +919876543210 cannot receive messages",
          type: "OAuthException"
        }
      })
    );

    await assert.rejects(client.sendOtp({ code: "482915", to: "919876543210" }), (error: unknown) => {
      assert.ok(error instanceof WhatsAppApiError);
      assert.equal(error.retryable, retryable, `${status} ${code}`);
      assert.doesNotMatch(error.message, /9876543210/, "provider messages are not kept");
      return true;
    });
  }

  const offline = new WhatsAppCloudClient(SETTINGS, async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(
    offline.sendOtp({ code: "482915", to: "919876543210" }),
    (error: unknown) => error instanceof WhatsAppApiError && error.retryable
  );
});

test("WhatsApp OTP config is disabled by default and strict when enabled", () => {
  assert.deepEqual(loadWhatsAppOtpConfig({}), { enabled: false });
  assert.deepEqual(loadWhatsAppOtpConfig({ WHATSAPP_OTP_ENABLED: "false" }), {
    enabled: false
  });

  const complete = {
    WHATSAPP_ACCESS_TOKEN: " EAAG-test-token ",
    WHATSAPP_GRAPH_API_VERSION: "v23.0",
    WHATSAPP_OTP_ENABLED: "true",
    WHATSAPP_OTP_TEMPLATE_NAME: "login_otp",
    WHATSAPP_PHONE_NUMBER_ID: "1234567890"
  };

  assert.deepEqual(loadWhatsAppOtpConfig(complete), ENABLED_CONFIG);
  assert.deepEqual(
    loadWhatsAppOtpConfig({
      ...complete,
      OTP_TTL_SECONDS: "600",
      WHATSAPP_OTP_TEMPLATE_LANGUAGE: "en"
    }),
    { ...ENABLED_CONFIG, codeTtlSeconds: 600, templateLanguage: "en" }
  );

  for (const key of [
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_GRAPH_API_VERSION",
    "WHATSAPP_OTP_TEMPLATE_NAME",
    "WHATSAPP_PHONE_NUMBER_ID"
  ]) {
    assert.throws(
      () => loadWhatsAppOtpConfig({ ...complete, [key]: "" }),
      new RegExp(`${key} is required`)
    );
  }

  assert.throws(
    () => loadWhatsAppOtpConfig({ ...complete, WHATSAPP_PHONE_NUMBER_ID: "+919876543210" }),
    /numeric phone number ID/
  );
  assert.throws(
    () => loadWhatsAppOtpConfig({ ...complete, WHATSAPP_GRAPH_API_VERSION: "23" }),
    /must look like v23.0/
  );
  assert.throws(
    () => loadWhatsAppOtpConfig({ ...complete, OTP_TTL_SECONDS: "0" }),
    /OTP_TTL_SECONDS/
  );
});

test("delivery skips sending when WhatsApp OTP is disabled", async () => {
  const transport = new FakeTransport();
  const service = new OtpDeliveryService({ enabled: false }, transport);

  assert.deepEqual(await service.send(otpJob(), JUST_AFTER_REQUEST), {
    reason: "sending_disabled",
    status: "skipped"
  });
  assert.equal(transport.sent.length, 0);
});

test("delivery sends the code to the number without the plus sign", async () => {
  const transport = new FakeTransport();
  const service = new OtpDeliveryService(ENABLED_CONFIG, transport);

  assert.deepEqual(await service.send(otpJob(), JUST_AFTER_REQUEST), {
    messageId: "wamid.sent",
    status: "sent"
  });
  assert.deepEqual(transport.sent, [{ code: "482915", to: "919876543210" }]);
});

test("delivery does not send codes that have already expired", async () => {
  const transport = new FakeTransport();
  const service = new OtpDeliveryService(ENABLED_CONFIG, transport);

  assert.deepEqual(await service.send(otpJob(), Date.parse(REQUESTED_AT) + 301_000), {
    reason: "expired",
    status: "skipped"
  });
  assert.equal(transport.sent.length, 0);
});

test("delivery rejects numbers that are not in E.164 format without retrying", async () => {
  const transport = new FakeTransport();
  const service = new OtpDeliveryService(ENABLED_CONFIG, transport);

  await assert.rejects(
    service.send(otpJob({ mobileNumber: "9876543210" }), JUST_AFTER_REQUEST),
    UnrecoverableError
  );
  assert.equal(transport.sent.length, 0);
});

test("delivery stops retrying on permanent WhatsApp errors", async () => {
  const service = new OtpDeliveryService(
    ENABLED_CONFIG,
    new FakeTransport(new WhatsAppApiError(400, 131026, false))
  );

  await assert.rejects(service.send(otpJob(), JUST_AFTER_REQUEST), (error: unknown) => {
    assert.ok(error instanceof UnrecoverableError);
    assert.match(error.message, /code 131026/);
    return true;
  });
});

test("delivery rethrows temporary WhatsApp errors for BullMQ to retry", async () => {
  const temporary = new WhatsAppApiError(400, 130429, true);
  const service = new OtpDeliveryService(ENABLED_CONFIG, new FakeTransport(temporary));

  await assert.rejects(service.send(otpJob(), JUST_AFTER_REQUEST), (error: unknown) => {
    assert.equal(error, temporary);
    return true;
  });
});

test("processor marks malformed OTP jobs as unrecoverable", async () => {
  const errors: unknown[] = [];
  const processor = new OtpProcessor(
    new OtpDeliveryService(ENABLED_CONFIG, new FakeTransport()),
    { error: (message: unknown) => errors.push(message), log: () => undefined } as unknown as StructuredLogger
  );

  await assert.rejects(
    processor.process({
      attemptsMade: 0,
      data: { ...otpJob(), otp: "" },
      id: "job-1",
      name: OTP_JOB_NAMES.sendOtp
    } as Job<SendOtpJobData, void, typeof OTP_JOB_NAMES.sendOtp>),
    UnrecoverableError
  );
  assert.equal(errors.length, 1);
  assert.doesNotMatch(JSON.stringify(errors), /9876543210/);
});
