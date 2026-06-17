import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import type {
  AdminDeliveryChargeRuleListQueryDto,
  CreateDeliveryChargeRuleDto,
  UpdateDeliveryChargeRuleDto
} from "./dto/delivery-charge.dto";

const DELIVERY_CHARGE_RULE_INCLUDE = {
  warehouse: {
    select: {
      code: true,
      id: true,
      name: true
    }
  }
} as const satisfies Prisma.DeliveryChargeRuleInclude;

type DecimalValue =
  | number
  | string
  | { toNumber?: () => number; toString: () => string };
type DeliveryChargeRuleRecord = Prisma.DeliveryChargeRuleGetPayload<{
  include: typeof DELIVERY_CHARGE_RULE_INCLUDE;
}>;

export type DeliveryChargeCalculationInput = {
  pincode?: string | null;
  subtotal: number;
  warehouseId?: string | null;
};

export type DeliveryChargeCalculationResult = {
  deliveryCharge: number;
  rule: {
    id: string;
    name: string;
  } | null;
};

@Injectable()
export class DeliveryChargesService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateDeliveryCharge(
    input: DeliveryChargeCalculationInput
  ): Promise<DeliveryChargeCalculationResult> {
    const subtotal = normalizeMoney(input.subtotal, "subtotal");
    const pincode = normalizeNullablePincode(input.pincode);
    const warehouseId = input.warehouseId ?? null;
    const rules = await this.prisma.deliveryChargeRule.findMany({
      include: DELIVERY_CHARGE_RULE_INCLUDE,
      where: {
        deletedAt: null,
        isActive: true
      }
    });
    const matchingRule =
      rules
        .filter((rule) => deliveryRuleMatches(rule, subtotal, pincode, warehouseId))
        .sort(compareDeliveryRules)[0] ?? null;

    if (!matchingRule) {
      return {
        deliveryCharge: 0,
        rule: null
      };
    }

    const freeDeliveryThreshold = nullableDecimalToNumber(
      matchingRule.freeDeliveryThreshold
    );
    const deliveryCharge =
      freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold
        ? 0
        : decimalToNumber(matchingRule.charge);

    return {
      deliveryCharge: roundMoney(deliveryCharge),
      rule: {
        id: matchingRule.id,
        name: matchingRule.name
      }
    };
  }

  async listAdminRules(query: AdminDeliveryChargeRuleListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.DeliveryChargeRuleWhereInput = {
      deletedAt: null,
      isActive: query.isActive === undefined ? undefined : query.isActive === "true",
      name: search
        ? {
            contains: search,
            mode: "insensitive"
          }
        : undefined,
      pincode: normalizeNullablePincode(query.pincode) ?? undefined,
      warehouseId: query.warehouseId || undefined
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryChargeRule.findMany({
        include: DELIVERY_CHARGE_RULE_INCLUDE,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
          { id: "asc" }
        ],
        skip: (page - 1) * limit,
        take: limit,
        where: stripUndefined(where)
      }),
      this.prisma.deliveryChargeRule.count({
        where: stripUndefined(where)
      })
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((rule) => serializeRule(rule)),
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

  async createAdminRule(input: CreateDeliveryChargeRuleDto) {
    const data = buildRuleData(input) as Prisma.DeliveryChargeRuleUncheckedCreateInput;
    const rule = await this.prisma.deliveryChargeRule.create({
      data,
      include: DELIVERY_CHARGE_RULE_INCLUDE
    });

    return serializeRule(rule);
  }

  async updateAdminRule(id: string, input: UpdateDeliveryChargeRuleDto) {
    const existing = await this.findAdminRule(id);
    const data = buildRuleData(input, existing);
    const rule = await this.prisma.deliveryChargeRule.update({
      data,
      include: DELIVERY_CHARGE_RULE_INCLUDE,
      where: {
        id
      }
    });

    return serializeRule(rule);
  }

  async deleteAdminRule(id: string) {
    await this.findAdminRule(id);
    const rule = await this.prisma.deliveryChargeRule.update({
      data: {
        deletedAt: new Date(),
        isActive: false
      },
      include: DELIVERY_CHARGE_RULE_INCLUDE,
      where: {
        id
      }
    });

    return serializeRule(rule);
  }

  private async findAdminRule(id: string) {
    const rule = await this.prisma.deliveryChargeRule.findFirst({
      include: DELIVERY_CHARGE_RULE_INCLUDE,
      where: {
        deletedAt: null,
        id
      }
    });

    if (!rule) {
      throw new NotFoundException("Delivery charge rule was not found.");
    }

    return rule;
  }
}

function buildRuleData(
  input: CreateDeliveryChargeRuleDto | UpdateDeliveryChargeRuleDto,
  existing?: DeliveryChargeRuleRecord
): Prisma.DeliveryChargeRuleUncheckedUpdateInput {
  const minOrderAmount =
    input.minOrderAmount === undefined
      ? nullableDecimalToNumber(existing?.minOrderAmount)
      : normalizeNullableMoney(input.minOrderAmount, "minOrderAmount");
  const maxOrderAmount =
    input.maxOrderAmount === undefined
      ? nullableDecimalToNumber(existing?.maxOrderAmount)
      : normalizeNullableMoney(input.maxOrderAmount, "maxOrderAmount");

  assertValidOrderRange(minOrderAmount, maxOrderAmount);

  return stripUndefined({
    charge:
      input.charge === undefined
        ? undefined
        : normalizeMoney(input.charge, "charge"),
    freeDeliveryThreshold:
      input.freeDeliveryThreshold === undefined
        ? undefined
        : normalizeNullableMoney(
            input.freeDeliveryThreshold,
            "freeDeliveryThreshold"
          ),
    isActive: input.isActive,
    maxOrderAmount:
      input.maxOrderAmount === undefined ? undefined : maxOrderAmount,
    minOrderAmount:
      input.minOrderAmount === undefined ? undefined : minOrderAmount,
    name:
      input.name === undefined
        ? undefined
        : normalizeRequiredText(input.name, "Rule name"),
    pincode:
      input.pincode === undefined
        ? undefined
        : normalizeNullablePincode(input.pincode),
    priority: input.priority,
    warehouseId:
      input.warehouseId === undefined ? undefined : input.warehouseId ?? null
  });
}

function deliveryRuleMatches(
  rule: DeliveryChargeRuleRecord,
  subtotal: number,
  pincode: string | null,
  warehouseId: string | null
) {
  const minOrderAmount = nullableDecimalToNumber(rule.minOrderAmount);
  const maxOrderAmount = nullableDecimalToNumber(rule.maxOrderAmount);

  if (rule.pincode !== null && rule.pincode !== pincode) {
    return false;
  }

  if (rule.warehouseId !== null && rule.warehouseId !== warehouseId) {
    return false;
  }

  if (minOrderAmount !== null && subtotal < minOrderAmount) {
    return false;
  }

  if (maxOrderAmount !== null && subtotal > maxOrderAmount) {
    return false;
  }

  return true;
}

function compareDeliveryRules(
  left: DeliveryChargeRuleRecord,
  right: DeliveryChargeRuleRecord
) {
  const specificityDifference = ruleSpecificity(right) - ruleSpecificity(left);

  if (specificityDifference !== 0) {
    return specificityDifference;
  }

  const priorityDifference = right.priority - left.priority;

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const createdDifference =
    right.createdAt.getTime() - left.createdAt.getTime();

  return createdDifference === 0
    ? left.id.localeCompare(right.id)
    : createdDifference;
}

function ruleSpecificity(rule: DeliveryChargeRuleRecord) {
  return (
    (rule.pincode ? 100 : 0) +
    (rule.warehouseId ? 50 : 0) +
    (rule.minOrderAmount || rule.maxOrderAmount ? 10 : 0) +
    (rule.freeDeliveryThreshold ? 5 : 0)
  );
}

function serializeRule(rule: DeliveryChargeRuleRecord) {
  return {
    charge: decimalToNumber(rule.charge),
    createdAt: rule.createdAt,
    freeDeliveryThreshold: nullableDecimalToNumber(rule.freeDeliveryThreshold),
    id: rule.id,
    isActive: rule.isActive,
    maxOrderAmount: nullableDecimalToNumber(rule.maxOrderAmount),
    minOrderAmount: nullableDecimalToNumber(rule.minOrderAmount),
    name: rule.name,
    pincode: rule.pincode,
    priority: rule.priority,
    updatedAt: rule.updatedAt,
    warehouse: rule.warehouse,
    warehouseId: rule.warehouseId
  };
}

function normalizeRequiredText(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException(`${label} is required.`);
  }

  return trimmed;
}

function normalizeMoney(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`${field} must be 0 or above.`);
  }

  return roundMoney(value);
}

function normalizeNullableMoney(
  value: number | null | undefined,
  field: string
) {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeMoney(value, field);
}

function assertValidOrderRange(
  minOrderAmount: number | null,
  maxOrderAmount: number | null
) {
  if (
    minOrderAmount !== null &&
    maxOrderAmount !== null &&
    minOrderAmount > maxOrderAmount
  ) {
    throw new BadRequestException(
      "Maximum order amount must be greater than minimum order amount."
    );
  }
}

function normalizeNullablePincode(value?: string | null) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

function nullableDecimalToNumber(value: DecimalValue | null | undefined) {
  return value === null || value === undefined ? null : decimalToNumber(value);
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
