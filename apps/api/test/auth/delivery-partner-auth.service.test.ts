import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { DeliveryPartnerAuthService } from "../../src/modules/auth/delivery-partner/delivery-partner-auth.service";

type DeliveryPartnerRegistrationInput = {
  email?: string | null;
  fullName: string;
  mobileNumber: string;
  vehicleNumber?: string | null;
};

type DeliveryPartnerRegistrationService = DeliveryPartnerAuthService & {
  registerPartner(input: DeliveryPartnerRegistrationInput): Promise<{
    email: string | null;
    fullName: string;
    id: string;
    mobileNumber: string;
    status: string;
    vehicleNumber: string | null;
  }>;
};

function createDeliveryPartnerAuthPrismaMock(input?: {
  existingPartner?: {
    deletedAt: Date | null;
    id: string;
    status: string;
  } | null;
}) {
  const calls: Record<string, unknown[]> = {
    deliveryPartnerCreate: [],
    deliveryPartnerFindFirst: []
  };
  const prisma = {
    calls,
    deliveryPartner: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.deliveryPartnerCreate.push(args);

        return {
          createdAt: new Date("2026-05-25T10:00:00.000Z"),
          deletedAt: null,
          id: "partner-new",
          status: "PENDING_VERIFICATION",
          updatedAt: new Date("2026-05-25T10:00:00.000Z"),
          ...args.data
        };
      },
      findFirst: async (args: unknown) => {
        calls.deliveryPartnerFindFirst.push(args);

        return input?.existingPartner ?? null;
      }
    }
  };

  return prisma;
}

test("delivery partner registration creates a pending profile for admin approval", async () => {
  const prisma = createDeliveryPartnerAuthPrismaMock();
  const service = new DeliveryPartnerAuthService(
    {} as never,
    {} as never,
    prisma as unknown as PrismaService
  ) as DeliveryPartnerRegistrationService;

  const result = await service.registerPartner({
    email: " driver@example.com ",
    fullName: " Asha Driver ",
    mobileNumber: " +919876543210 ",
    vehicleNumber: " dl01ab1234 "
  });

  assert.deepEqual(result, {
    email: "driver@example.com",
    fullName: "Asha Driver",
    id: "partner-new",
    mobileNumber: "+919876543210",
    status: "PENDING_VERIFICATION",
    vehicleNumber: "DL01AB1234"
  });
  assert.deepEqual(
    (prisma.calls.deliveryPartnerCreate[0] as { data: Record<string, unknown> })
      .data,
    {
      email: "driver@example.com",
      fullName: "Asha Driver",
      mobileNumber: "+919876543210",
      status: "PENDING_VERIFICATION",
      vehicleNumber: "DL01AB1234"
    }
  );
});

test("delivery partner registration rejects an already registered active mobile number", async () => {
  const prisma = createDeliveryPartnerAuthPrismaMock({
    existingPartner: {
      deletedAt: null,
      id: "partner-1",
      status: "ACTIVE"
    }
  });
  const service = new DeliveryPartnerAuthService(
    {} as never,
    {} as never,
    prisma as unknown as PrismaService
  ) as DeliveryPartnerRegistrationService;

  await assert.rejects(
    () =>
      service.registerPartner({
        fullName: "Asha Driver",
        mobileNumber: "+919876543210"
      }),
    BadRequestException
  );
  assert.equal(prisma.calls.deliveryPartnerCreate.length, 0);
});
