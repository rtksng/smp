import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const MAX_DELIVERY_CHARGE_AMOUNT = 9_999_999_999.99;

function DeliveryNumber() {
  return Transform(({ obj, key }) => {
    const value: unknown = (obj as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  }, { toClassOnly: true });
}

function PreserveInput() {
  return Transform(({ obj, key }) => (obj as Record<string, unknown>)[key], { toClassOnly: true });
}

export class AdminDeliveryChargeRuleListQueryDto {
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

  @ApiPropertyOptional({ example: "Delhi" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "110001" })
  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string;

  @ApiPropertyOptional({ example: "warehouse-id" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional({ enum: ["true", "false"], example: "true" })
  @IsIn(["true", "false"])
  @IsOptional()
  isActive?: "false" | "true";
}

export class CreateDeliveryChargeRuleDto {
  @ApiProperty({ example: "Delhi local delivery" })
  @IsString()
  @PreserveInput()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 75, minimum: 0 })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  charge!: number;

  @ApiPropertyOptional({ example: 500, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 4999, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  maxOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 5000, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  freeDeliveryThreshold?: number | null;

  @ApiPropertyOptional({ example: "110001", nullable: true })
  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string | null;

  @ApiPropertyOptional({ example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc", nullable: true })
  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @DeliveryNumber()
  @IsInt()
  @ValidateIf((_object, value) => value !== undefined)
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @PreserveInput()
  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  isActive?: boolean;
}

export class UpdateDeliveryChargeRuleDto {
  @ApiPropertyOptional({ example: "Delhi local delivery" })
  @IsString()
  @PreserveInput()
  @ValidateIf((_object, value) => value !== undefined)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 75, minimum: 0 })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @ValidateIf((_object, value) => value !== undefined)
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  charge?: number;

  @ApiPropertyOptional({ example: 500, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 4999, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  maxOrderAmount?: number | null;

  @ApiPropertyOptional({ example: 5000, minimum: 0, nullable: true })
  @Type(() => Number)
  @DeliveryNumber()
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(MAX_DELIVERY_CHARGE_AMOUNT)
  freeDeliveryThreshold?: number | null;

  @ApiPropertyOptional({ example: "110001", nullable: true })
  @IsOptional()
  @Matches(/^\d{6}$/)
  pincode?: string | null;

  @ApiPropertyOptional({ example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc", nullable: true })
  @IsOptional()
  @IsUUID()
  warehouseId?: string | null;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @DeliveryNumber()
  @IsInt()
  @ValidateIf((_object, value) => value !== undefined)
  @Min(-2_147_483_648)
  @Max(2_147_483_647)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @PreserveInput()
  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  isActive?: boolean;
}

export class DeliveryChargeWarehouseResponseDto {
  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: "DEL-01" })
  code!: string;

  @ApiProperty({ example: "Delhi warehouse" })
  name!: string;
}

export class DeliveryChargeRuleResponseDto {
  @ApiProperty({ example: "rule-id" })
  id!: string;

  @ApiProperty({ example: "Delhi local delivery" })
  name!: string;

  @ApiProperty({ example: 75 })
  charge!: number;

  @ApiProperty({ example: 500, nullable: true })
  minOrderAmount!: number | null;

  @ApiProperty({ example: 4999, nullable: true })
  maxOrderAmount!: number | null;

  @ApiProperty({ example: 5000, nullable: true })
  freeDeliveryThreshold!: number | null;

  @ApiProperty({ example: "110001", nullable: true })
  pincode!: string | null;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  warehouseId!: string | null;

  @ApiProperty({ type: DeliveryChargeWarehouseResponseDto, nullable: true })
  warehouse!: DeliveryChargeWarehouseResponseDto | null;

  @ApiProperty({ example: 10 })
  priority!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: "2026-06-17T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "2026-06-17T10:00:00.000Z" })
  updatedAt!: Date;
}

export class DeliveryChargeRuleListResponseDto {
  @ApiProperty({ type: [DeliveryChargeRuleResponseDto] })
  items!: DeliveryChargeRuleResponseDto[];
}
