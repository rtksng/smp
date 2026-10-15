import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import { AdminStatus, WarehouseStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { PasswordService } from "../auth/common/password.service";
import { AdminRoleCode } from "../roles/roles.constants";
import type {
  AssignWarehouseStaffDto,
  CreateWarehouseDto,
  CreateWarehouseStaffAccountDto,
  UpdateWarehouseDto,
  WarehouseListQueryDto
} from "./dto/warehouse.dto";
import {
  assertSuperAdmin,
  isSuperAdmin,
  WarehouseAccessService
} from "./warehouse-access.service";

type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };
type WarehouseRecord = {
  address: string;
  city: string;
  code: string;
  contactNumber: string;
  contactPerson: string;
  createdAt: Date;
  id: string;
  latitude: DecimalValue | null;
  longitude: DecimalValue | null;
  name: string;
  pincode: string;
  state: string;
  status: WarehouseStatus;
  updatedAt: Date;
};

// Only what staff rows show, so staff reads never load password hashes.
const STAFF_ADMIN_USER_SELECT = {
  email: true,
  firstName: true,
  lastName: true,
  role: { select: { code: true, id: true, name: true } }
} as const satisfies Prisma.AdminUserSelect;

// Super admins reach every warehouse without a staff row, so staff lists and
// pickers leave them out.
const NOT_SUPER_ADMIN = {
  role: { code: { not: AdminRoleCode.SuperAdmin } }
} as const satisfies Prisma.AdminUserWhereInput;

const SUPER_ADMIN_ONLY_MESSAGE = "Only the super admin can create or configure warehouses.";

export type AdminActionContext = {
  auth: AuthJwtPayload;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly warehouseAccessService: WarehouseAccessService,
    @Optional() private readonly passwordService?: PasswordService
  ) {}

  async createWarehouse(input: CreateWarehouseDto, context: AdminActionContext) {
    assertSuperAdmin(context.auth, SUPER_ADMIN_ONLY_MESSAGE);

    try {
      const warehouse = await this.prisma.$transaction(async (tx) => {
        const createdWarehouse = await tx.warehouse.create({
          data: {
            address: input.address,
            city: input.city,
            code: input.code,
            contactNumber: input.contactNumber,
            contactPerson: input.contactPerson,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            name: input.name,
            pincode: input.pincode,
            state: input.state,
            status: input.status ?? WarehouseStatus.ACTIVE
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "warehouse.create",
          after: createdWarehouse,
          entityId: createdWarehouse.id,
          entityType: "Warehouse"
        });

        return createdWarehouse;
      });

      return this.serializeWarehouse(warehouse);
    } catch (error: unknown) {
      this.handleWarehouseWriteError(error);
    }
  }

  async listWarehouses(query: WarehouseListQueryDto, auth: AuthJwtPayload) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = await this.buildWarehouseWhere(query, auth);
    const orderBy = [{ createdAt: "desc" as const }, { id: "asc" as const }];
    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        orderBy,
        skip,
        take: limit,
        where
      }),
      this.prisma.warehouse.count({
        where
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((warehouse) => this.serializeWarehouse(warehouse)),
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

  async getWarehouse(id: string, auth: AuthJwtPayload) {
    await this.assertReadableWarehouse(auth, id);
    const warehouse = await this.findExistingWarehouse(id);

    return this.serializeWarehouse(warehouse);
  }

  async updateWarehouse(
    id: string,
    input: UpdateWarehouseDto,
    context: AdminActionContext
  ) {
    assertSuperAdmin(context.auth, SUPER_ADMIN_ONLY_MESSAGE);
    const existingWarehouse = await this.findExistingWarehouse(id);

    try {
      const warehouse = await this.prisma.$transaction(async (tx) => {
        const updatedWarehouse = await tx.warehouse.update({
          data: this.buildWarehouseUpdateData(input),
          where: {
            id
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "warehouse.update",
          after: updatedWarehouse,
          before: existingWarehouse,
          entityId: id,
          entityType: "Warehouse"
        });

        return updatedWarehouse;
      });

      return this.serializeWarehouse(warehouse);
    } catch (error: unknown) {
      this.handleWarehouseWriteError(error);
    }
  }

  activateWarehouse(id: string, context: AdminActionContext) {
    return this.updateWarehouseStatus(id, WarehouseStatus.ACTIVE, context);
  }

  deactivateWarehouse(id: string, context: AdminActionContext) {
    return this.updateWarehouseStatus(id, WarehouseStatus.INACTIVE, context);
  }

  async deleteWarehouse(id: string, context: AdminActionContext) {
    assertSuperAdmin(context.auth, SUPER_ADMIN_ONLY_MESSAGE);
    const existingWarehouse = await this.findExistingWarehouse(id);
    await this.prisma.$transaction(async (tx) => {
      await this.assertWarehouseSafeToDelete(tx, id);
      const deletedAt = new Date();
      const deletedWarehouse = await tx.warehouse.update({
        data: {
          deletedAt,
          status: WarehouseStatus.INACTIVE
        },
        where: {
          id
        }
      });
      await tx.warehouseStaff.updateMany({
        data: { deletedAt },
        where: { warehouseId: id, deletedAt: null }
      });
      // The warehouse holds no stock, so its product assignments can go with it.
      await tx.productWarehouse.deleteMany({ where: { warehouseId: id } });

      await this.writeAuditLog(tx, context, {
        action: "warehouse.delete",
        after: deletedWarehouse,
        before: existingWarehouse,
        entityId: id,
        entityType: "Warehouse"
      });
    });
  }

  async assignStaff(
    warehouseId: string,
    input: AssignWarehouseStaffDto,
    context: AdminActionContext
  ) {
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      warehouseId
    );
    await this.findExistingWarehouse(warehouseId);
    const adminUser = await this.prisma.adminUser.findFirst({
      select: STAFF_ADMIN_USER_SELECT,
      where: {
        deletedAt: null,
        id: input.adminUserId,
        status: AdminStatus.ACTIVE
      }
    });

    if (!adminUser) {
      throw new NotFoundException("Admin user was not found.");
    }

    if (adminUser.role.code === AdminRoleCode.SuperAdmin) {
      throw new BadRequestException("Super admins already have access to every warehouse.");
    }

    await this.assertStaffInCallerScope(context.auth, input.adminUserId);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const existingAssignment = await tx.warehouseStaff.findFirst({
        where: {
          adminUserId: input.adminUserId,
          warehouseId
        }
      });
      const updatedAssignment = await tx.warehouseStaff.upsert({
        where: { adminUserId_warehouseId: { adminUserId: input.adminUserId, warehouseId } },
        create: { adminUserId: input.adminUserId, warehouseId },
        update: { deletedAt: null }
      });

      await this.writeAuditLog(tx, context, {
        action: "warehouse_staff.assign",
        after: updatedAssignment,
        before: existingAssignment,
        entityId: updatedAssignment.id,
        entityType: "WarehouseStaff"
      });

      return {
        ...updatedAssignment,
        adminUser
      };
    });

    return this.serializeStaffAssignment(assignment);
  }

  async listStaff(warehouseId: string, auth: AuthJwtPayload) {
    await this.assertReadableWarehouse(auth, warehouseId);
    await this.findExistingWarehouse(warehouseId);

    const assignments = await this.prisma.warehouseStaff.findMany({
      include: {
        adminUser: { select: STAFF_ADMIN_USER_SELECT }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: {
        adminUser: { deletedAt: null, ...NOT_SUPER_ADMIN },
        deletedAt: null,
        warehouseId
      }
    });

    return assignments.map((assignment) => this.serializeStaffAssignment(assignment));
  }

  /**
   * Existing admins who can be added to this warehouse. Warehouse-level admins see
   * only people who already work at one of their own warehouses; anyone new joins
   * through a staff account created for the warehouse.
   */
  async listStaffCandidates(warehouseId: string, auth: AuthJwtPayload) {
    await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
    await this.findExistingWarehouse(warehouseId);

    const where: Prisma.AdminUserWhereInput = {
      deletedAt: null,
      ...NOT_SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      warehouses: {
        none: {
          deletedAt: null,
          warehouseId
        }
      }
    };

    if (!isSuperAdmin(auth)) {
      const scope = await this.warehouseAccessService.getWarehouseScope(auth);
      const warehouseIds = scope.allWarehouses ? [] : scope.warehouseIds;

      where.AND = [
        {
          warehouses: {
            some: { deletedAt: null, warehouseId: { in: warehouseIds } }
          }
        }
      ];
    }

    const adminUsers = await this.prisma.adminUser.findMany({
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { email: "asc" }],
      select: {
        email: true,
        firstName: true,
        id: true,
        lastName: true,
        role: {
          select: {
            code: true,
            id: true,
            name: true
          }
        }
      },
      where
    });

    return adminUsers.map(({ id, ...adminUser }) => ({
      adminUserId: id,
      ...adminUser
    }));
  }

  /** Roles the admin may give a new staff account: never more than the admin holds. */
  async listAssignableStaffRoles(warehouseId: string, auth: AuthJwtPayload) {
    await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
    await this.findExistingWarehouse(warehouseId);

    const roles = await this.findGrantableRoles(this.prisma, auth);

    return roles.map((role) => ({
      code: role.code,
      description: role.description,
      id: role.id,
      name: role.name
    }));
  }

  /** Creates an admin account that starts out assigned to this warehouse only. */
  async createStaffAccount(
    warehouseId: string,
    input: CreateWarehouseStaffAccountDto,
    context: AdminActionContext
  ) {
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      warehouseId
    );
    await this.findExistingWarehouse(warehouseId);

    if (!this.passwordService) {
      throw new Error("Password hashing is not configured.");
    }

    const role = (await this.findGrantableRoles(this.prisma, context.auth)).find(
      (item) => item.id === input.roleId
    );

    if (!role) {
      throw new ForbiddenException(
        "Choose a role from the list. Staff accounts cannot have more access than you."
      );
    }

    const email = input.email.trim().toLowerCase();
    const emailTaken = await this.prisma.adminUser.findFirst({
      select: { id: true },
      where: { deletedAt: null, email }
    });

    if (emailTaken) {
      throw new ConflictException("Admin email already exists.");
    }

    const passwordHash = await this.passwordService.hash(input.password);

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const adminUser = await tx.adminUser.create({
          data: {
            email,
            firstName: input.firstName.trim(),
            lastName: input.lastName ?? null,
            mobileNumber: input.mobileNumber ?? null,
            passwordHash,
            roleId: role.id,
            status: AdminStatus.ACTIVE
          },
          select: { id: true, ...STAFF_ADMIN_USER_SELECT }
        });
        const createdAssignment = await tx.warehouseStaff.create({
          data: { adminUserId: adminUser.id, warehouseId }
        });
        const { id: adminUserId, ...staffProfile } = adminUser;

        await this.writeAuditLog(tx, context, {
          action: "admin_user.create",
          after: { adminUserId, ...staffProfile, warehouseId },
          entityId: adminUserId,
          entityType: "AdminUser"
        });
        await this.writeAuditLog(tx, context, {
          action: "warehouse_staff.assign",
          after: createdAssignment,
          entityId: createdAssignment.id,
          entityType: "WarehouseStaff"
        });

        return { ...createdAssignment, adminUser: staffProfile };
      });

      return this.serializeStaffAssignment(assignment);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Admin email or mobile number already exists.");
      }

      throw error;
    }
  }

  async removeStaff(
    warehouseId: string,
    staffId: string,
    context: AdminActionContext
  ) {
    await this.warehouseAccessService.assertCanManageWarehouse(
      context.auth,
      warehouseId
    );
    await this.findExistingWarehouse(warehouseId);

    if (!isSuperAdmin(context.auth) && staffId === context.auth.sub) {
      throw new BadRequestException(
        "You cannot remove yourself from a warehouse. Ask the super admin instead."
      );
    }

    const existingAssignment = await this.prisma.warehouseStaff.findFirst({
      where: {
        adminUser: NOT_SUPER_ADMIN,
        adminUserId: staffId,
        deletedAt: null,
        warehouseId
      }
    });

    if (!existingAssignment) {
      throw new NotFoundException("Warehouse staff assignment was not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      const removedAssignment = await tx.warehouseStaff.update({
        data: {
          deletedAt: new Date()
        },
        where: {
          id: existingAssignment.id
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "warehouse_staff.remove",
        after: removedAssignment,
        before: existingAssignment,
        entityId: removedAssignment.id,
        entityType: "WarehouseStaff"
      });
    });
  }

  private async updateWarehouseStatus(
    id: string,
    status: WarehouseStatus,
    context: AdminActionContext
  ) {
    assertSuperAdmin(context.auth, SUPER_ADMIN_ONLY_MESSAGE);
    const existingWarehouse = await this.findExistingWarehouse(id);

    const warehouse = await this.prisma.$transaction(async (tx) => {
      const updatedWarehouse = await tx.warehouse.update({
        data: {
          status
        },
        where: {
          id
        }
      });

      await this.writeAuditLog(tx, context, {
        action:
          status === WarehouseStatus.ACTIVE
            ? "warehouse.activate"
            : "warehouse.deactivate",
        after: updatedWarehouse,
        before: existingWarehouse,
        entityId: id,
        entityType: "Warehouse"
      });

      return updatedWarehouse;
    });

    return this.serializeWarehouse(warehouse);
  }

  private async buildWarehouseWhere(
    query: WarehouseListQueryDto,
    auth: AuthJwtPayload
  ): Promise<Prisma.WarehouseWhereInput> {
    const where: Prisma.WarehouseWhereInput = {
      deletedAt: null
    };

    if (query.city !== undefined) {
      where.city = {
        contains: query.city,
        mode: "insensitive"
      };
    }
    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } }
      ];
    }
    if (query.state !== undefined) {
      where.state = {
        contains: query.state,
        mode: "insensitive"
      };
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);
    if (!scope.allWarehouses) {
      where.id = {
        in: query.warehouseId
          ? scope.warehouseIds.filter((id) => id === query.warehouseId)
          : scope.warehouseIds
      };
    } else if (query.warehouseId) {
      where.id = query.warehouseId;
    }

    return where;
  }

  private async assertReadableWarehouse(auth: AuthJwtPayload, warehouseId: string) {
    if (isSuperAdmin(auth)) {
      return;
    }

    await this.warehouseAccessService.assertCanManageWarehouse(auth, warehouseId);
  }

  /** Warehouse-level admins can add only people who already work at one of their warehouses. */
  private async assertStaffInCallerScope(auth: AuthJwtPayload, adminUserId: string) {
    if (isSuperAdmin(auth)) {
      return;
    }

    const scope = await this.warehouseAccessService.getWarehouseScope(auth);
    const sharedAssignment = scope.allWarehouses
      ? true
      : await this.prisma.warehouseStaff.findFirst({
          select: { id: true },
          where: {
            adminUserId,
            deletedAt: null,
            warehouseId: { in: scope.warehouseIds }
          }
        });

    if (!sharedAssignment) {
      throw new ForbiddenException(
        "You can add only people who already work at one of your warehouses. Create a staff account for anyone new."
      );
    }
  }

  private async findGrantableRoles(
    client: Pick<Prisma.TransactionClient, "role"> | PrismaService,
    auth: AuthJwtPayload
  ) {
    const roles = await client.role.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        code: true,
        description: true,
        id: true,
        name: true,
        permissions: {
          select: { permission: { select: { code: true } } },
          where: { permission: { deletedAt: null } }
        }
      },
      where: {
        code: { not: AdminRoleCode.SuperAdmin },
        deletedAt: null
      }
    });

    if (isSuperAdmin(auth)) {
      return roles;
    }

    const heldPermissions = new Set(auth.permissions ?? []);

    return roles.filter(
      (role) =>
        role.permissions.length > 0 &&
        role.permissions.every(({ permission }) => heldPermissions.has(permission.code))
    );
  }

  private async findExistingWarehouse(id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        deletedAt: null,
        id
      }
    });

    if (!warehouse) {
      throw new NotFoundException("Warehouse was not found.");
    }

    return warehouse;
  }

  private async assertWarehouseSafeToDelete(tx: Prisma.TransactionClient, id: string) {
    const [inventoryCount, batchCount, movementCount] = await Promise.all([
      tx.inventoryStock.count({
        where: {
          warehouseId: id
        }
      }),
      tx.stockBatch.count({
        where: {
          warehouseId: id
        }
      }),
      tx.stockMovement.count({
        where: {
          warehouseId: id
        }
      })
    ]);

    if (inventoryCount > 0 || batchCount > 0 || movementCount > 0) {
      throw new BadRequestException(
        "Warehouse cannot be deleted while inventory, stock batches, or stock movements exist."
      );
    }
    const references = await tx.warehouse.findUnique({
      where: { id },
      select: { _count: { select: {
        orders: true, orderItems: true, deliveryPickups: true, deliveryChargeRules: true
      } } }
    });
    if (references && Object.values(references._count).some((count) => count > 0)) {
      throw new BadRequestException(
        "Warehouse is used by orders, deliveries, or delivery charge rules. Deactivate it instead."
      );
    }
  }

  private buildWarehouseUpdateData(input: UpdateWarehouseDto) {
    const data: Prisma.WarehouseUpdateInput = {};

    if (input.address !== undefined) {
      data.address = input.address;
    }
    if (input.city !== undefined) {
      data.city = input.city;
    }
    if (input.code !== undefined) {
      data.code = input.code;
    }
    if (input.contactNumber !== undefined) {
      data.contactNumber = input.contactNumber;
    }
    if (input.contactPerson !== undefined) {
      data.contactPerson = input.contactPerson;
    }
    if (input.latitude !== undefined) {
      data.latitude = input.latitude;
    }
    if (input.longitude !== undefined) {
      data.longitude = input.longitude;
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.pincode !== undefined) {
      data.pincode = input.pincode;
    }
    if (input.state !== undefined) {
      data.state = input.state;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    return data;
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    context: AdminActionContext,
    input: {
      action: string;
      after?: unknown;
      before?: unknown;
      entityId?: string;
      entityType: string;
    }
  ) {
    await tx.adminAuditLog.create({
      data: {
        action: input.action,
        adminUserId: context.auth.sub,
        after: input.after === undefined ? undefined : toJsonValue(input.after),
        before: input.before === undefined ? undefined : toJsonValue(input.before),
        entityId: input.entityId,
        entityType: input.entityType,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      }
    });
  }

  private serializeWarehouse(warehouse: WarehouseRecord) {
    return {
      address: warehouse.address,
      city: warehouse.city,
      code: warehouse.code,
      contactNumber: warehouse.contactNumber,
      contactPerson: warehouse.contactPerson,
      createdAt: warehouse.createdAt,
      id: warehouse.id,
      latitude: decimalToNumberOrNull(warehouse.latitude),
      longitude: decimalToNumberOrNull(warehouse.longitude),
      name: warehouse.name,
      pincode: warehouse.pincode,
      state: warehouse.state,
      status: warehouse.status,
      updatedAt: warehouse.updatedAt
    };
  }

  private serializeStaffAssignment(assignment: {
    adminUser: {
      email: string;
      firstName: string;
      lastName: string | null;
      role: { code: string; id: string; name: string };
    };
    adminUserId: string;
    id: string;
    warehouseId: string;
  }) {
    return {
      adminUserId: assignment.adminUserId,
      email: assignment.adminUser.email,
      firstName: assignment.adminUser.firstName,
      id: assignment.id,
      lastName: assignment.adminUser.lastName,
      role: {
        code: assignment.adminUser.role.code,
        id: assignment.adminUser.role.id,
        name: assignment.adminUser.role.name
      },
      warehouseId: assignment.warehouseId
    };
  }

  private handleWarehouseWriteError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Warehouse code already exists.");
    }

    throw error;
  }
}

function decimalToNumberOrNull(value: DecimalValue | null) {
  if (value === null) {
    return null;
  }

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

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
