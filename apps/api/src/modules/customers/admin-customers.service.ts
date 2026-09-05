import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CustomerStatus, Prisma } from "../../generated/prisma/client";
import type {
  AddCustomerSupportNoteDto,
  AdminCustomerListQueryDto,
  UpdateCustomerStatusDto
} from "./dto/admin-customer.dto";

const CUSTOMER_SUPPORT_NOTE_INCLUDE = {
  adminUser: {
    select: {
      firstName: true,
      id: true,
      lastName: true
    }
  }
} as const satisfies Prisma.CustomerSupportNoteInclude;

const ADMIN_CUSTOMER_DETAIL_INCLUDE = {
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
      { isDefault: "desc" as const },
      { createdAt: "desc" as const },
      { id: "asc" as const }
    ],
    where: {
      deletedAt: null
    }
  },
  orders: {
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
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
    include: CUSTOMER_SUPPORT_NOTE_INCLUDE,
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
    take: 20
  }
} as const satisfies Prisma.UserInclude;

type AdminCustomerDetailRecord = Prisma.UserGetPayload<{
  include: typeof ADMIN_CUSTOMER_DETAIL_INCLUDE;
}>;
type CustomerSupportNoteRecord = Prisma.CustomerSupportNoteGetPayload<{
  include: typeof CUSTOMER_SUPPORT_NOTE_INCLUDE;
}>;
type SerializableCustomerRecord = {
  _count?: {
    addresses: number;
    orders: number;
  };
  businessName: string | null;
  createdAt: Date;
  email: string | null;
  firstName: string;
  gstNumber: string | null;
  id: string;
  isActive: boolean;
  lastName: string | null;
  mobileNumber: string;
  status?: CustomerStatus;
  updatedAt: Date;
};
type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(query: AdminCustomerListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildCustomerWhere(query);
    const [total, customers] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
        where
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: customers.map((customer) => this.serializeCustomer(customer)),
      pagination: {
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
        page,
        total,
        totalPages
      }
    };
  }

  async getCustomer(customerId: string) {
    const customer = await this.prisma.user.findFirst({
      include: ADMIN_CUSTOMER_DETAIL_INCLUDE,
      where: {
        deletedAt: null,
        id: customerId
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    return this.serializeCustomerDetail(customer);
  }

  async updateCustomerStatus(
    customerId: string,
    input: UpdateCustomerStatusDto,
    adminUserId: string
  ) {
    const nextIsActive = input.status === CustomerStatus.ACTIVE;
    const note = input.note?.trim();

    return this.prisma.$transaction(async (tx) => {
      await this.assertCustomerExists(tx, customerId);
      const customer = await tx.user.update({
        data: {
          isActive: nextIsActive,
          status: input.status
        },
        where: {
          id: customerId
        }
      });

      if (!nextIsActive) {
        await tx.userSession.updateMany({
          data: {
            revokedAt: new Date()
          },
          where: {
            revokedAt: null,
            userId: customerId
          }
        });
      }

      await tx.customerSupportNote.create({
        data: {
          adminUserId,
          customerId,
          note: note
            ? `Status changed to ${input.status}. ${note}`
            : `Status changed to ${input.status}.`
        }
      });

      return this.serializeCustomer(customer);
    });
  }

  async addSupportNote(
    customerId: string,
    input: AddCustomerSupportNoteDto,
    adminUserId: string
  ) {
    await this.assertCustomerExists(this.prisma, customerId);

    const note = await this.prisma.customerSupportNote.create({
      data: {
        adminUserId,
        customerId,
        note: input.note.trim()
      },
      include: CUSTOMER_SUPPORT_NOTE_INCLUDE
    });

    return this.serializeSupportNote(note);
  }

  private buildCustomerWhere(query: AdminCustomerListQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null
    };
    const search = query.search?.trim();

    if (query.status !== undefined) {
      where.status = query.status;
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (search) {
      where.AND = search.split(/\s+/).map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { mobileNumber: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { businessName: { contains: term, mode: "insensitive" } },
          { gstNumber: { contains: term, mode: "insensitive" } }
        ]
      }));
    }

    return where;
  }

  private serializeCustomer(customer: SerializableCustomerRecord) {
    return {
      addressCount: customer._count?.addresses ?? 0,
      businessName: customer.businessName,
      createdAt: customer.createdAt,
      email: customer.email,
      gstNumber: customer.gstNumber,
      id: customer.id,
      isActive: customer.isActive,
      mobileNumber: customer.mobileNumber,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
      orderCount: customer._count?.orders ?? 0,
      status: customer.status ?? customerStatusFromIsActive(customer.isActive),
      updatedAt: customer.updatedAt
    };
  }

  private serializeCustomerDetail(customer: AdminCustomerDetailRecord) {
    return {
      ...this.serializeCustomer(customer),
      addresses: customer.addresses.map((address) => ({
        city: address.city,
        country: address.country,
        fullName: address.fullName,
        id: address.id,
        isDefault: address.isDefault,
        line1: address.line1,
        line2: address.line2,
        mobileNumber: address.mobileNumber,
        pincode: address.pincode,
        state: address.state,
        type: address.type
      })),
      orders: customer.orders.map((order) => ({
        createdAt: order.createdAt,
        grandTotal: decimalToNumber(order.grandTotal),
        id: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        placedAt: order.placedAt,
        status: order.status
      })),
      supportNotes: customer.supportNotes.map((note) =>
        this.serializeSupportNote(note)
      )
    };
  }

  private serializeSupportNote(note: CustomerSupportNoteRecord) {
    return {
      adminName: note.adminUser
        ? [note.adminUser.firstName, note.adminUser.lastName]
            .filter(Boolean)
            .join(" ")
        : null,
      adminUserId: note.adminUser?.id ?? null,
      createdAt: note.createdAt,
      id: note.id,
      note: note.note
    };
  }

  private async assertCustomerExists(
    client: Pick<PrismaService, "user"> | Prisma.TransactionClient,
    customerId: string
  ) {
    const customer = await client.user.findFirst({
      select: {
        id: true
      },
      where: {
        deletedAt: null,
        id: customerId
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }
  }

}

function customerStatusFromIsActive(isActive: boolean) {
  return isActive ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE;
}

function decimalToNumber(value: DecimalValue) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value.toString());
}
