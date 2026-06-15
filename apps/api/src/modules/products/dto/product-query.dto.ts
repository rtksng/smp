import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProductStatus } from "../../../generated/prisma/enums";

export enum ProductSortOption {
  Latest = "latest",
  NameAz = "name_az",
  PriceHighToLow = "price_high_to_low",
  PriceLowToHigh = "price_low_to_high"
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (value === true || value === "true" || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === "0") {
    return false;
  }

  return value;
}

export class ProductListQueryDto {
  @ApiPropertyOptional({
    description: "Filter by brand id or brand slug.",
    example: "acme-surgical"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  brand?: string;

  @ApiPropertyOptional({
    description: "Filter by category id or category slug.",
    example: "surgical-instruments"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  category?: string;

  @ApiPropertyOptional({
    description: "Filter by subcategory id or subcategory slug.",
    example: "endodontics"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subcategory?: string;

  @ApiPropertyOptional({
    description: "Filter disposable products.",
    example: false
  })
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  disposable?: boolean;

  @ApiPropertyOptional({
    description: "Filter expiry-sensitive products.",
    example: false
  })
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  expirySensitive?: boolean;

  @ApiPropertyOptional({
    description: "Filter products with available inventory.",
    example: true
  })
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    default: 20,
    maximum: 100,
    minimum: 1
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Maximum selling price.",
    example: 5000,
    minimum: 0
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: "Filter by medical specialty.",
    example: "general surgery"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  medicalSpecialty?: string;

  @ApiPropertyOptional({
    description: "Minimum selling price.",
    example: 100,
    minimum: 0
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description:
      "Search product name, SKU, brand, category, medical specialty, and search tags.",
    example: "forceps"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({
    default: ProductSortOption.Latest,
    enum: ProductSortOption
  })
  @IsOptional()
  @IsEnum(ProductSortOption)
  sort?: ProductSortOption;

  @ApiPropertyOptional({
    description: "Filter sterile products.",
    example: true
  })
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  sterile?: boolean;
}

export class AdminProductListQueryDto extends ProductListQueryDto {
  @ApiPropertyOptional({
    description: "Filter admin product list by product status.",
    enum: ProductStatus,
    example: ProductStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class ProductRecommendationQueryDto {
  @ApiPropertyOptional({
    default: 4,
    maximum: 12,
    minimum: 1
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  limit?: number;
}
