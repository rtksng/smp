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

@Injectable()
export class WarehouseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async canManageWarehouse(auth: AuthJwtPayload, warehouseId: string) {
    if (this.isSuperAdmin(auth)) {
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
    if (this.isSuperAdmin(auth)) {
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

  private isSuperAdmin(auth: AuthJwtPayload) {
    return auth.role === AdminRoleCode.SuperAdmin;
  }
}
