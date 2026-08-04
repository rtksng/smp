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
    findManyProduct: [],
    findFirstUser: [],
    updateLog: []
  };
  const products = [
    {
      deletedAt: null,
      id: "product-1",
      name: "SurgiPro Artery Forceps",
      sku: "FORCEPS-001",
      slug: "surgical-forceps",
      status: "ACTIVE"
    }
  ];

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
          : products[0];
      },
      findMany: async (args: { where?: Record<string, unknown> }) => {
        calls.findManyProduct.push(args);
        return filterProducts(products, args.where ?? {});
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

  await service.moderateReview("feedback-1", {
    status: "PUBLISHED"
  });

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
  assert.equal(listed.items[0]?.productName, "SurgiPro Artery Forceps");
  assert.equal(listed.items[0]?.question, "Is this autoclavable?");
  assert.equal(listed.items[0]?.status, "ANSWERED");
  assert.equal(listed.items[0]?.type, "QUESTION");
  assert.equal(listed.pagination.total, 1);
  assert.equal(listed.pagination.totalPages, 1);
  assert.equal(prisma.calls.countLog.length, 1);

  const searched = await service.listAdminFeedback({
    limit: 10,
    page: 1,
    productSearch: "forceps",
    type: "QUESTION"
  });

  assert.equal(searched.items.length, 1);
  assert.equal(searched.items[0]?.productName, "SurgiPro Artery Forceps");
  assert.equal(prisma.calls.findManyProduct.length, 3);
});

test("public feedback only exposes approved reviews and answered questions", async () => {
  const prisma = createProductFeedbackPrismaMock();
  const service = new ProductFeedbackService(prisma as unknown as PrismaService);

  const submittedReview = await service.createReview("customer-1", "surgical-forceps", {
    comment: "Useful in daily dressing work.",
    rating: 4,
    title: "Useful"
  });
  const submittedQuestion = await service.createQuestion("customer-1", "surgical-forceps", {
    question: "Does this include a sterile pouch?"
  });

  assert.equal(submittedReview.reviews.length, 1);
  assert.equal(submittedQuestion.questions.length, 1);

  const publicBeforeModeration = await service.listFeedback("surgical-forceps");

  assert.equal(publicBeforeModeration.reviews.length, 0);
  assert.equal(publicBeforeModeration.questions.length, 0);

  const approved = await service.moderateReview("feedback-1", {
    moderationNote: "Verified purchase language is safe.",
    status: "PUBLISHED"
  });
  await service.answerQuestion("feedback-2", {
    answer: "Yes, it ships with one sterile pouch."
  });

  assert.equal(approved.status, "PUBLISHED");
  assert.equal(approved.moderationNote, "Verified purchase language is safe.");

  const publicAfterModeration = await service.listFeedback("surgical-forceps");

  assert.equal(publicAfterModeration.reviews.length, 1);
  assert.equal(publicAfterModeration.questions.length, 1);

  await service.moderateReview("feedback-1", {
    moderationNote: "Temporarily hidden during recheck.",
    status: "HIDDEN"
  });
  await service.moderateQuestion("feedback-2", {
    moderationNote: "Question no longer applies to current SKU.",
    status: "HIDDEN"
  });

  const publicAfterHiding = await service.listFeedback("surgical-forceps");

  assert.equal(publicAfterHiding.reviews.length, 0);
  assert.equal(publicAfterHiding.questions.length, 0);

  const adminHidden = await service.listAdminFeedback({
    limit: 10,
    page: 1,
    status: "HIDDEN"
  });

  assert.equal(adminHidden.items.length, 2);
  assert.equal(adminHidden.items[0]?.moderationNote, "Temporarily hidden during recheck.");
  assert.ok(adminHidden.items[0]?.moderatedAt);
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
  const orFilters = where.OR as Record<string, unknown>[] | undefined;

  return logs.filter((log) => {
    const templateKey = where.templateKey as
      | string
      | { in?: string[] }
      | undefined;
    const matchesDirectFilters =
      (where.channel === undefined || log.channel === where.channel) &&
      matchesValue(log.recipient, where.recipient) &&
      matchesValue(log.status, where.status) &&
      (typeof templateKey === "string"
        ? log.templateKey === templateKey
        : templateKey?.in
          ? templateKey.in.includes(log.templateKey)
          : true);

    return (
      matchesDirectFilters &&
      (!orFilters?.length ||
        orFilters.some(
          (filter) =>
            matchesValue(log.status, filter.status) &&
            matchesValue(log.templateKey, filter.templateKey)
        ))
    );
  });
}

function matchesValue(value: string, filter: unknown) {
  if (filter === undefined) {
    return true;
  }

  if (typeof filter === "string") {
    return value === filter;
  }

  if (filter && typeof filter === "object" && "in" in filter) {
    return ((filter as { in?: string[] }).in ?? []).includes(value);
  }

  return true;
}

function filterProducts<
  T extends {
    deletedAt: null | Date;
    id: string;
    name: string;
    sku: string;
    slug: string;
  }
>(products: T[], where: Record<string, unknown>) {
  const idFilter = where.id as string | { in?: string[] } | undefined;
  const orFilters = where.OR as Array<Record<string, unknown>> | undefined;

  return products.filter((product) => {
    const matchesDeletedAt =
      where.deletedAt === undefined || product.deletedAt === where.deletedAt;
    const matchesId = matchesValue(product.id, idFilter);
    const matchesOr =
      !orFilters?.length ||
      orFilters.some((filter) => matchesProductSearchFilter(product, filter));

    return matchesDeletedAt && matchesId && matchesOr;
  });
}

function matchesProductSearchFilter(
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
  },
  filter: Record<string, unknown>
) {
  if (typeof filter.id === "string") {
    return product.id === filter.id;
  }

  return ["name", "sku", "slug"].some((key) => {
    const fieldFilter = filter[key] as { contains?: string } | undefined;
    const search = fieldFilter?.contains?.toLowerCase();

    return search
      ? product[key as "name" | "sku" | "slug"].toLowerCase().includes(search)
      : false;
  });
}
