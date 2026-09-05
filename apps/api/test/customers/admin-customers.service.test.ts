import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { AdminCustomersService } from "../../src/modules/customers/admin-customers.service";
import { AdminCustomersController } from "../../src/modules/customers/admin-customers.controller";
import { AdminCustomerListQueryDto } from "../../src/modules/customers/dto/admin-customer.dto";
import { REQUIRED_PERMISSIONS_KEY } from "../../src/modules/auth/decorators/require-permission.decorator";
import { PermissionCode } from "../../src/modules/permissions/permissions.constants";
import type { PrismaService } from "../../src/database/prisma.service";
import { CustomerStatus } from "../../src/generated/prisma/client";

const now = new Date("2026-05-25T10:00:00.000Z");

type CustomerRecord = {
  _count: {
    addresses: number;
    orders: number;
    supportNotes?: number;
  };
  addresses?: unknown[];
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
  orders?: unknown[];
  status?: "ACTIVE" | "BLOCKED" | "INACTIVE";
  supportNotes?: unknown[];
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
    status: "ACTIVE",
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
    limit: 10,
    page: 2,
    search: "asha",
    status: CustomerStatus.ACTIVE
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
        status: "ACTIVE",
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
      status: true,
      updatedAt: true
    },
    skip: 10,
    take: 10,
    where: {
      AND: [
        {
          OR: [
            { firstName: { contains: "asha", mode: "insensitive" } },
            { lastName: { contains: "asha", mode: "insensitive" } },
            { mobileNumber: { contains: "asha", mode: "insensitive" } },
            { email: { contains: "asha", mode: "insensitive" } },
            { businessName: { contains: "asha", mode: "insensitive" } },
            { gstNumber: { contains: "asha", mode: "insensitive" } }
          ]
        }
      ],
      deletedAt: null,
      status: "ACTIVE"
    }
  });
});

test("listCustomers matches every word of a full-name search across customer fields", async () => {
  const prisma = createPrismaMock([customer()]);
  const service = new AdminCustomersService(prisma);

  await service.listCustomers({ search: "  Asha   Rao  " });

  assert.deepEqual(
    (prisma.calls.userFindMany[0] as { where: { AND: unknown[] } }).where.AND,
    ["Asha", "Rao"].map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { mobileNumber: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { businessName: { contains: term, mode: "insensitive" } },
        { gstNumber: { contains: term, mode: "insensitive" } }
      ]
    }))
  );
});

test("customer status filters preserve false through the API query transform", () => {
  for (const [input, expected] of [
    ["true", true],
    ["false", false],
    ["1", true],
    ["0", false]
  ] as const) {
    const query = plainToInstance(
      AdminCustomerListQueryDto,
      { isActive: input },
      { enableImplicitConversion: true }
    );

    assert.equal(query.isActive, expected);
    assert.equal(validateSync(query).length, 0);
  }
});

test("customer status filters use the explicit account status", async () => {
  const prisma = createPrismaMock([customer()]);
  const service = new AdminCustomersService(prisma);

  await service.listCustomers({ status: CustomerStatus.BLOCKED });

  assert.deepEqual(
    (prisma.calls.userFindMany[0] as { where: unknown }).where,
    {
      deletedAt: null,
      status: "BLOCKED"
    }
  );
});

test("getCustomer returns profile, addresses, recent orders, and support notes", async () => {
  const customerDetail = customer({
    _count: {
      addresses: 1,
      orders: 1,
      supportNotes: 1
    },
    addresses: [
      {
        city: "Mumbai",
        country: "India",
        fullName: "Asha Rao",
        id: "address-1",
        isDefault: true,
        line1: "Clinic road",
        line2: null,
        mobileNumber: "+919876543210",
        pincode: "400001",
        state: "Maharashtra",
        type: "SHIPPING"
      }
    ],
    orders: [
      {
        createdAt: now,
        grandTotal: 1250,
        id: "order-1",
        orderNumber: "ORD-20260525-ABCD1234",
        paymentStatus: "PAID",
        placedAt: now,
        status: "DELIVERED"
      }
    ],
    supportNotes: [
      {
        adminUser: {
          firstName: "Support",
          id: "admin-1",
          lastName: "Agent"
        },
        createdAt: now,
        id: "note-1",
        note: "Customer asked for GST invoice copies."
      }
    ]
  });
  const calls: unknown[] = [];
  const prisma = {
    calls,
    user: {
      findFirst: async (args: unknown) => {
        calls.push(args);
        return customerDetail;
      }
    }
  } as unknown as PrismaService & { calls: unknown[] };
  const service = new AdminCustomersService(prisma);

  const result = await service.getCustomer("customer-1");

  assert.equal(result.id, "customer-1");
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.addresses[0].pincode, "400001");
  assert.equal(result.orders[0].orderNumber, "ORD-20260525-ABCD1234");
  assert.equal(result.supportNotes[0].adminName, "Support Agent");
  assert.deepEqual(calls[0], {
    include: {
      _count: {
        select: {
          addresses: {
            where: {
              deletedAt: null
            }
          },
          orders: true,
          supportNotes: true
        }
      },
      addresses: {
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
          { id: "asc" }
        ],
        where: {
          deletedAt: null
        }
      },
      orders: {
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          createdAt: true,
          grandTotal: true,
          id: true,
          orderNumber: true,
          paymentStatus: true,
          placedAt: true,
          status: true
        },
        take: 20,
        where: {
          deletedAt: null
        }
      },
      supportNotes: {
        include: {
          adminUser: {
            select: {
              firstName: true,
              id: true,
              lastName: true
            }
          }
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 20
      }
    },
    where: {
      deletedAt: null,
      id: "customer-1"
    }
  });
});

test("updateCustomerStatus blocks a customer, revokes sessions, and records a support note", async () => {
  const calls: Record<string, unknown[]> = {
    noteCreate: [],
    sessionUpdateMany: [],
    userFindFirst: [],
    userUpdate: []
  };
  const tx = {
    customerSupportNote: {
      create: async (args: unknown) => {
        calls.noteCreate.push(args);
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);
        return customer({ id: "customer-1" });
      },
      update: async (args: unknown) => {
        calls.userUpdate.push(args);
        return customer({
          id: "customer-1",
          isActive: false,
          status: "BLOCKED"
        });
      }
    },
    userSession: {
      updateMany: async (args: unknown) => {
        calls.sessionUpdateMany.push(args);
      }
    }
  };
  const prisma = {
    $transaction: async <T>(handler: (client: typeof tx) => Promise<T>) =>
      handler(tx)
  } as unknown as PrismaService;
  const service = new AdminCustomersService(prisma);

  const result = await service.updateCustomerStatus(
    "customer-1",
    {
      note: "Repeated failed payment abuse.",
      status: "BLOCKED"
    },
    "admin-1"
  );

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.isActive, false);
  assert.deepEqual(calls.userUpdate[0], {
    data: {
      isActive: false,
      status: "BLOCKED"
    },
    where: {
      id: "customer-1"
    }
  });
  const sessionUpdate = calls.sessionUpdateMany[0] as {
    data: { revokedAt: Date };
    where: Record<string, unknown>;
  };
  assert.equal(sessionUpdate.data.revokedAt instanceof Date, true);
  assert.deepEqual(sessionUpdate.where, {
    revokedAt: null,
    userId: "customer-1"
  });
  assert.deepEqual(calls.noteCreate[0], {
    data: {
      adminUserId: "admin-1",
      customerId: "customer-1",
      note: "Status changed to BLOCKED. Repeated failed payment abuse."
    }
  });
});

test("addSupportNote creates a customer note after verifying the customer exists", async () => {
  const calls: Record<string, unknown[]> = {
    noteCreate: [],
    userFindFirst: []
  };
  const prisma = {
    customerSupportNote: {
      create: async (args: unknown) => {
        calls.noteCreate.push(args);
        return {
          adminUser: {
            firstName: "Support",
            id: "admin-1",
            lastName: "Agent"
          },
          createdAt: now,
          id: "note-1",
          note: "Customer requested a callback."
        };
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);
        return customer({ id: "customer-1" });
      }
    }
  } as unknown as PrismaService;
  const service = new AdminCustomersService(prisma);

  const result = await service.addSupportNote(
    "customer-1",
    { note: "Customer requested a callback." },
    "admin-1"
  );

  assert.equal(result.note, "Customer requested a callback.");
  assert.equal(result.adminName, "Support Agent");
  assert.deepEqual(calls.userFindFirst[0], {
    select: {
      id: true
    },
    where: {
      deletedAt: null,
      id: "customer-1"
    }
  });
  assert.deepEqual(calls.noteCreate[0], {
    data: {
      adminUserId: "admin-1",
      customerId: "customer-1",
      note: "Customer requested a callback."
    },
    include: {
      adminUser: {
        select: {
          firstName: true,
          id: true,
          lastName: true
        }
      }
    }
  });
});

test("admin customer controller methods declare customer read and update permissions", () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminCustomersController.prototype.listCustomers
    ),
    [PermissionCode.UsersRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminCustomersController.prototype.getCustomer
    ),
    [PermissionCode.UsersRead]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminCustomersController.prototype.updateCustomerStatus
    ),
    [PermissionCode.UsersUpdate]
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      AdminCustomersController.prototype.addSupportNote
    ),
    [PermissionCode.UsersUpdate]
  );
});
