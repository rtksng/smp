import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminCustomersService } from "../../src/modules/customers/admin-customers.service";
import type { PrismaService } from "../../src/database/prisma.service";

const now = new Date("2026-05-25T10:00:00.000Z");

type CustomerRecord = {
  _count: {
    addresses: number;
    orders: number;
  };
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
  updatedAt: Date;
};

type AdminCustomersPrismaMock = PrismaService & {
  calls: {
    userCount: unknown[];
    userFindMany: unknown[];
  };
};

function customer(input: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    _count: {
      addresses: 2,
      orders: 3
    },
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
    updatedAt: now,
    ...input
  };
}

function createPrismaMock(records: CustomerRecord[]): AdminCustomersPrismaMock {
  const calls: AdminCustomersPrismaMock["calls"] = {
    userCount: [],
    userFindMany: []
  };

  return {
    calls,
    user: {
      count: async (args: unknown) => {
        calls.userCount.push(args);
        return records.length;
      },
      findMany: async (args: unknown) => {
        calls.userFindMany.push(args);
        return records;
      }
    }
  } as unknown as AdminCustomersPrismaMock;
}

test("listCustomers searches active non-deleted customers and serializes counts", async () => {
  const prisma = createPrismaMock([customer()]);
  const service = new AdminCustomersService(prisma);

  const result = await service.listCustomers({
    isActive: true,
    limit: 10,
    page: 2,
    search: "asha"
  });

  assert.deepEqual(result, {
    items: [
      {
        addressCount: 2,
        businessName: "Asha Surgical Clinic",
        createdAt: now,
        email: "asha@example.com",
        gstNumber: "27ABCDE1234F1Z5",
        id: "customer-1",
        isActive: true,
        mobileNumber: "+919876543210",
        name: "Asha Rao",
        orderCount: 3,
        updatedAt: now
      }
    ],
    pagination: {
      hasNextPage: false,
      hasPreviousPage: true,
      limit: 10,
      page: 2,
      total: 1,
      totalPages: 1
    }
  });
  assert.deepEqual(prisma.calls.userFindMany[0], {
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      _count: {
        select: {
          addresses: {
            where: {
              deletedAt: null
            }
          },
          orders: true
        }
      },
      businessName: true,
      createdAt: true,
      email: true,
      firstName: true,
      gstNumber: true,
      id: true,
      isActive: true,
      lastName: true,
      mobileNumber: true,
      updatedAt: true
    },
    skip: 10,
    take: 10,
    where: {
      OR: [
        { firstName: { contains: "asha", mode: "insensitive" } },
        { lastName: { contains: "asha", mode: "insensitive" } },
        { mobileNumber: { contains: "asha", mode: "insensitive" } },
        { email: { contains: "asha", mode: "insensitive" } },
        { businessName: { contains: "asha", mode: "insensitive" } },
        { gstNumber: { contains: "asha", mode: "insensitive" } }
      ],
      deletedAt: null,
      isActive: true
    }
  });
});
