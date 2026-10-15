import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type { AuthJwtPayload } from "../auth/common/auth-token.service";
import { AdminRoleCode } from "../roles/roles.constants";

export type WarehouseScope =
  | {
      allWarehouses: true;
    }
  | {
      allWarehouses: false;
      warehouseIds: string[];
    };

export function isSuperAdmin(auth: Pick<AuthJwtPayload, "role">) {
  return auth.role === AdminRoleCode.SuperAdmin;
}

/** Warehouse creation and configuration belong to the super admin alone. */
export function assertSuperAdmin(
  auth: Pick<AuthJwtPayload, "role">,
  message = "Only the super admin can do this."
) {
  if (!isSuperAdmin(auth)) {
    throw new ForbiddenException(message);
  }
}

/** Narrows a warehouse scope to the Prisma filter for a warehouseId column. */
export function toWarehouseIdFilter(scope: WarehouseScope) {
  return scope.allWarehouses ? undefined : { in: scope.warehouseIds };
}

@Injectable()
export class WarehouseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canManageWarehouse(auth: AuthJwtPayload, warehouseId: string) {
    if (isSuperAdmin(auth)) {
      return true;
    }

    const assignment = await this.prisma.warehouseStaff.findFirst({
      where: {
        adminUserId: auth.sub,
        deletedAt: null,
        warehouse: { deletedAt: null },
        warehouseId
      }
    });

    return Boolean(assignment);
  }

  async assertCanManageWarehouse(auth: AuthJwtPayload, warehouseId: string) {
    if (await this.canManageWarehouse(auth, warehouseId)) {
      return;
    }

    throw new ForbiddenException("Admin is not assigned to this warehouse.");
  }

  async getWarehouseScope(auth: AuthJwtPayload): Promise<WarehouseScope> {
    if (isSuperAdmin(auth)) {
      return {
        allWarehouses: true
      };
    }

    const assignments = await this.prisma.warehouseStaff.findMany({
      orderBy: {
        createdAt: "asc"
      },
      select: {
        warehouseId: true
      },
      where: {
        adminUserId: auth.sub,
        deletedAt: null,
        warehouse: { deletedAt: null }
      }
    });

    return {
      allWarehouses: false,
      warehouseIds: assignments.map((assignment) => assignment.warehouseId)
    };
  }

  /**
   * Resolves an optional warehouse filter against the admin's scope: a requested
   * warehouse must be one the admin can manage, and no request means every
   * warehouse in scope (undefined for the super admin).
   */
  async resolveWarehouseFilter(auth: AuthJwtPayload, warehouseId?: string) {
    if (warehouseId !== undefined) {
      await this.assertCanManageWarehouse(auth, warehouseId);

      return warehouseId;
    }

    return toWarehouseIdFilter(await this.getWarehouseScope(auth));
  }
}
