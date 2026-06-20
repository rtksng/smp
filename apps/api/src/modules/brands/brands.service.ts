import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { resolveStoredUploadUrl } from "../uploads/upload-url";
import type { CreateBrandDto } from "./dto/create-brand.dto";
import type { UpdateBrandDto } from "./dto/update-brand.dto";
import {
  FIXED_CATALOG_BRAND_SLUGS,
  isFixedCatalogBrandSlug
} from "./fixed-catalog-brands";

type BrandRecord = {
  deletedAt: Date | null;
  description: string | null;
  id: string;
  isActive: boolean;
  logoUrl: string | null;
  name: string;
  slug: string;
};

type BrandUpdateData = {
  description?: string | null;
  isActive?: boolean;
  logoUrl?: string | null;
  name?: string;
  slug?: string;
};

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicBrands() {
    const brands = await this.prisma.brand.findMany({
      orderBy: {
        name: "asc"
      },
      where: {
        deletedAt: null,
        isActive: true,
        slug: {
          in: [...FIXED_CATALOG_BRAND_SLUGS]
        }
      }
    });

    return brands
      .filter(
        (brand) =>
          brand.deletedAt === null &&
          brand.isActive &&
          isFixedCatalogBrandSlug(brand.slug)
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((brand) => this.serializeBrand(brand));
  }

  async listAdminBrands() {
    const brands = await this.prisma.brand.findMany({
      orderBy: {
        name: "asc"
      },
      where: {
        deletedAt: null,
        slug: {
          in: [...FIXED_CATALOG_BRAND_SLUGS]
        }
      }
    });

    return brands
      .filter(
        (brand) => brand.deletedAt === null && isFixedCatalogBrandSlug(brand.slug)
      )
      .map((brand) => this.serializeBrand(brand));
  }

  async getPublicBrandBySlug(slug: string) {
    if (!isFixedCatalogBrandSlug(slug)) {
      throw new NotFoundException("Brand was not found.");
    }

    const brand = await this.prisma.brand.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        slug
      }
    });

    if (!brand) {
      throw new NotFoundException("Brand was not found.");
    }

    return this.serializeBrand(brand);
  }

  async createBrand(input: CreateBrandDto, context?: AdminActionContext) {
    try {
      const brand = await this.prisma.$transaction(async (tx) => {
        const createdBrand = await tx.brand.create({
          data: {
            description: input.description ?? null,
            isActive: input.isActive ?? true,
            logoUrl: input.logoUrl ?? null,
            name: input.name,
            slug: input.slug
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "brand.create",
          after: createdBrand,
          entityId: createdBrand.id,
          entityType: "Brand"
        });

        return createdBrand;
      });

      return this.serializeBrand(brand);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Brand slug already exists.");
      }

      throw error;
    }
  }

  async updateBrand(id: string, input: UpdateBrandDto, context?: AdminActionContext) {
    const existingBrand = await this.findExistingBrand(id);
    const data = this.buildUpdateData(input);

    try {
      const brand = await this.prisma.$transaction(async (tx) => {
        const updatedBrand = await tx.brand.update({
          data,
          where: {
            id
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "brand.update",
          after: updatedBrand,
          before: existingBrand,
          entityId: id,
          entityType: "Brand"
        });

        return updatedBrand;
      });

      return this.serializeBrand(brand);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Brand slug already exists.");
      }

      throw error;
    }
  }

  async deleteBrand(id: string, context?: AdminActionContext) {
    const existingBrand = await this.findExistingBrand(id);

    await this.prisma.$transaction(async (tx) => {
      const deletedBrand = await tx.brand.update({
        data: {
          deletedAt: new Date(),
          isActive: false
        },
        where: {
          id
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "brand.delete",
        after: deletedBrand,
        before: existingBrand,
        entityId: id,
        entityType: "Brand"
      });
    });
  }

  private async findExistingBrand(id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        deletedAt: null,
        id
      }
    });

    if (!brand) {
      throw new NotFoundException("Brand was not found.");
    }

    return brand;
  }

  private buildUpdateData(input: UpdateBrandDto) {
    const data: BrandUpdateData = {};

    if (hasOwn(input, "description")) {
      data.description = input.description ?? null;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (hasOwn(input, "logoUrl")) {
      data.logoUrl = input.logoUrl ?? null;
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.slug !== undefined) {
      data.slug = input.slug;
    }

    return data;
  }

  private serializeBrand(brand: BrandRecord) {
    return {
      description: brand.description,
      id: brand.id,
      isActive: brand.isActive,
      logoUrl: resolveStoredUploadUrl(brand.logoUrl),
      name: brand.name,
      slug: brand.slug
    };
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    context: AdminActionContext | undefined,
    input: {
      action: string;
      after?: unknown;
      before?: unknown;
      entityId?: string;
      entityType: string;
    }
  ) {
    if (!context) {
      return;
    }

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
}

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
