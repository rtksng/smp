import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CouponType } from "../../../generated/prisma/enums";
import { MAX_COUPON_AMOUNT, MAX_COUPON_USAGE_LIMIT } from "../coupons.constants";

export class ValidateCouponDto {
  @ApiProperty({
    example: "SURGICAL10"
  })
  @IsString()
  @MaxLength(64)
  code!: string;
}

export class CouponValidationResponseDto {
  @ApiProperty({ example: "SURGICAL10" })
  code!: string;

  @ApiProperty({ example: 120 })
  discount!: number;

  @ApiProperty({ example: 1200 })
  grandTotal!: number;

  @ApiProperty({ example: "Coupon applied." })
  message!: string;

  @ApiProperty({ example: 1000 })
  subtotal!: number;

  @ApiProperty({ example: 180 })
  tax!: number;
}

export class AvailableCouponResponseDto {
  @ApiProperty({ example: "SURGICAL10" })
  code!: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  type!: CouponType;

  @ApiProperty({ example: 10 })
  value!: number;

  @ApiProperty({ example: 1000, nullable: true })
  minOrderAmount!: number | null;

  @ApiProperty({ example: 300, nullable: true })
  maxDiscount!: number | null;

  @ApiProperty({ example: "2026-12-31T23:59:59.999Z", nullable: true })
  expiresAt!: Date | null;
}

export class AvailableCouponListResponseDto {
  @ApiProperty({ type: [AvailableCouponResponseDto], maxItems: 100 })
  items!: AvailableCouponResponseDto[];
}

export class AdminCouponListQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: "SURG" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;
}

export class CreateCouponDto {
  @ApiProperty({ example: "SURGICAL10" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsEnum(CouponType)
  type!: CouponType;

  @ApiProperty({ example: 10, minimum: 0.01, maximum: MAX_COUPON_AMOUNT })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_COUPON_AMOUNT)
  value!: number;

  @ApiPropertyOptional({ example: 1000, minimum: 0, maximum: MAX_COUPON_AMOUNT, nullable: true })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(MAX_COUPON_AMOUNT)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 300, minimum: 0, maximum: MAX_COUPON_AMOUNT, nullable: true })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Max(MAX_COUPON_AMOUNT)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: MAX_COUPON_USAGE_LIMIT, nullable: true })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(MAX_COUPON_USAGE_LIMIT)
  usageLimit?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: "2026-06-01T00:00:00.000Z",
    nullable: true
  })
  @IsDateString()
  @IsOptional()
  startsAt?: string | null;

  @ApiPropertyOptional({
    example: "2026-06-30T23:59:59.999Z",
    nullable: true
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class CouponResponseDto {
  @ApiProperty({ example: "coupon-id" })
  id!: string;

  @ApiProperty({ example: "SURGICAL10" })
  code!: string;

  @ApiProperty({ example: "PERCENTAGE" })
  type!: string;

  @ApiProperty({ example: 10 })
  value!: number;

  @ApiProperty({ example: 1000, nullable: true })
  minOrderAmount!: number | null;

  @ApiProperty({ example: 300, nullable: true })
  maxDiscount!: number | null;

  @ApiProperty({ example: 100, nullable: true })
  usageLimit!: number | null;

  @ApiProperty({ example: 12 })
  usedCount!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: "2026-06-01T00:00:00.000Z", nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ example: "2026-06-30T23:59:59.999Z", nullable: true })
  expiresAt!: Date | null;
}

export class CouponPaginationResponseDto {
  @ApiProperty({ example: false })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class CouponListResponseDto {
  @ApiProperty({ type: [CouponResponseDto] })
  items!: CouponResponseDto[];

  @ApiProperty({ type: CouponPaginationResponseDto })
  pagination!: CouponPaginationResponseDto;
}
