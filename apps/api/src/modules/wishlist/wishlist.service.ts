import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ProductStatus } from "../../generated/prisma/client";
import { ProductsService } from "../products/products.service";

const WISHLIST_TEMPLATE_KEY = "wishlist_item";
const WISHLIST_CHANNEL = "customer";
const WISHLIST_ACTIVE_STATUS = "ACTIVE";
const WISHLIST_REMOVED_STATUS = "REMOVED";

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService
  ) {}

  async listWishlist(customerId: string) {
    const productIds = await this.getWishlistProductIds(customerId);

    return this.productsService.getPublicProductsByIds(productIds);
  }

  async addWishlistItem(customerId: string, productId: string) {
    await this.assertPublicProductExists(productId);
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        channel: WISHLIST_CHANNEL,
        recipient: productId,
        templateKey: WISHLIST_TEMPLATE_KEY,
        userId: customerId
      }
    });

    if (existing) {
      await this.prisma.notificationLog.update({
        data: {
          status: WISHLIST_ACTIVE_STATUS
        },
        where: {
          id: existing.id
        }
      });
    } else {
      await this.prisma.notificationLog.create({
        data: {
          channel: WISHLIST_CHANNEL,
          recipient: productId,
          status: WISHLIST_ACTIVE_STATUS,
          templateKey: WISHLIST_TEMPLATE_KEY,
          userId: customerId
        }
      });
    }

    return this.listWishlist(customerId);
  }

  async removeWishlistItem(customerId: string, productId: string) {
    await this.prisma.notificationLog.updateMany({
      data: {
        status: WISHLIST_REMOVED_STATUS
      },
      where: {
        channel: WISHLIST_CHANNEL,
        recipient: productId,
        status: WISHLIST_ACTIVE_STATUS,
        templateKey: WISHLIST_TEMPLATE_KEY,
        userId: customerId
      }
    });

    return this.listWishlist(customerId);
  }

  private async getWishlistProductIds(customerId: string) {
    const items = await this.prisma.notificationLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: {
        channel: WISHLIST_CHANNEL,
        status: WISHLIST_ACTIVE_STATUS,
        templateKey: WISHLIST_TEMPLATE_KEY,
        userId: customerId
      }
    });

    return items.map((item) => item.recipient);
  }

  private async assertPublicProductExists(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        deletedAt: null,
        id: productId,
        status: {
          in: [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK]
        }
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }
  }
}
