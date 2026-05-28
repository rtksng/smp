import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, ProductStatus } from "../../generated/prisma/client";
import type { AddCartItemDto, UpdateCartItemDto } from "./dto/cart.dto";

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          images: {
            orderBy: [
              { isPrimary: "desc" as const },
              { sortOrder: "asc" as const },
              { createdAt: "asc" as const }
            ]
          }
        }
      },
      variant: true
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} as const satisfies Prisma.CartInclude;

type CartRecord = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;
type CartItemRecord = CartRecord["items"][number];
type CartClient =
  | Pick<
      Prisma.TransactionClient,
      "cart" | "cartItem" | "inventoryStock" | "product" | "productVariant" | "user"
    >
  | PrismaService;
type DecimalValue = number | string | { toNumber?: () => number; toString: () => string };

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(customerId: string) {
    await this.assertActiveCustomer(customerId);

    return this.serializeCart(await this.getCartSnapshot(customerId));
  }

  async addItem(customerId: string, input: AddCartItemDto) {
    await this.assertActiveCustomer(customerId);
    const variantId = input.variantId ?? null;

    return this.prisma.$transaction(async (tx) => {
      const cart = await this.getOrCreateCart(customerId, tx);
      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: input.productId,
          variantId
        }
      });
      const nextQuantity = (existingItem?.quantity ?? 0) + input.quantity;

      await this.assertSellableStock(tx, input.productId, variantId, nextQuantity);

      if (existingItem) {
        await tx.cartItem.update({
          data: {
            quantity: nextQuantity
          },
          where: {
            id: existingItem.id
          }
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: input.productId,
            quantity: input.quantity,
            variantId
          }
        });
      }

      return this.serializeCart(await this.getCartSnapshot(customerId, tx), tx);
    });
  }

  async updateItem(
    customerId: string,
    itemId: string,
    input: UpdateCartItemDto
  ) {
    await this.assertActiveCustomer(customerId);

    return this.prisma.$transaction(async (tx) => {
      const item = await this.findOwnedCartItem(tx, customerId, itemId);

      await this.assertSellableStock(
        tx,
        item.productId,
        item.variantId,
        input.quantity
      );
      await tx.cartItem.update({
        data: {
          quantity: input.quantity
        },
        where: {
          id: itemId
        }
      });

      return this.serializeCart(await this.getCartSnapshot(customerId, tx), tx);
    });
  }

  async removeItem(customerId: string, itemId: string) {
    await this.assertActiveCustomer(customerId);

    return this.prisma.$transaction(async (tx) => {
      await this.findOwnedCartItem(tx, customerId, itemId);
      await tx.cartItem.delete({
        where: {
          id: itemId
        }
      });

      return this.serializeCart(await this.getCartSnapshot(customerId, tx), tx);
    });
  }

  async clearCart(customerId: string) {
    await this.assertActiveCustomer(customerId);

    return this.prisma.$transaction(async (tx) => {
      const cart = await this.getOrCreateCart(customerId, tx);

      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id
        }
      });

      return this.serializeCart(await this.getCartSnapshot(customerId, tx), tx);
    });
  }

  private async assertActiveCustomer(customerId: string) {
    const customer = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: customerId,
        isActive: true
      }
    });

    if (!customer) {
      throw new UnauthorizedException("Customer account is inactive.");
    }
  }

  private async getOrCreateCart(customerId: string, client: CartClient) {
    const existingCart = await client.cart.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        userId: customerId
      }
    });

    if (existingCart) {
      return existingCart;
    }

    return client.cart.create({
      data: {
        userId: customerId
      }
    });
  }

  private async getCartSnapshot(customerId: string, client: CartClient = this.prisma) {
    const cart = await this.getOrCreateCart(customerId, client);
    const snapshot = await client.cart.findFirst({
      include: CART_INCLUDE,
      where: {
        deletedAt: null,
        id: cart.id,
        userId: customerId
      }
    });

    if (!snapshot) {
      throw new NotFoundException("Cart was not found.");
    }

    return snapshot;
  }

  private async findOwnedCartItem(
    client: CartClient,
    customerId: string,
    itemId: string
  ) {
    const item = await client.cartItem.findFirst({
      where: {
        cart: {
          deletedAt: null,
          userId: customerId
        },
        id: itemId
      }
    });

    if (!item) {
      throw new NotFoundException("Cart item was not found.");
    }

    return item;
  }

  private async assertSellableStock(
    client: CartClient,
    productId: string,
    variantId: string | null,
    quantity: number
  ) {
    const product = await client.product.findFirst({
      where: {
        deletedAt: null,
        id: productId
      }
    });

    if (!product) {
      throw new NotFoundException("Product was not found.");
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException("Product is not available for cart.");
    }

    if (variantId !== null) {
      const variant = await client.productVariant.findFirst({
        where: {
          deletedAt: null,
          id: variantId,
          productId
        }
      });

      if (!variant) {
        throw new NotFoundException("Product variant was not found.");
      }

      if (variant.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException("Product variant is not available for cart.");
      }
    }

    const availableQuantity = await this.getAvailableQuantity(
      client,
      productId,
      variantId
    );

    if (availableQuantity < quantity) {
      throw new BadRequestException("Requested quantity exceeds available stock.");
    }
  }

  private async serializeCart(cart: CartRecord, client: CartClient = this.prisma) {
    const items = await Promise.all(
      cart.items.map((item) => this.serializeCartItem(item, client))
    );
    const subtotal = roundMoney(
      items.reduce((sum, item) => sum + item.subtotal, 0)
    );
    const tax = roundMoney(items.reduce((sum, item) => sum + item.tax, 0));
    const discount = 0;
    const deliveryCharge = 0;

    return {
      id: cart.id,
      itemCount: items.length,
      items,
      totals: {
        deliveryCharge,
        discount,
        grandTotal: roundMoney(subtotal + tax + deliveryCharge - discount),
        subtotal,
        tax
      },
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      updatedAt: cart.updatedAt
    };
  }

  private async serializeCartItem(item: CartItemRecord, client: CartClient) {
    const availableQuantity = await this.getAvailableQuantity(
      client,
      item.productId,
      item.variantId
    );
    const productImage = getPrimaryImage(item.product.images);
    const unitPrice = decimalToNumber(
      item.variant?.sellingPrice ?? item.product.sellingPrice
    );
    const taxRate = decimalToNumber(item.product.taxRate);
    const subtotal = roundMoney(unitPrice * item.quantity);
    const tax = roundMoney(subtotal * (taxRate / 100));
    const variantIsAvailable =
      item.variantId === null ||
      (item.variant !== null &&
        item.variant.deletedAt === null &&
        item.variant.status === ProductStatus.ACTIVE);

    return {
      availableQuantity,
      createdAt: item.createdAt,
      id: item.id,
      imageUrl: productImage?.url ?? null,
      isAvailable:
        item.product.deletedAt === null &&
        item.product.status === ProductStatus.ACTIVE &&
        variantIsAvailable &&
        availableQuantity >= item.quantity,
      name: item.product.name,
      productId: item.productId,
      productStatus: item.product.status,
      quantity: item.quantity,
      sku: item.variant?.sku ?? item.product.sku,
      slug: item.product.slug,
      subtotal,
      tax,
      taxRate,
      total: roundMoney(subtotal + tax),
      unitPrice,
      updatedAt: item.updatedAt,
      variantId: item.variantId,
      variantName: item.variant?.name ?? null,
      variantStatus: item.variant?.status ?? null
    };
  }

  private async getAvailableQuantity(
    client: CartClient,
    productId: string,
    variantId: string | null
  ) {
    const stock = await client.inventoryStock.aggregate({
      _sum: {
        availableQuantity: true
      },
      where: {
        productId,
        variantId
      }
    });

    return stock._sum.availableQuantity ?? 0;
  }
}

function getPrimaryImage(images: CartItemRecord["product"]["images"]) {
  return images.find((image) => image.isPrimary) ?? images[0] ?? null;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
