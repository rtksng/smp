import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUSTOMER_EMAIL_JOB_NAMES,
  CUSTOMER_EMAIL_TEMPLATE_KEYS,
  type SendCustomerEmailJobData
} from "@surgical/types";
import { UnrecoverableError, type Job } from "bullmq";
import { customerEmailSamples } from "../src/email/customer/samples";
import { validateSendCustomerEmailJobData } from "../src/email/customer/job-validation";
import {
  buildCustomerEmailNotificationRecord,
  CustomerEmailLogRepository,
  type CustomerEmailLogEntry
} from "../src/email/customer-email-log.repository";
import { CustomerEmailService } from "../src/email/customer-email.service";
import { loadCustomerEmailConfig, type CustomerEmailConfig } from "../src/email/email.config";
import {
  ResendApiError,
  ResendEmailClient,
  type ResendEmailMessage
} from "../src/email/resend.client";
import { CustomerEmailProcessor } from "../src/queues/customer-email.processor";
import type { StructuredLogger } from "../src/structured-logger.service";

const enabledConfig: CustomerEmailConfig = {
  apiKey: "test-key",
  brandName: "Surgical Medical Equipment",
  enabled: true,
  from: "Surgical Medical Equipment <orders@mail.surgical-equipment.in>",
  replyTo: "support@surgical-equipment.in",
  siteUrl: "https://shop.surgical-equipment.in",
  supportEmail: "support@surgical-equipment.in"
};

function jobData(overrides: Partial<SendCustomerEmailJobData> = {}): SendCustomerEmailJobData {
  return {
    dedupeKey: "order-progress:order-1:PACKED",
    event: {
      orderId: "order-1",
      orderNumber: "SMP-2026-1042",
      status: "PACKED",
      template: "order-progress"
    },
    recipient: { customerId: "customer-1", email: "aarav@clinic.in", name: "Aarav" },
    requestedAt: "2026-10-16T10:00:00.000Z",
    version: 1,
    ...overrides
  };
}

class FakeLogs extends CustomerEmailLogRepository {
  readonly records: CustomerEmailLogEntry[] = [];
  constructor(private readonly existing: Record<string, string> = {}) {
    super();
  }
  async findStatus(dedupeKey: string) {
    return this.existing[dedupeKey] ?? null;
  }
  async record(entry: CustomerEmailLogEntry) {
    this.records.push(entry);
  }
}

class FakeTransport {
  readonly sent: ResendEmailMessage[] = [];
  constructor(private readonly outcome: Error | null = null) {}
  async send(message: ResendEmailMessage) {
    this.sent.push(message);
    if (this.outcome) throw this.outcome;
    return { id: "email-123" };
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

test("Resend client posts the documented request with an idempotency key", async () => {
  const calls: Array<{ init: RequestInit; url: string }> = [];
  const client = new ResendEmailClient("re_test", async (url, init) => {
    calls.push({ init, url });
    return jsonResponse(200, { id: "email-1" });
  });

  const result = await client.send({
    from: "Shop <orders@mail.shop.in>",
    html: "<p>Hi</p>",
    idempotencyKey: "welcome:customer-1",
    replyTo: "support@shop.in",
    subject: "Welcome",
    tags: [{ name: "template", value: "welcome" }],
    text: "Hi",
    to: "aarav@clinic.in"
  });

  assert.deepEqual(result, { id: "email-1" });
  assert.equal(calls[0]?.url, "https://api.resend.com/emails");
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer re_test");
  assert.equal(headers["Idempotency-Key"], "welcome:customer-1");
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    from: "Shop <orders@mail.shop.in>",
    html: "<p>Hi</p>",
    reply_to: "support@shop.in",
    subject: "Welcome",
    tags: [{ name: "template", value: "welcome" }],
    text: "Hi",
    to: ["aarav@clinic.in"]
  });
});

test("Resend errors are classified as retryable or permanent", async () => {
  const cases: Array<[number, string, boolean]> = [
    [429, "rate_limit_exceeded", true],
    [429, "daily_quota_exceeded", true],
    [429, "monthly_quota_exceeded", false],
    [409, "concurrent_idempotent_requests", true],
    [409, "invalid_idempotent_request", false],
    [422, "validation_error", false],
    [403, "validation_error", false],
    [500, "application_error", true],
    [503, "service_unavailable", true]
  ];

  for (const [status, name, retryable] of cases) {
    const client = new ResendEmailClient("re_test", async () =>
      jsonResponse(status, { message: "Recipient aarav@clinic.in rejected", name, statusCode: status })
    );
    await assert.rejects(
      client.send({
        from: "a@b.in",
        html: "",
        idempotencyKey: "k",
        replyTo: null,
        subject: "s",
        tags: [],
        text: "",
        to: "c@d.in"
      }),
      (error: unknown) => {
        assert.ok(error instanceof ResendApiError);
        assert.equal(error.retryable, retryable, `${status} ${name}`);
        assert.doesNotMatch(error.message, /aarav@clinic\.in/, "provider messages are not logged");
        return true;
      }
    );
  }

  const offline = new ResendEmailClient("re_test", async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(
    offline.send({ from: "a@b.in", html: "", idempotencyKey: "k", replyTo: null, subject: "s", tags: [], text: "", to: "c@d.in" }),
    (error: unknown) => error instanceof ResendApiError && error.retryable
  );
});

test("email config is disabled by default and strict when enabled", () => {
  assert.deepEqual(loadCustomerEmailConfig({}), { enabled: false });
  assert.throws(
    () => loadCustomerEmailConfig({ EMAIL_SENDING_ENABLED: "true" }),
    /RESEND_API_KEY is required/
  );
  const env = {
    CUSTOMER_SITE_URL: "https://shop.surgical-equipment.in",
    EMAIL_FROM: "Shop <orders@mail.surgical-equipment.in>",
    EMAIL_SENDING_ENABLED: "true",
    EMAIL_SUPPORT_ADDRESS: "support@surgical-equipment.in",
    RESEND_API_KEY: "re_test"
  };
  assert.deepEqual(loadCustomerEmailConfig(env), {
    apiKey: "re_test",
    brandName: "Surgical Medical Equipment",
    enabled: true,
    from: "Shop <orders@mail.surgical-equipment.in>",
    replyTo: "support@surgical-equipment.in",
    siteUrl: "https://shop.surgical-equipment.in",
    supportEmail: "support@surgical-equipment.in"
  });
  assert.throws(
    () => loadCustomerEmailConfig({ ...env, CUSTOMER_SITE_URL: "http://shop.surgical-equipment.in" }),
    /HTTPS origin/
  );
  assert.throws(
    () => loadCustomerEmailConfig({ ...env, CUSTOMER_SITE_URL: "https://shop.surgical-equipment.in/store" }),
    /HTTPS origin/
  );
});

test("job validation accepts every sample event unchanged", () => {
  for (const key of CUSTOMER_EMAIL_TEMPLATE_KEYS) {
    for (const { event } of customerEmailSamples[key]) {
      const data = jobData({ dedupeKey: `${key}:sample`, event });
      assert.deepEqual(validateSendCustomerEmailJobData(JSON.parse(JSON.stringify(data))), data);
    }
  }
});

test("job validation rejects unsafe or malformed payloads", () => {
  const invalid: Array<[unknown, RegExp]> = [
    [{ ...jobData(), version: 2 }, /version/],
    [{ ...jobData(), dedupeKey: "has spaces" }, /dedupeKey/],
    [{ ...jobData(), dedupeKey: "x".repeat(201) }, /dedupeKey/],
    [{ ...jobData(), recipient: { customerId: null, email: "a@b.in, c@d.in", name: "" } }, /single email/],
    [{ ...jobData(), event: { template: "newsletter" } }, /template/],
    [{ ...jobData(), event: { ...jobData().event, status: "SHIPPED" } }, /status/],
    [
      jobData({
        event: {
          amount: "-5.00",
          orderId: "o",
          orderNumber: "n",
          paymentReference: null,
          status: "PAID",
          template: "payment-result"
        }
      }),
      /amount/
    ]
  ];

  for (const [payload, message] of invalid) {
    assert.throws(() => validateSendCustomerEmailJobData(payload), message);
  }
});

test("service skips sending when email is disabled or already sent", async () => {
  const transport = new FakeTransport();
  const disabled = new CustomerEmailService(new FakeLogs(), { enabled: false }, transport);
  assert.deepEqual(await disabled.send(jobData()), { reason: "sending_disabled", status: "skipped" });

  const duplicate = new CustomerEmailService(
    new FakeLogs({ "order-progress:order-1:PACKED": "SENT" }),
    enabledConfig,
    transport
  );
  assert.deepEqual(await duplicate.send(jobData()), { reason: "already_sent", status: "skipped" });
  assert.equal(transport.sent.length, 0);
});

test("service renders, sends through Resend, and records the delivery", async () => {
  const logs = new FakeLogs({ "order-progress:order-1:PACKED": "FAILED" });
  const transport = new FakeTransport();
  const service = new CustomerEmailService(logs, enabledConfig, transport);

  assert.deepEqual(await service.send(jobData()), { emailId: "email-123", status: "sent" });

  const message = transport.sent[0];
  assert.ok(message);
  assert.equal(message.to, "aarav@clinic.in");
  assert.equal(message.from, enabledConfig.from);
  assert.equal(message.replyTo, "support@surgical-equipment.in");
  assert.equal(message.idempotencyKey, "order-progress:order-1:PACKED");
  assert.equal(message.subject, "Order SMP-2026-1042: packed");
  assert.deepEqual(message.tags, [{ name: "template", value: "order-progress" }]);
  assert.match(message.html, /https:\/\/shop\.surgical-equipment\.in\/account\/orders\/order-1/);
  assert.match(message.text, /Hi Aarav,/);
  assert.deepEqual(logs.records, [
    {
      customerId: "customer-1",
      dedupeKey: "order-progress:order-1:PACKED",
      email: "aarav@clinic.in",
      emailId: "email-123",
      failure: null,
      requestedAt: "2026-10-16T10:00:00.000Z",
      status: "SENT",
      template: "order-progress"
    }
  ]);
});

test("service stops retrying on permanent provider errors and records the failure", async () => {
  const logs = new FakeLogs();
  const service = new CustomerEmailService(
    logs,
    enabledConfig,
    new FakeTransport(new ResendApiError(422, "validation_error", false))
  );

  await assert.rejects(service.send(jobData()), UnrecoverableError);
  assert.equal(logs.records[0]?.status, "FAILED");
  assert.equal(logs.records[0]?.failure, "validation_error");
});

test("service rethrows transient provider errors for BullMQ to retry", async () => {
  const logs = new FakeLogs();
  const error = new ResendApiError(429, "rate_limit_exceeded", true);
  const service = new CustomerEmailService(logs, enabledConfig, new FakeTransport(error));

  await assert.rejects(service.send(jobData()), (thrown) => thrown === error);
  assert.deepEqual(logs.records, []);
});

test("service refuses content that fails template validation", async () => {
  const logs = new FakeLogs();
  const transport = new FakeTransport();
  const service = new CustomerEmailService(
    logs,
    { ...enabledConfig, supportEmail: "support@example.com" },
    transport
  );

  await assert.rejects(service.send(jobData()), UnrecoverableError);
  assert.equal(transport.sent.length, 0);
  assert.equal(logs.records[0]?.failure, "invalid_content");
});

test("delivery log rows use their own providerRef namespace and keep no message content", () => {
  const record = buildCustomerEmailNotificationRecord({
    customerId: "customer-1",
    dedupeKey: "welcome:customer-1",
    email: "aarav@clinic.in",
    emailId: "email-123",
    failure: null,
    requestedAt: "2026-10-16T10:00:00.000Z",
    status: "SENT",
    template: "order-received"
  });

  assert.equal(record.channel, "email");
  assert.equal(record.providerRef, "email:welcome:customer-1");
  assert.equal(record.templateKey, "customer_email_order_received");
  assert.ok(record.sentAt instanceof Date);
  assert.deepEqual(Object.keys(record.payload).sort(), [
    "dedupeKey",
    "emailId",
    "failure",
    "provider",
    "requestedAt",
    "template",
    "version"
  ]);
});

class FakeLogger implements Pick<StructuredLogger, "error" | "log"> {
  readonly entries: unknown[] = [];
  log(message: unknown) {
    this.entries.push(message);
  }
  error(message: unknown) {
    this.entries.push(message);
  }
}

test("processor sends valid jobs and logs without the recipient address", async () => {
  const logger = new FakeLogger();
  const service = new CustomerEmailService(new FakeLogs(), enabledConfig, new FakeTransport());
  const processor = new CustomerEmailProcessor(service, logger as unknown as StructuredLogger);

  await processor.process({
    data: jobData(),
    id: "job-1",
    name: CUSTOMER_EMAIL_JOB_NAMES.sendCustomerEmail
  } as Job<SendCustomerEmailJobData>);

  const serialized = JSON.stringify(logger.entries);
  assert.match(serialized, /customer-email\.sent/);
  assert.match(serialized, /email-123/);
  assert.doesNotMatch(serialized, /aarav@clinic\.in/);
});

test("processor marks malformed jobs as unrecoverable", async () => {
  const processor = new CustomerEmailProcessor(
    new CustomerEmailService(new FakeLogs(), enabledConfig, new FakeTransport()),
    new FakeLogger() as unknown as StructuredLogger
  );

  await assert.rejects(
    processor.process({
      data: { version: 1 },
      name: CUSTOMER_EMAIL_JOB_NAMES.sendCustomerEmail
    } as unknown as Job<SendCustomerEmailJobData>),
    UnrecoverableError
  );
});
