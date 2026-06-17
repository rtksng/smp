import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { PrismaService } from "../../src/database/prisma.service";
import { CustomerJwtGuard } from "../../src/modules/auth/guards/customer-jwt.guard";
import { CartController } from "../../src/modules/cart/cart.controller";
import { CartService } from "../../src/modules/cart/cart.service";

type ProductStatusFixture = "DRAFT" | "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";

type UserFixture = {
  deletedAt: Date | null;
  id: string;
  isActive: boolean;
};

type ProductFixture = {
  brand: ProductReferenceFixture;
  category: ProductReferenceFixture;
  deletedAt: Date | null;
  id: string;
  images: ProductImageFixture[];
  name: string;
  sellingPrice: string;
  sku: string;
  slug: string;
  status: ProductStatusFixture;
  subcategory: ProductReferenceFixture | null;
  taxRate: string;
};

type ProductReferenceFixture = {
  id: string;
  name: string;
  slug: string;
};

type ProductImageFixture = {
  altText: string | null;
  id: string;
  isPrimary: boolean;
  sortOrder: number;
  url: string;
};

type ProductVariantFixture = {
  deletedAt: Date | null;
  id: string;
  name: string;
  productId: string;
  sellingPrice: string;
  sku: string;
  status: ProductStatusFixture;
};

type InventoryStockFixture = {
  availableQuantity: number;
  productId: string;
  variantId: string | null;
};

type AddressFixture = {
  deletedAt: Date | null;
  id: string;
  isDefault: boolean;
  pincode: string;
  userId: string;
};

type CartFixture = {
  createdAt: Date;
  deletedAt: Date | null;
  id: string;
  updatedAt: Date;
  userId: string;
};

type CartItemFixture = {
  cartId: string;
  createdAt: Date;
  id: string;
  productId: string;
  quantity: number;
  updatedAt: Date;
  variantId: string | null;
};

type CartPrismaMock = PrismaService & {
  calls: {
    addressFindFirst: unknown[];
    cartCreate: unknown[];
    cartFindFirst: unknown[];
    cartItemCreate: unknown[];
    cartItemDelete: unknown[];
    cartItemDeleteMany: unknown[];
    cartItemFindFirst: unknown[];
    cartItemUpdate: unknown[];
    inventoryStockAggregate: unknown[];
    productFindFirst: unknown[];
    productVariantFindFirst: unknown[];
    userFindFirst: unknown[];
  };
};

const now = new Date("2026-05-25T10:00:00.000Z");

function userFixture(input: Partial<UserFixture> = {}): UserFixture {
  return {
    deletedAt: null,
    id: "customer-1",
    isActive: true,
    ...input
  };
}

function productFixture(input: Partial<ProductFixture> = {}): ProductFixture {
  return {
    brand: {
      id: "brand-1",
      name: "SurgiPro",
      slug: "surgipro"
    },
    category: {
      id: "category-1",
      name: "Surgical Instruments",
      slug: "surgical-instruments"
    },
    deletedAt: null,
    id: "product-1",
    images: [
      {
        altText: "Curved artery forceps",
        id: "image-1",
        isPrimary: true,
        sortOrder: 0,
        url: "https://cdn.example.com/products/forceps/main.jpg"
      }
    ],
    name: "Curved Artery Forceps",
    sellingPrice: "120.00",
    sku: "FORCEPS-001",
    slug: "curved-artery-forceps",
    status: "ACTIVE",
    subcategory: {
      id: "subcategory-1",
      name: "Forceps",
      slug: "forceps"
    },
    taxRate: "18.00",
    ...input
  };
}

function variantFixture(
  input: Partial<ProductVariantFixture> = {}
): ProductVariantFixture {
  return {
    deletedAt: null,
    id: "variant-1",
    name: "6 inch",
    productId: "product-1",
    sellingPrice: "140.00",
    sku: "FORCEPS-001-6IN",
    status: "ACTIVE",
    ...input
  };
}

function cartFixture(input: Partial<CartFixture> = {}): CartFixture {
  return {
    createdAt: now,
    deletedAt: null,
    id: "cart-1",
    updatedAt: now,
    userId: "customer-1",
    ...input
  };
}

function cartItemFixture(input: Partial<CartItemFixture> = {}): CartItemFixture {
  return {
    cartId: "cart-1",
    createdAt: now,
    id: "cart-item-1",
    productId: "product-1",
    quantity: 2,
    updatedAt: now,
    variantId: null,
    ...input
  };
}

function stockFixture(
  input: Partial<InventoryStockFixture> = {}
): InventoryStockFixture {
  return {
    availableQuantity: 10,
    productId: "product-1",
    variantId: null,
    ...input
  };
}

function addressFixture(input: Partial<AddressFixture> = {}): AddressFixture {
  return {
    deletedAt: null,
    id: "address-1",
    isDefault: true,
    pincode: "110001",
    userId: "customer-1",
    ...input
  };
}

class FakeDeliveryChargesService {
  readonly calls: unknown[] = [];

  constructor(private readonly deliveryCharge = 75) {}

  async calculateDeliveryCharge(input: unknown) {
    this.calls.push(input);

    return {
      deliveryCharge: this.deliveryCharge,
      rule: {
        id: "rule-1",
        name: "Delhi delivery"
      }
    };
  }
}

function createCartPrismaMock(input?: {
  cart?: CartFixture;
  items?: CartItemFixture[];
  products?: ProductFixture[];
  stocks?: InventoryStockFixture[];
  user?: UserFixture | null;
  variants?: ProductVariantFixture[];
  addresses?: AddressFixture[];
}): CartPrismaMock {
  const carts = [input?.cart ?? cartFixture()];
  const items = [...(input?.items ?? [])];
  const products = input?.products ?? [productFixture()];
  const variants = input?.variants ?? [variantFixture()];
  const stocks = input?.stocks ?? [stockFixture()];
  const addresses = input?.addresses ?? [addressFixture()];
  const calls: CartPrismaMock["calls"] = {
    addressFindFirst: [],
    cartCreate: [],
    cartFindFirst: [],
    cartItemCreate: [],
    cartItemDelete: [],
    cartItemDeleteMany: [],
    cartItemFindFirst: [],
    cartItemUpdate: [],
    inventoryStockAggregate: [],
    productFindFirst: [],
    productVariantFindFirst: [],
    userFindFirst: []
  };

  const prisma = {
    calls,
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    address: {
      findFirst: async (args: { where?: { id?: string; userId?: string } }) => {
        calls.addressFindFirst.push(args);

        return (
          addresses.find(
            (address) =>
              (args.where?.id === undefined || address.id === args.where.id) &&
              (args.where?.userId === undefined ||
                address.userId === args.where.userId) &&
              address.deletedAt === null
          ) ?? null
        );
      }
    },
    cart: {
      create: async (args: { data: { userId: string } }) => {
        calls.cartCreate.push(args);
        const cart = cartFixture({
          id: "created-cart",
          userId: args.data.userId
        });
        carts.push(cart);

        return cart;
      },
      findFirst: async (args: { include?: unknown; where?: Record<string, unknown> }) => {
        calls.cartFindFirst.push(args);
        const cart =
          carts.find((record) => {
            const idMatches = args.where?.id === undefined || record.id === args.where.id;
            const userMatches =
              args.where?.userId === undefined || record.userId === args.where.userId;
            const deletedMatches =
              args.where?.deletedAt === undefined ||
              record.deletedAt === args.where.deletedAt;

            return idMatches && userMatches && deletedMatches;
          }) ?? null;

        if (!cart || !args.include) {
          return cart;
        }

        return {
          ...cart,
          items: items
            .filter((item) => item.cartId === cart.id)
            .map((item) => ({
              ...item,
              product: products.find((product) => product.id === item.productId),
              variant:
                item.variantId === null
                  ? null
                  : variants.find((variant) => variant.id === item.variantId)
            }))
        };
      }
    },
    cartItem: {
      create: async (args: { data: CartItemFixture }) => {
        calls.cartItemCreate.push(args);
        const item = cartItemFixture({
          ...args.data,
          id: "created-cart-item",
          updatedAt: now
        });
        items.push(item);

        return item;
      },
      delete: async (args: { where: { id: string } }) => {
        calls.cartItemDelete.push(args);
        const index = items.findIndex((item) => item.id === args.where.id);
        const [item] = items.splice(index, 1);

        return item;
      },
      deleteMany: async (args: { where: { cartId: string } }) => {
        calls.cartItemDeleteMany.push(args);
        const before = items.length;

        for (let index = items.length - 1; index >= 0; index -= 1) {
          if (items[index]?.cartId === args.where.cartId) {
            items.splice(index, 1);
          }
        }

        return { count: before - items.length };
      },
      findFirst: async (args: { where?: Record<string, unknown> }) => {
        calls.cartItemFindFirst.push(args);
        const where = args.where ?? {};

        return (
          items.find((item) => {
            const idMatches = where.id === undefined || item.id === where.id;
            const cartIdMatches =
              where.cartId === undefined || item.cartId === where.cartId;
            const productMatches =
              where.productId === undefined || item.productId === where.productId;
            const variantMatches =
              where.variantId === undefined || item.variantId === where.variantId;
            const cartWhere = where.cart as { deletedAt?: null; userId?: string } | undefined;
            const ownerMatches =
              cartWhere === undefined ||
              carts.some(
                (cart) =>
                  cart.id === item.cartId &&
                  (cartWhere.userId === undefined || cart.userId === cartWhere.userId) &&
                  (cartWhere.deletedAt === undefined ||
                    cart.deletedAt === cartWhere.deletedAt)
              );

            return (
              idMatches &&
              cartIdMatches &&
              productMatches &&
              variantMatches &&
              ownerMatches
            );
          }) ?? null
        );
      },
      update: async (args: { data: Partial<CartItemFixture>; where: { id: string } }) => {
        calls.cartItemUpdate.push(args);
        const index = items.findIndex((item) => item.id === args.where.id);

        items[index] = cartItemFixture({
          ...items[index],
          ...args.data,
          updatedAt: now
        });

        return items[index];
      }
    },
    inventoryStock: {
      aggregate: async (args: {
        where?: { productId?: string; variantId?: string | null };
      }) => {
        calls.inventoryStockAggregate.push(args);
        const availableQuantity = stocks
          .filter(
            (stock) =>
              stock.productId === args.where?.productId &&
              stock.variantId === args.where?.variantId
          )
          .reduce((sum, stock) => sum + stock.availableQuantity, 0);

        return {
          _sum: {
            availableQuantity
          }
        };
      }
    },
    product: {
      findFirst: async (args: { where?: { deletedAt?: null; id?: string } }) => {
        calls.productFindFirst.push(args);

        return (
          products.find(
            (product) =>
              product.id === args.where?.id &&
              (args.where.deletedAt === undefined ||
                product.deletedAt === args.where.deletedAt)
          ) ?? null
        );
      }
    },
    productVariant: {
      findFirst: async (args: {
        where?: { deletedAt?: null; id?: string; productId?: string };
      }) => {
        calls.productVariantFindFirst.push(args);

        return (
          variants.find(
            (variant) =>
              variant.id === args.where?.id &&
              variant.productId === args.where.productId &&
              (args.where.deletedAt === undefined ||
                variant.deletedAt === args.where.deletedAt)
          ) ?? null
        );
      }
    },
    user: {
      findFirst: async (args: unknown) => {
        calls.userFindFirst.push(args);

        return input?.user === undefined ? userFixture() : input.user;
      }
    }
  };

  return prisma as unknown as CartPrismaMock;
}

test("getCart returns persisted cart items with variant pricing, stock, and totals", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ quantity: 2, variantId: "variant-1" })],
    stocks: [stockFixture({ availableQuantity: 5, variantId: "variant-1" })]
  });
  const service = new CartService(prisma);

  const cart = await service.getCart("customer-1");

  assert.equal(cart.id, "cart-1");
  assert.equal(cart.itemCount, 1);
  assert.equal(cart.totalQuantity, 2);
  assert.equal(cart.items[0]?.sku, "FORCEPS-001-6IN");
  assert.equal(cart.items[0]?.brand.name, "SurgiPro");
  assert.equal(cart.items[0]?.category.name, "Surgical Instruments");
  assert.equal(cart.items[0]?.subcategory?.name, "Forceps");
  assert.equal(cart.items[0]?.unitPrice, 140);
  assert.equal(cart.items[0]?.availableQuantity, 5);
  assert.equal(cart.items[0]?.isAvailable, true);
  assert.deepEqual(cart.totals, {
    deliveryCharge: 0,
    discount: 0,
    grandTotal: 330.4,
    subtotal: 280,
    tax: 50.4
  });
});

test("addItem increments an existing product and variant row after validating aggregate stock", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ quantity: 2, variantId: "variant-1" })],
    stocks: [stockFixture({ availableQuantity: 5, variantId: "variant-1" })]
  });
  const service = new CartService(prisma);

  await service.addItem("customer-1", {
    productId: "product-1",
    quantity: 3,
    variantId: "variant-1"
  });

  assert.deepEqual(prisma.calls.cartItemUpdate[0], {
    data: {
      quantity: 5
    },
    where: {
      id: "cart-item-1"
    }
  });
  assert.equal(prisma.calls.cartItemCreate.length, 0);
});

test("addItem rejects quantities above available stock without reserving stock", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ quantity: 2, variantId: "variant-1" })],
    stocks: [stockFixture({ availableQuantity: 4, variantId: "variant-1" })]
  });
  const service = new CartService(prisma);

  await assert.rejects(
    () =>
      service.addItem("customer-1", {
        productId: "product-1",
        quantity: 3,
        variantId: "variant-1"
      }),
    BadRequestException
  );
  assert.equal(prisma.calls.cartItemUpdate.length, 0);
  assert.equal(prisma.calls.cartItemCreate.length, 0);
});

test("replaceWithItem prepares a single-item cart for buy now checkout", async () => {
  const prisma = createCartPrismaMock({
    items: [
      cartItemFixture({ id: "existing-cart-item", productId: "product-2" }),
      cartItemFixture({ id: "existing-cart-item-2", productId: "product-3" })
    ],
    products: [
      productFixture(),
      productFixture({ id: "product-2", sku: "OLD-001" }),
      productFixture({ id: "product-3", sku: "OLD-002" })
    ],
    stocks: [stockFixture({ availableQuantity: 6, variantId: "variant-1" })],
    variants: [variantFixture()]
  });
  const service = new CartService(prisma);

  const cart = await service.replaceWithItem("customer-1", {
    productId: "product-1",
    quantity: 3,
    variantId: "variant-1"
  });

  assert.deepEqual(prisma.calls.cartItemDeleteMany[0], {
    where: {
      cartId: "cart-1"
    }
  });
  assert.deepEqual(prisma.calls.cartItemCreate[0], {
    data: {
      cartId: "cart-1",
      productId: "product-1",
      quantity: 3,
      variantId: "variant-1"
    }
  });
  assert.equal(cart.itemCount, 1);
  assert.equal(cart.totalQuantity, 3);
  assert.equal(cart.items[0]?.productId, "product-1");
});

test("replaceWithItem validates stock before clearing the existing cart", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ productId: "product-2" })],
    products: [productFixture(), productFixture({ id: "product-2" })],
    stocks: [stockFixture({ availableQuantity: 1 })]
  });
  const service = new CartService(prisma);

  await assert.rejects(
    () =>
      service.replaceWithItem("customer-1", {
        productId: "product-1",
        quantity: 3,
        variantId: null
      }),
    BadRequestException
  );
  assert.equal(prisma.calls.cartItemDeleteMany.length, 0);
  assert.equal(prisma.calls.cartItemCreate.length, 0);
});

test("getCart includes a dynamic delivery charge for the selected shipping address", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ quantity: 2, variantId: "variant-1" })],
    stocks: [stockFixture({ availableQuantity: 5, variantId: "variant-1" })]
  });
  const deliveryCharges = new FakeDeliveryChargesService(75);
  const service = new CartService(
    prisma,
    deliveryCharges as never
  );

  const cart = await service.getCart("customer-1", {
    shippingAddressId: "address-1"
  } as never);

  assert.equal(cart.totals.deliveryCharge, 75);
  assert.equal(cart.totals.grandTotal, 405.4);
  assert.deepEqual(deliveryCharges.calls[0], {
    pincode: "110001",
    subtotal: 280,
    warehouseId: null
  });
});

test("replaceWithItems prepares a multi-item cart for reorder", async () => {
  const prisma = createCartPrismaMock({
    items: [
      cartItemFixture({ id: "existing-cart-item", productId: "product-3" })
    ],
    products: [
      productFixture(),
      productFixture({
        id: "product-2",
        name: "Sterile Surgical Drapes",
        sku: "DRAPE-001",
        slug: "sterile-surgical-drapes"
      }),
      productFixture({ id: "product-3", sku: "OLD-001" })
    ],
    stocks: [
      stockFixture({ availableQuantity: 5, variantId: "variant-1" }),
      stockFixture({
        availableQuantity: 6,
        productId: "product-2",
        variantId: null
      })
    ],
    variants: [variantFixture()]
  });
  const service = new CartService(prisma);

  const cart = await service.replaceWithItems("customer-1", [
    {
      productId: "product-1",
      quantity: 3,
      variantId: "variant-1"
    },
    {
      productId: "product-1",
      quantity: 2,
      variantId: "variant-1"
    },
    {
      productId: "product-2",
      quantity: 4,
      variantId: null
    }
  ]);

  assert.deepEqual(prisma.calls.cartItemDeleteMany[0], {
    where: {
      cartId: "cart-1"
    }
  });
  assert.deepEqual(
    prisma.calls.cartItemCreate.map((call) => (call as { data: unknown }).data),
    [
      {
        cartId: "cart-1",
        productId: "product-1",
        quantity: 5,
        variantId: "variant-1"
      },
      {
        cartId: "cart-1",
        productId: "product-2",
        quantity: 4,
        variantId: null
      }
    ]
  );
  assert.equal(cart.itemCount, 2);
  assert.equal(cart.totalQuantity, 9);
});

test("replaceWithItems validates all reorder lines before clearing the cart", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ productId: "product-3" })],
    products: [
      productFixture(),
      productFixture({ id: "product-2", sku: "DRAPE-001" }),
      productFixture({ id: "product-3", sku: "OLD-001" })
    ],
    stocks: [
      stockFixture({ availableQuantity: 5 }),
      stockFixture({
        availableQuantity: 1,
        productId: "product-2",
        variantId: null
      })
    ]
  });
  const service = new CartService(prisma);

  await assert.rejects(
    () =>
      service.replaceWithItems("customer-1", [
        {
          productId: "product-1",
          quantity: 2,
          variantId: null
        },
        {
          productId: "product-2",
          quantity: 3,
          variantId: null
        }
      ]),
    BadRequestException
  );
  assert.equal(prisma.calls.cartItemDeleteMany.length, 0);
  assert.equal(prisma.calls.cartItemCreate.length, 0);
});

test("updateItem scopes cart items to the token customer and validates stock", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture({ quantity: 2 })],
    stocks: [stockFixture({ availableQuantity: 8 })]
  });
  const service = new CartService(prisma);

  await service.updateItem("customer-1", "cart-item-1", {
    quantity: 6
  });

  assert.deepEqual(prisma.calls.cartItemUpdate[0], {
    data: {
      quantity: 6
    },
    where: {
      id: "cart-item-1"
    }
  });
});

test("removeItem rejects cart items outside the token customer's cart", async () => {
  const prisma = createCartPrismaMock({
    cart: cartFixture({ userId: "other-customer" }),
    items: [cartItemFixture()]
  });
  const service = new CartService(prisma);

  await assert.rejects(
    () => service.removeItem("customer-1", "cart-item-1"),
    NotFoundException
  );
  assert.equal(prisma.calls.cartItemDelete.length, 0);
});

test("clearCart deletes every item in the token customer's active cart", async () => {
  const prisma = createCartPrismaMock({
    items: [cartItemFixture(), cartItemFixture({ id: "cart-item-2" })]
  });
  const service = new CartService(prisma);

  const cart = await service.clearCart("customer-1");

  assert.deepEqual(prisma.calls.cartItemDeleteMany[0], {
    where: {
      cartId: "cart-1"
    }
  });
  assert.equal(cart.itemCount, 0);
  assert.equal(cart.totalQuantity, 0);
});

test("cart controller requires the customer JWT guard", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, CartController), [
    CustomerJwtGuard
  ]);
});
