import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { CustomerProfileController } from "../../src/modules/customers/customer-profile.controller";
import { CustomerProfileService } from "../../src/modules/customers/customer-profile.service";
import {
  CustomerAddressType,
  type CreateCustomerAddressDto
} from "../../src/modules/customers/dto/customer-profile.dto";
import { CustomerJwtGuard } from "../../src/modules/auth/guards/customer-jwt.guard";
import type { PrismaService } from "../../src/database/prisma.service";

const now = new Date("2026-05-25T10:00:00.000Z");

type UserFixture = {
  businessName: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  email: string | null;
  firstName: string;
  gstNumber: string | null;
  id: string;
  isActive: boolean;
  lastName: string | null;
  mobileNumber: string;
  passwordHash: string | null;
  updatedAt: Date;
};

type AddressFixture = {
  city: string;
  country: string;
  createdAt: Date;
  deletedAt: Date | null;
  fullName: string;
  id: string;
  isDefault: boolean;
  landmark: string | null;
  latitude: number | null;
  line1: string;
  line2: string | null;
  longitude: number | null;
  mobileNumber: string;
  pincode: string;
  state: string;
  type: string;
  updatedAt: Date;
  userId: string;
};

function userFixture(input: Partial<UserFixture> = {}): UserFixture {
  return {
    businessName: "Asha Surgical Clinic",
    createdAt: now,
    deletedAt: null,
    email: "asha@example.com",
    firstName: "Asha",
    gstNumber: "27ABCDE1234F1Z5",
    id: "customer-1",
    isActive: true,
    lastName: "Rao",
    mobileNumber: "+919876543210",
    passwordHash: null,
    updatedAt: now,
    ...input
  };
}

function addressFixture(input: Partial<AddressFixture> = {}): AddressFixture {
  return {
    city: "Mumbai",
    country: "India",
    createdAt: now,
    deletedAt: null,
    fullName: "Dr Asha Rao",
    id: "address-1",
    isDefault: false,
    landmark: "Near City Hospital",
    latitude: 19.076,
    line1: "12 Surgical Street",
    line2: "Floor 3",
    longitude: 72.8777,
    mobileNumber: "+919876543210",
    pincode: "400001",
    state: "Maharashtra",
    type: CustomerAddressType.CLINIC,
    updatedAt: now,
    userId: "customer-1",
    ...input
  };
}

type CustomerPrismaMock = PrismaService & {
  calls: {
    addressCreate: unknown[];
    addressFindFirst: unknown[];
    addressFindMany: unknown[];
    addressUpdate: unknown[];
    addressUpdateMany: unknown[];
    userFindFirst: unknown[];
    userUpdate: unknown[];
  };
};

function matchesWhere(record: AddressFixture, where: Record<string, unknown>) {
  const idMatches = where.id === undefined || record.id === where.id;
  const userMatches = where.userId === undefined || record.userId === where.userId;
  const deletedMatches =
    where.deletedAt === undefined || record.deletedAt === where.deletedAt;

  return idMatches && userMatches && deletedMatches;
}

function createCustomerPrismaMock(input?: {
  addresses?: AddressFixture[];
  user?: UserFixture | null;
}): CustomerPrismaMock {
  const records = input?.addresses ?? [];
  const calls: CustomerPrismaMock["calls"] = {
    addressCreate: [],
    addressFindFirst: [],
    addressFindMany: [],
    addressUpdate: [],
    addressUpdateMany: [],
    userFindFirst: [],
    userUpdate: []
  };
  const prisma = {
    calls,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    address: {
      create: async (args: { data: Partial<AddressFixture> }) => {
        calls.addressCreate.push(args);
        return addressFixture({
          id: "created-address",
          isDefault: Boolean(args.data.isDefault),
          ...args.data
        });
      },
      findFirst: async (args: { orderBy?: unknown; where?: Record<string, unknown> }) => {
        calls.addressFindFirst.push(args);

        return (
          records.find((record) => matchesWhere(record, args.where ?? {})) ?? null
        );
      },
      findMany: async (args: { where?: Record<string, unknown> }) => {
        calls.addressFindMany.push(args);
        return records.filter((record) => matchesWhere(record, args.where ?? {}));
      },
      update: async (args: { data?: Partial<AddressFixture>; where: { id: string } }) => {
        calls.addressUpdate.push(args);
        const existing = records.find((record) => record.id === args.where.id);

        return addressFixture({
          ...(existing ?? { id: args.where.id }),
          ...args.data,
          updatedAt: now
        });
      },
      updateMany: async (args: unknown) => {
        calls.addressUpdateMany.push(args);
        return { count: 1 };
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);
        return input?.user === undefined ? userFixture() : input.user;
      },
      update: async (args: { data: Partial<UserFixture>; where: { id: string } }) => {
        calls.userUpdate.push(args);
        return userFixture({
          ...args.data,
          id: args.where.id,
          updatedAt: now
        });
      }
    }
  };

  return prisma as unknown as CustomerPrismaMock;
}

test("getProfile reads the active token customer and serializes business fields", async () => {
  const prisma = createCustomerPrismaMock();
  const service = new CustomerProfileService(prisma);

  const profile = await service.getProfile("customer-1");

  assert.deepEqual(profile, {
    businessName: "Asha Surgical Clinic",
    email: "asha@example.com",
    gstNumber: "27ABCDE1234F1Z5",
    id: "customer-1",
    mobileNumber: "+919876543210",
    name: "Asha Rao"
  });
  assert.deepEqual(prisma.calls.userFindFirst[0], {
    where: {
      deletedAt: null,
      id: "customer-1",
      isActive: true
    }
  });
});

test("updateProfile maps public profile fields to the customer user record", async () => {
  const prisma = createCustomerPrismaMock();
  const service = new CustomerProfileService(prisma);

  const profile = await service.updateProfile("customer-1", {
    businessName: "Rao Medical Supplies",
    email: "billing@example.com",
    gstNumber: "29ABCDE1234F1Z5",
    name: "Dr Asha Rao"
  });

  assert.equal(profile.name, "Dr Asha Rao");
  assert.deepEqual(prisma.calls.userUpdate[0], {
    data: {
      businessName: "Rao Medical Supplies",
      email: "billing@example.com",
      firstName: "Dr",
      gstNumber: "29ABCDE1234F1Z5",
      lastName: "Asha Rao"
    },
    where: {
      id: "customer-1"
    }
  });
});

test("createAddress makes the first active address default and maps endpoint fields", async () => {
  const prisma = createCustomerPrismaMock({ addresses: [] });
  const service = new CustomerProfileService(prisma);
  const input: CreateCustomerAddressDto = {
    addressLine1: "12 Surgical Street",
    addressLine2: "Floor 3",
    city: "Mumbai",
    fullName: "Dr Asha Rao",
    landmark: "Near City Hospital",
    latitude: 19.076,
    longitude: 72.8777,
    phone: "+919876543210",
    pincode: "400001",
    state: "Maharashtra",
    type: CustomerAddressType.CLINIC
  };

  const address = await service.createAddress("customer-1", input);

  assert.equal(address.id, "created-address");
  assert.equal(address.isDefault, true);
  assert.deepEqual(prisma.calls.addressCreate[0], {
    data: {
      city: "Mumbai",
      fullName: "Dr Asha Rao",
      isDefault: true,
      landmark: "Near City Hospital",
      latitude: 19.076,
      line1: "12 Surgical Street",
      line2: "Floor 3",
      longitude: 72.8777,
      mobileNumber: "+919876543210",
      pincode: "400001",
      state: "Maharashtra",
      type: "CLINIC",
      userId: "customer-1"
    }
  });
});

test("updateAddress rejects addresses outside the token customer's ownership", async () => {
  const prisma = createCustomerPrismaMock({
    addresses: [addressFixture({ id: "address-1", userId: "other-customer" })]
  });
  const service = new CustomerProfileService(prisma);

  await assert.rejects(
    () =>
      service.updateAddress("customer-1", "address-1", {
        city: "Pune"
      }),
    NotFoundException
  );
  assert.equal(prisma.calls.addressUpdate.length, 0);
});

test("updateAddress rejects inactive token customers before mutating addresses", async () => {
  const prisma = createCustomerPrismaMock({
    addresses: [addressFixture()],
    user: null
  });
  const service = new CustomerProfileService(prisma);

  await assert.rejects(
    () =>
      service.updateAddress("customer-1", "address-1", {
        city: "Pune"
      }),
    UnauthorizedException
  );
  assert.equal(prisma.calls.addressUpdate.length, 0);
});

test("setDefaultAddress clears only the token customer's active addresses first", async () => {
  const prisma = createCustomerPrismaMock({
    addresses: [
      addressFixture({ id: "address-1", isDefault: true }),
      addressFixture({ id: "address-2", isDefault: false })
    ]
  });
  const service = new CustomerProfileService(prisma);

  const address = await service.setDefaultAddress("customer-1", "address-2");

  assert.equal(address.isDefault, true);
  assert.deepEqual(prisma.calls.addressUpdateMany[0], {
    data: {
      isDefault: false
    },
    where: {
      deletedAt: null,
      userId: "customer-1"
    }
  });
  assert.deepEqual(prisma.calls.addressUpdate[0], {
    data: {
      isDefault: true
    },
    where: {
      id: "address-2"
    }
  });
});

test("deleteAddress soft deletes own default address and promotes another active address", async () => {
  const prisma = createCustomerPrismaMock({
    addresses: [
      addressFixture({ id: "address-1", isDefault: true }),
      addressFixture({ id: "address-2", isDefault: false })
    ]
  });
  const service = new CustomerProfileService(prisma);

  await service.deleteAddress("customer-1", "address-1");

  const deleteCall = prisma.calls.addressUpdate[0] as {
    data: { deletedAt: unknown; isDefault: boolean };
    where: { id: string };
  };
  assert.equal(deleteCall.data.deletedAt instanceof Date, true);
  assert.deepEqual(deleteCall, {
    data: {
      deletedAt: deleteCall.data.deletedAt,
      isDefault: false
    },
    where: {
      id: "address-1"
    }
  });
  assert.deepEqual(prisma.calls.addressUpdate[1], {
    data: {
      isDefault: true
    },
    where: {
      id: "address-2"
    }
  });
});

test("customer profile controller requires the customer JWT guard", () => {
  assert.deepEqual(
    Reflect.getMetadata(GUARDS_METADATA, CustomerProfileController),
    [CustomerJwtGuard]
  );
});
