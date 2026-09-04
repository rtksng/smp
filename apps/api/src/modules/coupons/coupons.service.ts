import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  CouponType,
  Prisma,
  ProductStatus
} from "../../generated/prisma/client";
import type {
  AdminCouponListQueryDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto
} from "./dto/coupon.dto";
import { MAX_COUPON_AMOUNT, MAX_COUPON_USAGE_LIMIT } from "./coupons.constants";

const CART_COUPON_INCLUDE = {
  items: {
    include: {
      product: true,
      variant: true
    }
  }
} as const satisfies Prisma.CartInclude;

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type CouponRecord = Prisma.CouponGetPayload<Record<string, never>>;
type CouponCart = Prisma.CartGetPayload<{ include: typeof CART_COUPON_INCLUDE }>;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAvailableCoupons() {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      orderBy: [{ code: "asc" }, { id: "asc" }],
      take: 100,
      select: {
        code: true,
        type: true,
        value: true,
        minOrderAmount: true,
        maxDiscount: true,
        expiresAt: true
      },
      where: {
        deletedAt: null,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          {
            OR: [
              { usageLimit: null },
              { usedCount: { lt: this.prisma.coupon.fields.usageLimit } }
            ]
          }
        ]
      }
    });

    return {
      items: coupons.map((coupon) => ({
        code: coupon.code,
        type: coupon.type,
        value: decimalToNumber(coupon.value),
        minOrderAmount: coupon.minOrderAmount === null
          ? null
          : decimalToNumber(coupon.minOrderAmount),
        maxDiscount: coupon.maxDiscount === null
          ? null
          : decimalToNumber(coupon.maxDiscount),
        expiresAt: coupon.expiresAt
      }))
    };
  }

  async validateForCustomerCart(customerId: string, input: ValidateCouponDto) {
    const code = normalizeCouponCode(input.code);
    const [coupon, cart] = await Promise.all([
      this.findUsableCoupon(code),
      this.findCustomerCart(customerId)
    ]);
    const totals = calculateCouponCartTotals(cart);
    const discount = calculateCouponDiscount(coupon, totals.subtotal);

    return {
      code: coupon.code,
      discount,
      grandTotal: roundMoney(totals.subtotal + totals.tax - discount),
      message: "Coupon applied.",
      subtotal: totals.subtotal,
      tax: totals.tax
    };
  }

  async listAdminCoupons(query: AdminCouponListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.CouponWhereInput = {
      code: search
        ? {
            contains: search,
            mode: "insensitive"
          }
        : undefined,
      deletedAt: null
    };
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.coupon.count({
        where: stripUndefined(where)
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((coupon) => serializeCoupon(coupon)),
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

  async createAdminCoupon(input: CreateCouponDto) {
    const code = normalizeCouponCode(input.code);
    await this.assertCouponCodeAvailable(code);
    const startsAt = parseNullableDate(input.startsAt);
    const expiresAt = parseNullableDate(input.expiresAt);

    assertCouponDateWindow(startsAt, expiresAt);

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        expiresAt: expiresAt ?? null,
        isActive: input.isActive ?? true,
        maxDiscount: normalizeNullableMoney(input.maxDiscount, "maxDiscount"),
        minOrderAmount: normalizeNullableMoney(
          input.minOrderAmount,
          "minOrderAmount"
        ),
        startsAt: startsAt ?? null,
        type: input.type,
        usageLimit: normalizeNullableUsageLimit(input.usageLimit),
        value: normalizeRequiredMoney(input.value, "value", 0.01)
      }
    });

    return serializeCoupon(coupon);
  }

  async updateAdminCoupon(id: string, input: UpdateCouponDto) {
    const existing = await this.findAdminCoupon(id);
    const startsAt =
      input.startsAt === undefined
        ? existing.startsAt
        : parseNullableDate(input.startsAt);
    const expiresAt =
      input.expiresAt === undefined
        ? existing.expiresAt
        : parseNullableDate(input.expiresAt);
    const data: Prisma.CouponUpdateInput = {};

    assertCouponDateWindow(startsAt, expiresAt);

    if (input.code !== undefined) {
      const code = normalizeCouponCode(input.code);

      if (code !== existing.code) {
        await this.assertCouponCodeAvailable(code, existing.id);
      }

      data.code = code;
    }

    if (input.expiresAt !== undefined) {
      data.expiresAt = expiresAt;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (input.maxDiscount !== undefined) {
      data.maxDiscount = normalizeNullableMoney(input.maxDiscount, "maxDiscount");
    }

    if (input.minOrderAmount !== undefined) {
      data.minOrderAmount = normalizeNullableMoney(
        input.minOrderAmount,
        "minOrderAmount"
      );
    }

    if (input.startsAt !== undefined) {
      data.startsAt = startsAt;
    }

    if (input.type !== undefined) {
      data.type = input.type;
    }

    if (input.usageLimit !== undefined) {
      data.usageLimit = normalizeNullableUsageLimit(input.usageLimit);
    }

    if (input.value !== undefined) {
      data.value = normalizeRequiredMoney(input.value, "value", 0.01);
    }

    const coupon = await this.prisma.coupon.update({
      data,
      where: {
        id
      }
    });

    return serializeCoupon(coupon);
  }

  async deleteAdminCoupon(id: string) {
    await this.findAdminCoupon(id);
    const coupon = await this.prisma.coupon.update({
      data: {
        deletedAt: new Date(),
        isActive: false
      },
      where: {
        id
      }
    });

    return serializeCoupon(coupon);
  }

  private async findUsableCoupon(code: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        code: {
          equals: code,
          mode: "insensitive"
        },
        deletedAt: null
      }
    });

    if (!coupon) {
      throw new NotFoundException("Coupon was not found.");
    }

    assertCouponUsable(coupon);

    return coupon;
  }

  private async findAdminCoupon(id: string) {
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        deletedAt: null,
        id
      }
    });

    if (!coupon) {
      throw new NotFoundException("Coupon was not found.");
    }

    return coupon;
  }

  private async assertCouponCodeAvailable(code: string, ignoreId?: string) {
    if (!code) {
      throw new BadRequestException("Coupon code is required.");
    }

    const existing = await this.prisma.coupon.findFirst({
      where: {
        code: {
          equals: code,
          mode: "insensitive"
        }
      }
    });

    if (existing && existing.id !== ignoreId) {
      throw new BadRequestException("Coupon code already exists.");
    }
  }

  private async findCustomerCart(customerId: string) {
    const cart = await this.prisma.cart.findFirst({
      include: CART_COUPON_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      where: {
        deletedAt: null,
        userId: customerId
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart is empty.");
    }

    return cart;
  }
}

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase();
}

export function assertCouponUsable(coupon: CouponRecord, now = new Date()) {
  if (!coupon.isActive || coupon.deletedAt) {
    throw new BadRequestException("Coupon is not active.");
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    throw new BadRequestException("Coupon is not active yet.");
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    throw new BadRequestException("Coupon has expired.");
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new BadRequestException("Coupon usage limit has been reached.");
  }
}

export function assertCouponMinimumOrder(
  coupon: CouponRecord,
  subtotal: number
) {
  const minOrderAmount =
    coupon.minOrderAmount === null ? null : decimalToNumber(coupon.minOrderAmount);

  if (minOrderAmount !== null && subtotal < minOrderAmount) {
    throw new BadRequestException(
      `Coupon requires a minimum order subtotal of ${minOrderAmount}.`
    );
  }
}

export function calculateCouponDiscount(
  coupon: CouponRecord,
  subtotal: number
) {
  assertCouponUsable(coupon);
  assertCouponMinimumOrder(coupon, subtotal);

  const value = decimalToNumber(coupon.value);
  const rawDiscount =
    coupon.type === CouponType.PERCENTAGE ? subtotal * (value / 100) : value;
  const maxDiscount =
    coupon.maxDiscount === null ? null : decimalToNumber(coupon.maxDiscount);
  const cappedDiscount =
    maxDiscount === null ? rawDiscount : Math.min(rawDiscount, maxDiscount);

  return roundMoney(Math.min(cappedDiscount, subtotal));
}

function calculateCouponCartTotals(cart: CouponCart) {
  const itemTotals = cart.items.map((item) => {
    if (
      item.product.deletedAt !== null ||
      item.product.status !== ProductStatus.ACTIVE
    ) {
      throw new BadRequestException("Cart contains an unavailable product.");
    }

    if (
      item.variantId !== null &&
      (!item.variant ||
        item.variant.deletedAt !== null ||
        item.variant.status !== ProductStatus.ACTIVE)
    ) {
      throw new BadRequestException("Cart contains an unavailable product variant.");
    }

    const unitPrice = decimalToNumber(
      item.variant?.sellingPrice ?? item.product.sellingPrice
    );
    const subtotal = roundMoney(unitPrice * item.quantity);
    const tax = roundMoney(subtotal * (decimalToNumber(item.product.taxRate) / 100));

    return {
      subtotal,
      tax
    };
  });

  return {
    subtotal: roundMoney(itemTotals.reduce((sum, item) => sum + item.subtotal, 0)),
    tax: roundMoney(itemTotals.reduce((sum, item) => sum + item.tax, 0))
  };
}

function serializeCoupon(coupon: CouponRecord) {
  return {
    code: coupon.code,
    expiresAt: coupon.expiresAt,
    id: coupon.id,
    isActive: coupon.isActive,
    maxDiscount:
      coupon.maxDiscount === null ? null : decimalToNumber(coupon.maxDiscount),
    minOrderAmount:
      coupon.minOrderAmount === null
        ? null
        : decimalToNumber(coupon.minOrderAmount),
    startsAt: coupon.startsAt,
    type: coupon.type,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    value: decimalToNumber(coupon.value)
  };
}

function parseNullableDate(value?: string | Date | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Coupon date is invalid.");
  }

  return date;
}

function assertCouponDateWindow(
  startsAt: Date | null | undefined,
  expiresAt: Date | null | undefined
) {
  if (startsAt && expiresAt && startsAt > expiresAt) {
    throw new BadRequestException("Coupon start date must be before expiry date.");
  }
}

function normalizeRequiredMoney(value: number, field: string, minimum: number) {
  if (!Number.isFinite(value) || value < minimum) {
    throw new BadRequestException(`${field} must be at least ${minimum}.`);
  }

  if (value > MAX_COUPON_AMOUNT) {
    throw new BadRequestException(`${field} must not exceed ${MAX_COUPON_AMOUNT}.`);
  }

  if (roundMoney(value) !== value) {
    throw new BadRequestException(`${field} must have at most 2 decimal places.`);
  }

  return roundMoney(value);
}

function normalizeNullableMoney(
  value: number | null | undefined,
  field: string
) {
  if (value === undefined || value === null) {
    return value;
  }

  return normalizeRequiredMoney(value, field, 0);
}

function normalizeNullableUsageLimit(value: number | null | undefined) {
  if (value === undefined || value === null) {
    return value;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new BadRequestException("usageLimit must be at least 1.");
  }

  if (value > MAX_COUPON_USAGE_LIMIT) {
    throw new BadRequestException(`usageLimit must not exceed ${MAX_COUPON_USAGE_LIMIT}.`);
  }

  return value;
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

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
