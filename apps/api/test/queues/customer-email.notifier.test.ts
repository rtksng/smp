import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { MODULE_METADATA } from "@nestjs/common/constants";
import type { SendCustomerEmailJobData } from "@surgical/types";
import type { PrismaService } from "../../src/database/prisma.service";
import { CustomersModule } from "../../src/modules/customers/customers.module";
import { DeliveryModule } from "../../src/modules/delivery/delivery.module";
import { OrdersModule } from "../../src/modules/orders/orders.module";
import { PaymentsModule } from "../../src/modules/payments/payments.module";
import { ProductFeedbackModule } from "../../src/modules/product-feedback/product-feedback.module";
import { QuoteRequestsModule } from "../../src/modules/quote-requests/quote-requests.module";
import type { ApiQueueService } from "../../src/queues/api-queue.service";
import { ApiQueuesModule } from "../../src/queues/api-queues.module";
import {
  CustomerEmailNotifier,
  emailAddress,
  emailLineItems,
  emailMoney,
  emailText
} from "../../src/queues/customer-email.notifier";

function createNotifier(options: {
  enqueueError?: Error;
  user?: { email: string | null; firstName: string } | null;
} = {}) {
  const jobs: SendCustomerEmailJobData[] = [];
  const userLookups: unknown[] = [];
  const queues = {
    enqueueCustomerEmail: async (data: SendCustomerEmailJobData) => {
      if (options.enqueueError) throw options.enqueueError;
      jobs.push(data);
    }
  } as unknown as ApiQueueService;
  const prisma = {
    user: {
      findFirst: async (args: unknown) => {
        userLookups.push(args);
        return options.user === undefined
          ? { email: "asha@clinic.in", firstName: "Asha" }
          : options.user;
      }
    }
  } as unknown as PrismaService;

  return { jobs, notifier: new CustomerEmailNotifier(queues, prisma), userLookups };
}

test("notify queues a versioned job for the trimmed customer address", async () => {
  const { jobs, notifier } = createNotifier();

  await notifier.notify(
    { customerId: "customer-1", email: "  asha@clinic.in ", firstName: " Asha " },
    { template: "welcome" },
    "welcome:customer-1"
  );

  assert.equal(jobs.length, 1);
  const job = jobs[0]!;
  assert.equal(job.version, 1);
  assert.equal(job.dedupeKey, "welcome:customer-1");
  assert.deepEqual(job.event, { template: "welcome" });
  assert.deepEqual(job.recipient, {
    customerId: "customer-1",
    email: "asha@clinic.in",
    name: "Asha"
  });
  assert.ok(!Number.isNaN(Date.parse(job.requestedAt)));
});

test("notify does nothing for customers without an email address", async () => {
  const { jobs, notifier } = createNotifier();

  for (const email of [null, undefined, "", "   "]) {
    await notifier.notify(
      { customerId: "customer-1", email, firstName: "Asha" },
      { template: "welcome" },
      "welcome:customer-1"
    );
  }

  assert.equal(jobs.length, 0);
});

test("queue failures never fail the business request", async () => {
  const { notifier } = createNotifier({ enqueueError: new Error("Redis unavailable") });

  await assert.doesNotReject(
    notifier.notify(
      { customerId: "customer-1", email: "asha@clinic.in", firstName: "Asha" },
      { template: "welcome" },
      "welcome:customer-1"
    )
  );
});

test("notifyCustomer looks up the active customer's email", async () => {
  const found = createNotifier();
  await found.notifier.notifyCustomer("customer-1", { template: "welcome" }, "welcome:customer-1");
  assert.deepEqual(found.userLookups[0], {
    select: { email: true, firstName: true },
    where: { deletedAt: null, id: "customer-1" }
  });
  assert.equal(found.jobs[0]?.recipient.email, "asha@clinic.in");

  const missing = createNotifier({ user: null });
  await missing.notifier.notifyCustomer("customer-2", { template: "welcome" }, "welcome:customer-2");
  assert.equal(missing.jobs.length, 0);
});

test("email helpers produce the decimal strings and nullable text the worker validates", () => {
  assert.equal(emailMoney(2360), "2360.00");
  assert.equal(emailMoney("590.5"), "590.50");
  assert.equal(emailMoney({ toFixed: (digits: number) => (12.3).toFixed(digits) }), "12.30");
  assert.deepEqual(
    emailLineItems([{ lineTotal: 1200, name: "Gloves", quantity: 2, unitPrice: 600 }]),
    [{ lineTotal: "1200.00", name: "Gloves", quantity: 2, unitPrice: "600.00" }]
  );
  assert.equal(emailText("  "), null);
  assert.equal(emailText(" Ordered by mistake. "), "Ordered by mistake.");
  assert.deepEqual(
    emailAddress({
      city: "Mumbai",
      fullName: "Dr Asha Rao",
      line1: "12 Surgical Street",
      line2: " ",
      pincode: "400001",
      state: "Maharashtra"
    }),
    {
      city: "Mumbai",
      fullName: "Dr Asha Rao",
      landmark: null,
      line1: "12 Surgical Street",
      line2: null,
      pincode: "400001",
      state: "Maharashtra"
    }
  );
});

// Their services inject CustomerEmailNotifier with @Optional(), which would
// silently become undefined if the module stopped importing ApiQueuesModule.
test("every module whose services send customer emails imports ApiQueuesModule", () => {
  const modules = [
    CustomersModule,
    DeliveryModule,
    OrdersModule,
    PaymentsModule,
    ProductFeedbackModule,
    QuoteRequestsModule
  ];

  for (const moduleClass of modules) {
    const imports: unknown[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleClass) ?? [];
    assert.ok(
      imports.includes(ApiQueuesModule),
      `${moduleClass.name} must import ApiQueuesModule to receive CustomerEmailNotifier`
    );
  }

  const exported: unknown[] = Reflect.getMetadata(MODULE_METADATA.EXPORTS, ApiQueuesModule) ?? [];
  assert.ok(exported.includes(CustomerEmailNotifier));
});
