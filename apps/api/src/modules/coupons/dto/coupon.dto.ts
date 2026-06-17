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

  @ApiProperty({ example: 10, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @ApiPropertyOptional({ example: 1000, minimum: 0, nullable: true })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 300, minimum: 0, nullable: true })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ example: 100, minimum: 1, nullable: true })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
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
