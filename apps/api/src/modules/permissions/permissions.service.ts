import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: {
        code: "asc"
      },
      select: {
        code: true,
        description: true,
        id: true,
        name: true
      },
      where: {
        deletedAt: null
      }
    });
  }
}
