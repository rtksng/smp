import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../../src/database/prisma.service";
import { QuoteRequestsService } from "../../src/modules/quote-requests/quote-requests.service";

const now = new Date("2026-06-15T10:00:00.000Z");

function createQuoteRequestsPrismaMock() {
  const logs: Array<Record<string, unknown>> = [];
  const calls: Record<string, unknown[]> = {
    count: [],
    create: [],
    findFirst: [],
    findMany: [],
    update: []
  };

  return {
    calls,
    notificationLog: {
      count: async (args: unknown) => {
        calls.count.push(args);
        return logs.length;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.create.push(args);
        const record = {
          ...args.data,
          createdAt: now,
          id: "quote-1",
          updatedAt: now
        };
        logs.push(record);
        return record;
      },
      findFirst: async (args: { where: { id: string } }) => {
        calls.findFirst.push(args);
        return logs.find((log) => log.id === args.where.id) ?? null;
      },
      findMany: async (args: unknown) => {
        calls.findMany.push(args);
        return logs;
      },
      update: async (args: { data: Record<string, unknown>; where: { id: string } }) => {
        calls.update.push(args);
        const record = logs.find((log) => log.id === args.where.id);

        if (!record) {
          return null;
        }

        Object.assign(record, args.data);
        return record;
      }
    }
  };
}

test("quote requests are saved, listed, and moved through admin status", async () => {
  const prisma = createQuoteRequestsPrismaMock();
  const service = new QuoteRequestsService(prisma as unknown as PrismaService);

  const created = await service.createQuoteRequest({
    email: "Asha@Example.com",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: "Asha Surgical Clinic"
  });

  assert.deepEqual(created, {
    createdAt: now,
    email: "asha@example.com",
    id: "quote-1",
    message: "Need 20 forceps for Mumbai",
    mobileNumber: "+919876543210",
    name: "Dr Asha Rao",
    organization: "Asha Surgical Clinic",
    status: "NEW"
  });

  const list = await service.listAdminQuoteRequests({ status: "NEW" });

  assert.equal(list.items.length, 1);
  assert.deepEqual(
    (prisma.calls.findMany[0] as { where: Record<string, unknown> }).where,
    {
      channel: "support",
      status: "NEW",
      templateKey: "bulk_quote_request"
    }
  );

  const updated = await service.updateAdminQuoteRequestStatus("quote-1", {
    status: "CONTACTED"
  });

  assert.equal(updated.status, "CONTACTED");
  assert.equal(prisma.calls.update.length, 1);
});
