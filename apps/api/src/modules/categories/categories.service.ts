import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type { AdminActionContext } from "../warehouses/warehouses.service";
import { resolveStoredUploadUrl } from "../uploads/upload-url";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

type CategoryRecord = {
  deletedAt: Date | null;
  description: string | null;
  id: string;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  parentId: string | null;
  slug: string;
  sortOrder: number;
};

type CategoryResponse = Omit<CategoryRecord, "deletedAt"> & {
  children: CategoryResponse[];
};

type CategoryUpdateData = {
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  name?: string;
  parentId?: string | null;
  slug?: string;
  sortOrder?: number;
};

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: {
        deletedAt: null,
        isActive: true
      }
    });

    return this.buildCategoryTree(categories).roots;
  }

  async listAdminCategories() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: {
        deletedAt: null
      }
    });

    return this.buildCategoryTree(categories, { includeInactive: true }).roots;
  }

  async getPublicCategoryBySlug(slug: string) {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: {
        deletedAt: null,
        isActive: true
      }
    });
    const category = this.findCategoryBySlug(
      this.buildCategoryTree(categories).roots,
      slug
    );

    if (!category) {
      throw new NotFoundException("Category was not found.");
    }

    return category;
  }

  private findCategoryBySlug(
    categories: CategoryResponse[],
    slug: string
  ): CategoryResponse | null {
    for (const category of categories) {
      if (category.slug === slug) {
        return category;
      }

      const childMatch = this.findCategoryBySlug(category.children, slug);

      if (childMatch) {
        return childMatch;
      }
    }

    return null;
  }

  async createCategory(input: CreateCategoryDto, context?: AdminActionContext) {
    if (input.parentId) {
      await this.assertParentExists(input.parentId);
    }

    try {
      const category = await this.prisma.$transaction(async (tx) => {
        const createdCategory = await tx.category.create({
          data: {
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            isActive: input.isActive ?? true,
            name: input.name,
            parentId: input.parentId ?? null,
            slug: input.slug,
            sortOrder: input.sortOrder ?? 0
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "category.create",
          after: createdCategory,
          entityId: createdCategory.id,
          entityType: "Category"
        });

        return createdCategory;
      });

      return this.serializeCategory(category);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Category slug already exists.");
      }

      throw error;
    }
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryDto,
    context?: AdminActionContext
  ) {
    const existingCategory = await this.findExistingCategory(id);

    if (hasOwn(input, "parentId")) {
      await this.assertValidParentUpdate(id, input.parentId ?? null);
    }

    const data = this.buildUpdateData(input);

    try {
      const category = await this.prisma.$transaction(async (tx) => {
        const updatedCategory = await tx.category.update({
          data,
          where: {
            id
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "category.update",
          after: updatedCategory,
          before: existingCategory,
          entityId: id,
          entityType: "Category"
        });

        return updatedCategory;
      });

      return this.serializeCategory(category);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException("Category slug already exists.");
      }

      throw error;
    }
  }

  async deleteCategory(id: string, context?: AdminActionContext) {
    await this.findExistingCategory(id);
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: {
        deletedAt: null
      }
    });
    const categoryIds = this.findDescendantIds(id, categories);
    const linkedProductCount = await this.prisma.product.count({
      where: {
        deletedAt: null,
        OR: [
          {
            categoryId: {
              in: categoryIds
            }
          },
          {
            subcategoryId: {
              in: categoryIds
            }
          }
        ]
      }
    });

    if (linkedProductCount > 0) {
      throw new ConflictException(
        "Reassign or delete linked products before deleting this category."
      );
    }

    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        data: {
          deletedAt,
          isActive: false
        },
        where: {
          id: {
            in: categoryIds
          }
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "category.delete",
        after: {
          deletedAt,
          deletedCategoryIds: categoryIds
        },
        before: {
          categoryIds
        },
        entityId: id,
        entityType: "Category"
      });
    });
  }

  private async assertParentExists(parentId: string) {
    const parent = await this.prisma.category.findFirst({
      where: {
        deletedAt: null,
        id: parentId
      }
    });

    if (!parent) {
      throw new NotFoundException("Parent category was not found.");
    }
  }

  private async assertValidParentUpdate(id: string, parentId: string | null) {
    if (!parentId) {
      return;
    }

    if (parentId === id) {
      throw new BadRequestException("A category cannot be its own parent.");
    }

    await this.assertParentExists(parentId);

    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: {
        deletedAt: null
      }
    });
    const descendantIds = this.findDescendantIds(id, categories);

    if (descendantIds.includes(parentId)) {
      throw new BadRequestException(
        "A category cannot be assigned to one of its descendants."
      );
    }
  }

  private async findExistingCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        deletedAt: null,
        id
      }
    });

    if (!category) {
      throw new NotFoundException("Category was not found.");
    }

    return category;
  }

  private buildUpdateData(input: UpdateCategoryDto) {
    const data: CategoryUpdateData = {};

    if (hasOwn(input, "description")) {
      data.description = input.description ?? null;
    }
    if (hasOwn(input, "imageUrl")) {
      data.imageUrl = input.imageUrl ?? null;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (hasOwn(input, "parentId")) {
      data.parentId = input.parentId ?? null;
    }
    if (input.slug !== undefined) {
      data.slug = input.slug;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }

    return data;
  }

  private buildCategoryTree(
    categories: CategoryRecord[],
    options: { includeInactive?: boolean } = {}
  ) {
    const visibleCategories = [...categories]
      .filter(
        (category) =>
          category.deletedAt === null &&
          (options.includeInactive || category.isActive)
      )
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
      );
    const byId = new Map<string, CategoryResponse>();
    const roots: CategoryResponse[] = [];

    for (const category of visibleCategories) {
      byId.set(category.id, this.serializeCategory(category));
    }

    for (const category of visibleCategories) {
      const serialized = byId.get(category.id);

      if (!serialized) {
        continue;
      }

      const parent = category.parentId ? byId.get(category.parentId) : undefined;

      if (parent) {
        parent.children.push(serialized);
      } else if (category.parentId === null) {
        roots.push(serialized);
      }
    }

    return { byId, roots };
  }

  private findDescendantIds(id: string, categories: CategoryRecord[]) {
    const categoriesByParentId = new Map<string, CategoryRecord[]>();

    for (const category of categories) {
      if (!category.parentId || category.deletedAt !== null) {
        continue;
      }

      const siblings = categoriesByParentId.get(category.parentId) ?? [];
      siblings.push(category);
      categoriesByParentId.set(category.parentId, siblings);
    }

    const ids = [id];
    const visit = (categoryId: string) => {
      for (const child of categoriesByParentId.get(categoryId) ?? []) {
        ids.push(child.id);
        visit(child.id);
      }
    };

    visit(id);

    return ids;
  }

  private serializeCategory(category: CategoryRecord): CategoryResponse {
    return {
      children: [],
      description: category.description,
      id: category.id,
      imageUrl: resolveStoredUploadUrl(category.imageUrl),
      isActive: category.isActive,
      name: category.name,
      parentId: category.parentId,
      slug: category.slug,
      sortOrder: category.sortOrder
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
