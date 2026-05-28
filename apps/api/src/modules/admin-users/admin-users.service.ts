import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import { AdminStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { PasswordService } from "../auth/common/password.service";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import type {
  AdminUserListQueryDto,
  CreateAdminUserDto,
  UpdateAdminUserDto
} from "./dto/admin-user.dto";

type AdminUserRecord = Awaited<ReturnType<AdminUsersService["findUserShape"]>>;
type AdminUserClient =
  | Pick<
      Prisma.TransactionClient,
      "adminAuditLog" | "adminSession" | "adminUser" | "role"
    >
  | PrismaService;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService
  ) {}

  async listAdminUsers(query: AdminUserListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildAdminUserWhere(query);
    const [total, users] = await Promise.all([
      this.prisma.adminUser.count({ where }),
      this.prisma.adminUser.findMany({
        include: {
          role: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: users.map((user) => this.serializeUser(user)),
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

  async createAdminUser(input: CreateAdminUserDto, context: AdminActionContext) {
    await this.assertRoleExists(this.prisma, input.roleId);
    await this.assertEmailAvailable(this.prisma, input.email);
    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.adminUser.create({
          data: {
            email: input.email.trim().toLowerCase(),
            firstName: input.firstName.trim(),
            lastName: input.lastName ?? null,
            mobileNumber: input.mobileNumber ?? null,
            passwordHash,
            roleId: input.roleId,
            status: input.status ?? AdminStatus.ACTIVE
          },
          include: {
            role: true
          }
        });

        await this.writeAuditLog(tx, context, "admin_user.create", createdUser.id, {
          after: this.serializeUser(createdUser)
        });

        return createdUser;
      });

      return this.serializeUser(user);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Admin email or mobile number already exists.");
      }

      throw error;
    }
  }

  async updateAdminUser(
    id: string,
    input: UpdateAdminUserDto,
    context: AdminActionContext
  ) {
    const existingUser = await this.findExistingUser(this.prisma, id);

    if (input.roleId !== undefined) {
      await this.assertRoleExists(this.prisma, input.roleId);
    }
    if (input.email !== undefined) {
      await this.assertEmailAvailable(this.prisma, input.email, id);
    }

    const data: Prisma.AdminUserUncheckedUpdateInput = {};

    if (input.email !== undefined) {
      data.email = input.email.trim().toLowerCase();
    }
    if (input.firstName !== undefined) {
      data.firstName = input.firstName.trim();
    }
    if (Object.prototype.hasOwnProperty.call(input, "lastName")) {
      data.lastName = input.lastName ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, "mobileNumber")) {
      data.mobileNumber = input.mobileNumber ?? null;
    }
    if (input.roleId !== undefined) {
      data.roleId = input.roleId;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.password !== undefined) {
      data.passwordHash = await this.passwordService.hash(input.password);
    }

    if (Object.keys(data).length === 0) {
      return this.serializeUser(existingUser);
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const updatedUser = await tx.adminUser.update({
          data,
          include: {
            role: true
          },
          where: {
            id
          }
        });

        if (data.status && data.status !== AdminStatus.ACTIVE) {
          await tx.adminSession.updateMany({
            data: {
              revokedAt: new Date()
            },
            where: {
              adminUserId: id,
              revokedAt: null
            }
          });
        }

        await this.writeAuditLog(tx, context, "admin_user.update", id, {
          after: this.serializeUser(updatedUser),
          before: this.serializeUser(existingUser)
        });

        return updatedUser;
      });

      return this.serializeUser(user);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Admin email or mobile number already exists.");
      }

      throw error;
    }
  }

  async deleteAdminUser(id: string, context: AdminActionContext) {
    const deletedAt = new Date();

    await this.findExistingUser(this.prisma, id);
    await this.prisma.$transaction(async (tx) => {
      const deletedUser = await tx.adminUser.update({
        data: {
          deletedAt,
          status: AdminStatus.INACTIVE
        },
        include: {
          role: true
        },
        where: {
          id
        }
      });

      await tx.adminSession.updateMany({
        data: {
          revokedAt: deletedAt
        },
        where: {
          adminUserId: id,
          revokedAt: null
        }
      });

      await this.writeAuditLog(tx, context, "admin_user.delete", id, {
        after: this.serializeUser(deletedUser)
      });
    });
  }

  private buildAdminUserWhere(query: AdminUserListQueryDto) {
    const where: Prisma.AdminUserWhereInput = {
      deletedAt: null
    };
    const search = query.search?.trim();

    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.roleCode !== undefined) {
      where.role = {
        code: query.roleCode
      };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobileNumber: { contains: search, mode: "insensitive" } }
      ];
    }

    return where;
  }

  private async assertRoleExists(client: AdminUserClient, roleId: string) {
    const role = await client.role.findFirst({
      where: {
        deletedAt: null,
        id: roleId
      }
    });

    if (!role) {
      throw new NotFoundException("Admin role was not found.");
    }
  }

  private async assertEmailAvailable(
    client: AdminUserClient,
    email: string,
    currentAdminUserId?: string
  ) {
    const existingUser = await client.adminUser.findFirst({
      where: {
        deletedAt: null,
        email: email.trim().toLowerCase(),
        id: currentAdminUserId
          ? {
              not: currentAdminUserId
            }
          : undefined
      }
    });

    if (existingUser) {
      throw new ConflictException("Admin email already exists.");
    }
  }

  private async findExistingUser(client: AdminUserClient, id: string) {
    const user = await client.adminUser.findFirst({
      include: {
        role: true
      },
      where: {
        deletedAt: null,
        id
      }
    });

    if (!user) {
      throw new NotFoundException("Admin user was not found.");
    }

    return user;
  }

  private serializeUser(user: AdminUserRecord) {
    return {
      createdAt: user.createdAt,
      email: user.email,
      firstName: user.firstName,
      id: user.id,
      lastLoginAt: user.lastLoginAt,
      lastName: user.lastName,
      mobileNumber: user.mobileNumber,
      role: {
        code: user.role.code,
        id: user.role.id,
        name: user.role.name
      },
      roleId: user.roleId,
      status: user.status,
      updatedAt: user.updatedAt
    };
  }

  private async writeAuditLog(
    client: AdminUserClient,
    context: AdminActionContext,
    action: string,
    entityId: string,
    values: Record<string, unknown>
  ) {
    await client.adminAuditLog.create({
      data: {
        action,
        adminUserId: context.auth.sub,
        after: values.after === undefined ? undefined : toJsonValue(values.after),
        before: values.before === undefined ? undefined : toJsonValue(values.before),
        entityId,
        entityType: "AdminUser",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }
    });
  }

  private findUserShape() {
    return this.prisma.adminUser.findFirstOrThrow({
      include: {
        role: true
      }
    });
  }
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
