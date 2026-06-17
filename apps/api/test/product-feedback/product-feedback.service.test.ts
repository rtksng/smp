import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { ProductFeedbackService } from "../../src/modules/product-feedback/product-feedback.service";

const now = new Date("2026-06-15T10:00:00.000Z");

function createProductFeedbackPrismaMock(input?: {
  customerExists?: boolean;
  productExists?: boolean;
}) {
  const logs: Array<{
    channel: string;
    createdAt: Date;
    id: string;
    payload: unknown;
    recipient: string;
    status: string;
    templateKey: string;
    updatedAt: Date;
    userId: string | null;
  }> = [];
  const calls: Record<string, unknown[]> = {
    countLog: [],
    createLog: [],
    findFirstLog: [],
    findManyLog: [],
    findFirstProduct: [],
    findFirstUser: [],
    updateLog: []
  };

  return {
    calls,
    notificationLog: {
      create: async (args: {
        data: {
          channel: string;
          payload: unknown;
          recipient: string;
          status: string;
          templateKey: string;
          userId: string;
        };
      }) => {
        calls.createLog.push(args);
        const record = {
          ...args.data,
          createdAt: now,
          id: `feedback-${logs.length + 1}`,
          updatedAt: now
        };
        logs.push(record);
        return record;
      },
      findFirst: async (args: { where: { id: string } }) => {
        calls.findFirstLog.push(args);
        return logs.find((log) => log.id === args.where.id) ?? null;
      },
      count: async (args: { where: Record<string, unknown> }) => {
        calls.countLog.push(args);
        return filterLogs(logs, args.where).length;
      },
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.findManyLog.push(args);
        return filterLogs(logs, args.where);
      },
      update: async (args: {
        data: { payload: unknown; status: string };
        where: { id: string };
      }) => {
        calls.updateLog.push(args);
        const record = logs.find((log) => log.id === args.where.id);

        if (!record) {
          throw new Error("Feedback log not found.");
        }

        record.payload = args.data.payload;
        record.status = args.data.status;
        record.updatedAt = now;
        return record;
      }
    },
    product: {
      findFirst: async (args: unknown) => {
        calls.findFirstProduct.push(args);
        return input?.productExists === false
          ? null
          : {
              deletedAt: null,
              id: "product-1",
              slug: "surgical-forceps",
              status: "ACTIVE"
            };
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.findFirstUser.push(args);
        return input?.customerExists === false
          ? null
          : {
              businessName: "Asha Surgical Clinic",
              deletedAt: null,
              firstName: "Asha",
              id: "customer-1",
              isActive: true,
              lastName: "Rao",
              mobileNumber: "+919876543210"
            };
      }
    }
  };
}

test("product feedback captures reviews, questions, and admin answers", async () => {
  const prisma = createProductFeedbackPrismaMock();
  const service = new ProductFeedbackService(prisma as unknown as PrismaService);

  const reviewed = await service.createReview("customer-1", "surgical-forceps", {
    comment: "  Consistent grip and easy to sterilize.  ",
    rating: 5,
    title: " Reliable "
  });

  assert.equal(reviewed.reviews.length, 1);
  assert.equal(reviewed.reviews[0]?.comment, "Consistent grip and easy to sterilize.");
  assert.equal(reviewed.reviews[0]?.customerName, "Asha Rao");
  assert.equal(reviewed.reviews[0]?.rating, 5);
  assert.equal(reviewed.reviews[0]?.title, "Reliable");

  const asked = await service.createQuestion("customer-1", "surgical-forceps", {
    question: "  Is this autoclavable?  "
  });

  assert.equal(asked.questions.length, 1);
  assert.equal(asked.questions[0]?.question, "Is this autoclavable?");
  assert.equal(asked.questions[0]?.status, "PENDING");

  const answered = await service.answerQuestion("feedback-2", {
    answer: "  Yes, it supports standard autoclave cycles.  "
  });

  assert.equal(answered.answer, "Yes, it supports standard autoclave cycles.");
  assert.equal(answered.status, "ANSWERED");

  const listed = await service.listFeedback("surgical-forceps");

  assert.equal(listed.reviews.length, 1);
  assert.equal(listed.questions.length, 1);
  assert.equal(listed.questions[0]?.answer, "Yes, it supports standard autoclave cycles.");
});

test("admin feedback listing filters questions and keeps answer context", async () => {
  const prisma = createProductFeedbackPrismaMock();
  const service = new ProductFeedbackService(prisma as unknown as PrismaService);

  await service.createReview("customer-1", "surgical-forceps", {
    comment: "Well packed and useful.",
    rating: 4,
    title: "Useful"
  });
  await service.createQuestion("customer-1", "surgical-forceps", {
    question: "Is this autoclavable?"
  });
  await service.answerQuestion("feedback-2", {
    answer: "Yes, it supports standard autoclave cycles."
  });

  const listed = await service.listAdminFeedback({
    limit: 10,
    page: 1,
    status: "ANSWERED",
    type: "QUESTION"
  });

  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0]?.answer, "Yes, it supports standard autoclave cycles.");
  assert.equal(listed.items[0]?.customerName, "Asha Rao");
  assert.equal(listed.items[0]?.productId, "product-1");
  assert.equal(listed.items[0]?.question, "Is this autoclavable?");
  assert.equal(listed.items[0]?.status, "ANSWERED");
  assert.equal(listed.items[0]?.type, "QUESTION");
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.pagination.totalPages, 1);
  assert.equal(prisma.calls.countLog.length, 1);
});

test("product feedback rejects missing products or inactive customers", async () => {
  await assert.rejects(
    () =>
      new ProductFeedbackService(
        createProductFeedbackPrismaMock({
          productExists: false
        }) as unknown as PrismaService
      ).listFeedback("missing-product"),
    NotFoundException
  );

  await assert.rejects(
    () =>
      new ProductFeedbackService(
        createProductFeedbackPrismaMock({
          customerExists: false
        }) as unknown as PrismaService
      ).createQuestion("customer-1", "surgical-forceps", {
        question: "Is this sterile?"
      }),
    NotFoundException
  );
});

function filterLogs<
  T extends {
    channel: string;
    recipient: string;
    status: string;
    templateKey: string;
  }
>(logs: T[], where: Record<string, unknown>) {
  return logs.filter((log) => {
    const templateKey = where.templateKey as
      | string
      | { in?: string[] }
      | undefined;

    return (
      (where.channel === undefined || log.channel === where.channel) &&
      (where.recipient === undefined || log.recipient === where.recipient) &&
      (where.status === undefined || log.status === where.status) &&
      (typeof templateKey === "string"
        ? log.templateKey === templateKey
        : templateKey?.in
          ? templateKey.in.includes(log.templateKey)
          : true)
    );
  });
}
