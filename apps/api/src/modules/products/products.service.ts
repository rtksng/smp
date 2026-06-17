import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { isUniqueConstraintError } from "../../common/prisma/prisma-errors";
import { PrismaService } from "../../database/prisma.service";
import {
  Prisma,
  ProductStatus,
  WarehouseStatus
} from "../../generated/prisma/client";
import { FIXED_CATALOG_BRAND_SLUGS } from "../brands/fixed-catalog-brands";
import { FIXED_ROOT_CATEGORY_SLUGS } from "../categories/fixed-catalog-taxonomy";
import type { CreateProductDto } from "./dto/create-product.dto";
import type {
  ProductDocumentInputDto,
  ProductImageInputDto,
  ProductVariantInputDto
} from "./dto/product-input.dto";
import type {
  AdminProductListQueryDto,
  ProductListQueryDto,
  ProductSortOption
} from "./dto/product-query.dto";
import { ProductSortOption as SortOption } from "./dto/product-query.dto";
import { sanitizeProductDescriptionHtml } from "./product-description-html";
import type { UpdateProductDto } from "./dto/update-product.dto";
import type { AdminActionContext } from "../warehouses/warehouses.service";

const PUBLIC_PRODUCT_STATUSES = [
  ProductStatus.ACTIVE,
  ProductStatus.OUT_OF_STOCK
] as const;
const DEFAULT_RECOMMENDATION_LIMIT = 4;
const MAX_RECOMMENDATION_LIMIT = 12;

const PRODUCT_INCLUDE = {
  brand: true,
  category: true,
  subcategory: true,
  documents: {
    orderBy: [{ type: "asc" as const }, { title: "asc" as const }]
  },
  images: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }]
  },
  inventoryStocks: {
    select: {
      availableQuantity: true,
      reservedQuantity: true
    },
    where: {
      warehouse: {
        deletedAt: null,
        status: WarehouseStatus.ACTIVE
      }
    }
  },
  variants: {
    orderBy: [{ name: "asc" as const }],
    where: {
      deletedAt: null
    }
  }
} as const satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;
type ProductVisibility = "admin" | "public";
type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };

function hasOwn<T extends object>(value: T, key: keyof T) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublicProducts(query: ProductListQueryDto) {
    return this.listProducts(query, "public");
  }

  async listAdminProducts(query: AdminProductListQueryDto) {
    return this.listProducts(query, "admin");
  }

  async getPublicProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      include: PRODUCT_INCLUDE,
      where: {
        deletedAt: null,
        OR: [{ slug }, { id: slug }],
        status: {
          in: [...PUBLIC_PRODUCT_STATUSES]
        }
      }
    });

    if (!product || !this.isPublicStatus(product.status)) {
      throw new NotFoundException("Product was not found.");
    }

    return this.serializeProduct(product);
  }

  async getPublicProductsByIds(ids: string[]) {
    if (ids.length === 0) {
      return {
        items: [],
        pagination: {
          hasNextPage: false,
          hasPreviousPage: false,
          limit: 0,
          page: 1,
          total: 0,
          totalPages: 0
        }
      };
    }

    const products = await this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      where: {
        deletedAt: null,
        id: {
          in: ids
        },
        status: {
          in: [...PUBLIC_PRODUCT_STATUSES]
        }
      }
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const items = ids
      .map((id) => productById.get(id))
      .filter((product): product is ProductRecord => Boolean(product))
      .map((product) => this.serializeProduct(product));

    return {
      items,
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: ids.length,
        page: 1,
        total: items.length,
        totalPages: items.length > 0 ? 1 : 0
      }
    };
  }

  async getSimilarProductsBySlug(
    slug: string,
    query: { limit?: number } = {}
  ) {
    const product = await this.findPublicProductBySlugOrId(slug);
    const limit = recommendationLimit(query.limit);
    const candidates = await this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit * 6,
      where: {
        deletedAt: null,
        id: {
          not: product.id
        },
        OR: [
          ...(product.subcategoryId ? [{ subcategoryId: product.subcategoryId }] : []),
          { categoryId: product.categoryId }
        ],
        status: {
          in: [...PUBLIC_PRODUCT_STATUSES]
        }
      }
    });

    const items = candidates
      .filter((candidate) => candidate.id !== product.id)
      .filter(
        (candidate) =>
          candidate.subcategoryId === product.subcategoryId ||
          candidate.categoryId === product.categoryId
      )
      .sort((left, right) => {
        const scoreDelta =
          scoreSimilarProduct(right, product) - scoreSimilarProduct(left, product);

        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, limit);

    return this.serializeRecommendationList(items, limit);
  }

  async getRelatedProductsBySlug(
    slug: string,
    query: { limit?: number } = {}
  ) {
    const product = await this.findPublicProductBySlugOrId(slug);
    const limit = recommendationLimit(query.limit);
    const searchTags = product.searchTags.slice(0, 12);
    const recommendationMatchers: Prisma.ProductWhereInput[] = [
      ...(searchTags.length > 0 ? [{ searchTags: { hasSome: searchTags } }] : []),
      ...(product.medicalSpecialty ? [{ medicalSpecialty: product.medicalSpecialty }] : []),
      { brandId: product.brandId },
      { categoryId: product.categoryId },
      ...(product.subcategoryId ? [{ subcategoryId: product.subcategoryId }] : []),
      ...(product.material ? [{ material: product.material }] : []),
      ...(product.packSize ? [{ packSize: product.packSize }] : []),
      { unit: product.unit },
      { sterile: product.sterile },
      { disposable: product.disposable },
      { expirySensitive: product.expirySensitive }
    ];
    const candidates = await this.prisma.product.findMany({
      include: PRODUCT_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit * 6,
      where: {
        deletedAt: null,
        id: {
          not: product.id
        },
        OR: recommendationMatchers,
        status: {
          in: [...PUBLIC_PRODUCT_STATUSES]
        }
      }
    });

    const items = candidates
      .filter((candidate) => candidate.id !== product.id)
      .map((candidate) => ({
        product: candidate,
        score: scoreRelatedProduct(candidate, product)
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => {
        const scoreDelta = right.score - left.score;

        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        return left.product.name.localeCompare(right.product.name);
      })
      .slice(0, limit)
      .map((candidate) => candidate.product);

    return this.serializeRecommendationList(items, limit);
  }

  async getAdminProductById(id: string) {
    const product = await this.prisma.product.findFirst({
      include: PRODUCT_INCLUDE,
      where: {
        deletedAt: null,
        id
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }

    return this.serializeProduct(product);
  }

  async createProduct(input: CreateProductDto, context?: AdminActionContext) {
    await this.assertBrandExists(input.brandId);
    await this.assertCategorySelection(input.categoryId, input.subcategoryId ?? null);
    this.assertPriceFields(input);
    this.assertVariantPrices(input.variants ?? []);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            basePrice: input.basePrice,
            brandId: input.brandId,
            categoryId: input.categoryId,
            description: sanitizeProductDescriptionHtml(input.description),
            disposable: input.disposable,
            documents: this.buildDocumentCreate(input.documents),
            expirySensitive: input.expirySensitive,
            images: this.buildImageCreate(input.images),
            material: input.material ?? null,
            medicalSpecialty: input.medicalSpecialty ?? null,
            metaDescription: input.metaDescription ?? null,
            metaTitle: input.metaTitle ?? null,
            mrp: input.mrp,
            name: input.name,
            packSize: input.packSize ?? null,
            searchTags: normalizeSearchTags(input.searchTags ?? []),
            sellingPrice: input.sellingPrice,
            shortDescription: input.shortDescription,
            sku: input.sku,
            slug: input.slug,
            status: input.status,
            sterile: input.sterile,
            subcategoryId: input.subcategoryId ?? null,
            taxRate: input.taxRate,
            unit: input.unit,
            variants: this.buildVariantCreate(input.variants)
          },
          include: PRODUCT_INCLUDE
        });

        await this.writeAuditLog(tx, context, {
          action: "product.create",
          after: createdProduct,
          entityId: createdProduct.id,
          entityType: "Product"
        });

        return createdProduct;
      });

      return this.serializeProduct(product);
    } catch (error: unknown) {
      this.handleProductWriteError(error);
    }
  }

  async updateProduct(
    id: string,
    input: UpdateProductDto,
    context?: AdminActionContext
  ) {
    const existingProduct = await this.findExistingProduct(id);

    if (input.brandId !== undefined) {
      await this.assertBrandExists(input.brandId);
    }

    if (input.categoryId !== undefined || hasOwn(input, "subcategoryId")) {
      await this.assertCategorySelection(
        input.categoryId ?? existingProduct.categoryId,
        hasOwn(input, "subcategoryId")
          ? (input.subcategoryId ?? null)
          : existingProduct.subcategoryId
      );
    }

    this.assertPriceFields({
      basePrice: input.basePrice ?? decimalToNumber(existingProduct.basePrice),
      mrp: input.mrp ?? decimalToNumber(existingProduct.mrp),
      sellingPrice: input.sellingPrice ?? decimalToNumber(existingProduct.sellingPrice)
    });
    this.assertVariantPrices(input.variants ?? []);

    const data = this.buildProductUpdateData(input);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        await this.replaceNestedCollections(tx, id, input);

        const updatedProduct = await tx.product.update({
          data,
          include: PRODUCT_INCLUDE,
          where: {
            id
          }
        });

        await this.writeAuditLog(tx, context, {
          action: "product.update",
          after: updatedProduct,
          before: existingProduct,
          entityId: id,
          entityType: "Product"
        });

        return updatedProduct;
      });

      return this.serializeProduct(product);
    } catch (error: unknown) {
      this.handleProductWriteError(error);
    }
  }

  async deleteProduct(id: string, context?: AdminActionContext) {
    const existingProduct = await this.findExistingProduct(id);
    const deletedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const deletedProduct = await tx.product.update({
        data: {
          deletedAt,
          status: ProductStatus.INACTIVE,
          variants: {
            updateMany: {
              data: {
                deletedAt,
                status: ProductStatus.INACTIVE
              },
              where: {
                deletedAt: null
              }
            }
          }
        },
        where: {
          id
        }
      });

      await this.writeAuditLog(tx, context, {
        action: "product.delete",
        after: deletedProduct,
        before: existingProduct,
        entityId: id,
        entityType: "Product"
      });
    });
  }

  private async listProducts(
    query: ProductListQueryDto | AdminProductListQueryDto,
    visibility: ProductVisibility
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildProductWhere(query, visibility);
    const orderBy = this.buildProductOrderBy(query.sort);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        include: PRODUCT_INCLUDE,
        orderBy,
        skip,
        take: limit,
        where
      }),
      this.prisma.product.count({
        where
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((product) => this.serializeProduct(product)),
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

  private buildProductWhere(
    query: ProductListQueryDto | AdminProductListQueryDto,
    visibility: ProductVisibility
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null
    };

    if (visibility === "public") {
      where.status = {
        in: [...PUBLIC_PRODUCT_STATUSES]
      };
    } else if ("status" in query && query.status !== undefined) {
      where.status = query.status;
    }

    if (query.brand !== undefined) {
      where.brand = {
        deletedAt: null,
        OR: [{ id: query.brand }, { slug: query.brand }]
      };
    }

    if (query.category !== undefined) {
      where.category = {
        deletedAt: null,
        OR: [{ id: query.category }, { slug: query.category }]
      };
    }

    if (query.subcategory !== undefined) {
      where.subcategory = {
        deletedAt: null,
        OR: [{ id: query.subcategory }, { slug: query.subcategory }]
      };
    }

    if (query.disposable !== undefined) {
      where.disposable = query.disposable;
    }

    if (query.expirySensitive !== undefined) {
      where.expirySensitive = query.expirySensitive;
    }

    if (query.inStock !== undefined) {
      where.inventoryStocks = query.inStock
        ? {
            some: {
              availableQuantity: {
                gt: 0
              },
              warehouse: {
                deletedAt: null,
                status: WarehouseStatus.ACTIVE
              }
            }
          }
        : {
            none: {
              availableQuantity: {
                gt: 0
              },
              warehouse: {
                deletedAt: null,
                status: WarehouseStatus.ACTIVE
              }
            }
          };
    }

    if (query.medicalSpecialty !== undefined) {
      where.medicalSpecialty = {
        contains: query.medicalSpecialty,
        mode: "insensitive"
      };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.sellingPrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {})
      };
    }

    if (query.search !== undefined && query.search.trim().length > 0) {
      const search = query.search.trim();

      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { medicalSpecialty: { contains: search, mode: "insensitive" } },
        { searchTags: { has: normalizeSearchTag(search) } },
        {
          brand: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } }
            ]
          }
        },
        {
          category: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } }
            ]
          }
        },
        {
          subcategory: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } }
            ]
          }
        }
      ];
    }

    if (query.sterile !== undefined) {
      where.sterile = query.sterile;
    }

    return where;
  }

  private buildProductOrderBy(
    sort: ProductSortOption | undefined
  ): Prisma.ProductOrderByWithRelationInput[] {
    switch (sort ?? SortOption.Latest) {
      case SortOption.NameAz:
        return [{ name: "asc" }, { id: "asc" }];
      case SortOption.PriceHighToLow:
        return [{ sellingPrice: "desc" }, { id: "asc" }];
      case SortOption.PriceLowToHigh:
        return [{ sellingPrice: "asc" }, { id: "asc" }];
      case SortOption.Latest:
      default:
        return [{ createdAt: "desc" }, { id: "asc" }];
    }
  }

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        deletedAt: null,
        id: brandId,
        slug: {
          in: [...FIXED_CATALOG_BRAND_SLUGS]
        }
      }
    });

    if (!brand) {
      throw new NotFoundException("Brand was not found.");
    }
  }

  private async assertCategorySelection(
    categoryId: string,
    subcategoryId: string | null
  ) {
    const category = await this.prisma.category.findFirst({
      where: {
        deletedAt: null,
        id: categoryId,
        parentId: null,
        slug: {
          in: [...FIXED_ROOT_CATEGORY_SLUGS]
        }
      }
    });

    if (!category) {
      throw new NotFoundException("Category was not found.");
    }

    if (subcategoryId) {
      const subcategory = await this.prisma.category.findFirst({
        where: {
          deletedAt: null,
          id: subcategoryId,
          parentId: categoryId
        }
      });

      if (!subcategory) {
        throw new NotFoundException(
          "Subcategory was not found for the selected category."
        );
      }

      return;
    }

    const subcategoryCount = await this.prisma.category.count({
      where: {
        deletedAt: null,
        isActive: true,
        parentId: categoryId
      }
    });

    if (subcategoryCount > 0) {
      throw new BadRequestException(
        "Subcategory is required for the selected category."
      );
    }
  }

  private async findExistingProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        id
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }

    return product;
  }

  private async findPublicProductBySlugOrId(slug: string) {
    const product = await this.prisma.product.findFirst({
      include: PRODUCT_INCLUDE,
      where: {
        deletedAt: null,
        OR: [{ slug }, { id: slug }],
        status: {
          in: [...PUBLIC_PRODUCT_STATUSES]
        }
      }
    });

    if (!product || !this.isPublicStatus(product.status)) {
      throw new NotFoundException("Product was not found.");
    }

    return product;
  }

  private buildProductUpdateData(input: UpdateProductDto) {
    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (input.basePrice !== undefined) {
      data.basePrice = input.basePrice;
    }
    if (input.brandId !== undefined) {
      data.brandId = input.brandId;
    }
    if (input.categoryId !== undefined) {
      data.categoryId = input.categoryId;
    }
    if (input.description !== undefined) {
      data.description = sanitizeProductDescriptionHtml(input.description);
    }
    if (input.disposable !== undefined) {
      data.disposable = input.disposable;
    }
    if (input.expirySensitive !== undefined) {
      data.expirySensitive = input.expirySensitive;
    }
    if (input.material !== undefined) {
      data.material = input.material ?? null;
    }
    if (input.medicalSpecialty !== undefined) {
      data.medicalSpecialty = input.medicalSpecialty ?? null;
    }
    if (input.metaDescription !== undefined) {
      data.metaDescription = input.metaDescription ?? null;
    }
    if (input.metaTitle !== undefined) {
      data.metaTitle = input.metaTitle ?? null;
    }
    if (input.mrp !== undefined) {
      data.mrp = input.mrp;
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.packSize !== undefined) {
      data.packSize = input.packSize ?? null;
    }
    if (input.searchTags !== undefined) {
      data.searchTags = normalizeSearchTags(input.searchTags);
    }
    if (input.sellingPrice !== undefined) {
      data.sellingPrice = input.sellingPrice;
    }
    if (input.shortDescription !== undefined) {
      data.shortDescription = input.shortDescription;
    }
    if (input.sku !== undefined) {
      data.sku = input.sku;
    }
    if (input.slug !== undefined) {
      data.slug = input.slug;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.sterile !== undefined) {
      data.sterile = input.sterile;
    }
    if (hasOwn(input, "subcategoryId")) {
      data.subcategoryId = input.subcategoryId ?? null;
    }
    if (input.taxRate !== undefined) {
      data.taxRate = input.taxRate;
    }
    if (input.unit !== undefined) {
      data.unit = input.unit;
    }
    return data;
  }

  private async replaceNestedCollections(
    tx: Prisma.TransactionClient,
    productId: string,
    input: UpdateProductDto
  ) {
    if (input.documents !== undefined) {
      await tx.productDocument.deleteMany({
        where: {
          productId
        }
      });

      const documents = this.mapDocuments(input.documents).map((document) => ({
        ...document,
        productId
      }));

      if (documents.length > 0) {
        await tx.productDocument.createMany({
          data: documents
        });
      }
    }

    if (input.images !== undefined) {
      await tx.productImage.deleteMany({
        where: {
          productId
        }
      });

      const images = this.mapImages(input.images).map((image) => ({
        ...image,
        productId
      }));

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images
        });
      }
    }

    if (input.variants !== undefined) {
      await tx.productVariant.deleteMany({
        where: {
          productId
        }
      });

      const variants = this.mapVariants(input.variants).map((variant) => ({
        ...variant,
        productId
      }));

      if (variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants
        });
      }
    }
  }

  private buildImageCreate(images: ProductImageInputDto[] | undefined) {
    return images === undefined
      ? undefined
      : {
          create: this.mapImages(images)
        };
  }

  private buildVariantCreate(variants: ProductVariantInputDto[] | undefined) {
    return variants === undefined
      ? undefined
      : {
          create: this.mapVariants(variants)
        };
  }

  private buildDocumentCreate(documents: ProductDocumentInputDto[] | undefined) {
    return documents === undefined
      ? undefined
      : {
          create: this.mapDocuments(documents)
        };
  }

  private mapImages(images: ProductImageInputDto[]) {
    return images.map((image) => ({
      altText: image.altText ?? null,
      isPrimary: image.isPrimary ?? false,
      sortOrder: image.sortOrder ?? 0,
      url: image.url
    }));
  }

  private mapVariants(variants: ProductVariantInputDto[]) {
    return variants.map((variant) => ({
      attributes: variant.attributes,
      mrp: variant.mrp,
      name: variant.name,
      sellingPrice: variant.sellingPrice,
      sku: variant.sku,
      status: variant.status ?? ProductStatus.ACTIVE
    }));
  }

  private mapDocuments(documents: ProductDocumentInputDto[]) {
    return documents.map((document) => ({
      fileKey: document.fileKey,
      fileUrl: document.fileUrl,
      title: document.title,
      type: document.type
    }));
  }

  private assertPriceFields(input: {
    basePrice: number;
    mrp: number;
    sellingPrice: number;
  }) {
    if (input.basePrice > input.mrp) {
      throw new BadRequestException("Base price cannot be greater than MRP.");
    }

    if (input.sellingPrice > input.mrp) {
      throw new BadRequestException("Selling price cannot be greater than MRP.");
    }
  }

  private assertVariantPrices(variants: ProductVariantInputDto[]) {
    for (const variant of variants) {
      if (variant.sellingPrice > variant.mrp) {
        throw new BadRequestException(
          "Variant selling price cannot be greater than variant MRP."
        );
      }
    }
  }

  private isPublicStatus(status: ProductStatus) {
    return (PUBLIC_PRODUCT_STATUSES as readonly ProductStatus[]).includes(status);
  }

  private serializeProduct(product: ProductRecord) {
    return {
      basePrice: decimalToNumber(product.basePrice),
      brand: {
        id: product.brand.id,
        name: product.brand.name,
        slug: product.brand.slug
      },
      brandId: product.brandId,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug
      },
      categoryId: product.categoryId,
      subcategory: product.subcategory
        ? {
            id: product.subcategory.id,
            name: product.subcategory.name,
            slug: product.subcategory.slug
          }
        : null,
      subcategoryId: product.subcategoryId,
      createdAt: product.createdAt,
      description: product.description,
      disposable: product.disposable,
      documents: product.documents.map((document) => ({
        fileKey: document.fileKey,
        fileUrl: document.fileUrl,
        id: document.id,
        title: document.title,
        type: document.type
      })),
      expirySensitive: product.expirySensitive,
      id: product.id,
      images: product.images.map((image) => ({
        altText: image.altText,
        id: image.id,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        url: image.url
      })),
      inStock: this.productHasAvailableStock(product),
      material: product.material,
      medicalSpecialty: product.medicalSpecialty,
      metaDescription: product.metaDescription,
      metaTitle: product.metaTitle,
      mrp: decimalToNumber(product.mrp),
      name: product.name,
      packSize: product.packSize,
      searchTags: product.searchTags,
      sellingPrice: decimalToNumber(product.sellingPrice),
      shortDescription: product.shortDescription,
      sku: product.sku,
      slug: product.slug,
      status: product.status,
      sterile: product.sterile,
      taxRate: decimalToNumber(product.taxRate),
      unit: product.unit,
      updatedAt: product.updatedAt,
      variants: product.variants.map((variant) => ({
        attributes: variant.attributes,
        id: variant.id,
        mrp: decimalToNumber(variant.mrp),
        name: variant.name,
        sellingPrice: decimalToNumber(variant.sellingPrice),
        sku: variant.sku,
        status: variant.status
      }))
    };
  }

  private serializeRecommendationList(products: ProductRecord[], limit: number) {
    return {
      items: products.map((product) => this.serializeProduct(product)),
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit,
        page: 1,
        total: products.length,
        totalPages: products.length > 0 ? 1 : 0
      }
    };
  }

  private productHasAvailableStock(product: ProductRecord) {
    return (
      product.status !== ProductStatus.OUT_OF_STOCK &&
      product.inventoryStocks.some((stock) => stock.availableQuantity > 0)
    );
  }

  private handleProductWriteError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
      throw new ConflictException("Product slug or SKU already exists.");
    }

    throw error;
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

function normalizeSearchTags(searchTags: string[]) {
  const normalizedTags = new Set<string>();

  for (const searchTag of searchTags) {
    const normalizedTag = normalizeSearchTag(searchTag);

    if (normalizedTag.length > 0) {
      normalizedTags.add(normalizedTag);
    }
  }

  return [...normalizedTags];
}

function recommendationLimit(limit: number | undefined) {
  return Math.min(
    Math.max(limit ?? DEFAULT_RECOMMENDATION_LIMIT, 1),
    MAX_RECOMMENDATION_LIMIT
  );
}

function scoreSimilarProduct(candidate: ProductRecord, source: ProductRecord) {
  let score = 0;

  if (candidate.subcategoryId && candidate.subcategoryId === source.subcategoryId) {
    score += 6;
  }
  if (candidate.categoryId === source.categoryId) {
    score += 3;
  }
  if (
    candidate.medicalSpecialty &&
    source.medicalSpecialty &&
    candidate.medicalSpecialty === source.medicalSpecialty
  ) {
    score += 1;
  }

  return score;
}

function scoreRelatedProduct(candidate: ProductRecord, source: ProductRecord) {
  const sourceTags = new Set(source.searchTags.map(normalizeSearchTag));
  const tagOverlap = candidate.searchTags
    .map(normalizeSearchTag)
    .filter((tag) => sourceTags.has(tag)).length;
  let score = tagOverlap * 10;

  if (
    candidate.medicalSpecialty &&
    source.medicalSpecialty &&
    candidate.medicalSpecialty === source.medicalSpecialty
  ) {
    score += 5;
  }
  if (candidate.subcategoryId && candidate.subcategoryId === source.subcategoryId) {
    score += 4;
  }
  if (candidate.brandId === source.brandId) {
    score += 3;
  }
  if (candidate.categoryId === source.categoryId) {
    score += 2;
  }
  if (candidate.material && source.material && candidate.material === source.material) {
    score += 2;
  }
  if (candidate.packSize && source.packSize && candidate.packSize === source.packSize) {
    score += 1;
  }
  if (candidate.unit === source.unit) {
    score += 1;
  }
  if (candidate.sterile === source.sterile) {
    score += 1;
  }
  if (candidate.disposable === source.disposable) {
    score += 1;
  }
  if (candidate.expirySensitive === source.expirySensitive) {
    score += 1;
  }

  return score;
}

function normalizeSearchTag(searchTag: string) {
  return searchTag.trim().replace(/\s+/g, " ").toLowerCase();
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

function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
