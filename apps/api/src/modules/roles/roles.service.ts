import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          },
          orderBy: {
            createdAt: "asc"
          },
          where: {
            permission: {
              deletedAt: null
            }
          }
        }
      },
      orderBy: {
        code: "asc"
      },
      where: {
        deletedAt: null
      }
    });

    return roles.map((role) => this.serializeRole(role));
  }

  async getRoleByCode(code: string) {
    const role = await this.prisma.role.findFirst({
      include: {
        permissions: {
          include: {
            permission: true
          },
          orderBy: {
            createdAt: "asc"
          },
          where: {
            permission: {
              deletedAt: null
            }
          }
        }
      },
      where: {
        code,
        deletedAt: null
      }
    });

    if (!role) {
      throw new NotFoundException("Role was not found.");
    }

    return this.serializeRole(role);
  }

  private serializeRole(role: Awaited<ReturnType<RolesService["findRoleShape"]>>) {
    return {
      code: role.code,
      description: role.description,
      id: role.id,
      isSystem: role.isSystem,
      name: role.name,
      permissions: role.permissions.map((rolePermission) => ({
        code: rolePermission.permission.code,
        description: rolePermission.permission.description,
        id: rolePermission.permission.id,
        name: rolePermission.permission.name
      }))
    };
  }

  private findRoleShape() {
    return this.prisma.role.findFirstOrThrow({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }
}
