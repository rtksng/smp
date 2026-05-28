import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type { AdminCustomerListQueryDto } from "./dto/admin-customer.dto";

type AdminCustomerRecord = Awaited<
  ReturnType<AdminCustomersService["findCustomerShape"]>
>;

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

  private buildCustomerWhere(query: AdminCustomerListQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null
    };
    const search = query.search?.trim();

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { businessName: { contains: search, mode: "insensitive" } },
        { gstNumber: { contains: search, mode: "insensitive" } }
      ];
    }

    return where;
  }

  private serializeCustomer(customer: AdminCustomerRecord) {
    return {
      addressCount: customer._count.addresses,
      businessName: customer.businessName,
      createdAt: customer.createdAt,
      email: customer.email,
      gstNumber: customer.gstNumber,
      id: customer.id,
      isActive: customer.isActive,
      mobileNumber: customer.mobileNumber,
      name: [customer.firstName, customer.lastName].filter(Boolean).join(" "),
      orderCount: customer._count.orders,
      updatedAt: customer.updatedAt
    };
  }

  private findCustomerShape() {
    return this.prisma.user.findFirstOrThrow({
      select: {
        _count: {
          select: {
            addresses: true,
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
      }
    });
  }
}
