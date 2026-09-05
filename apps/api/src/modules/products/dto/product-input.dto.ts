import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProductDocumentType, ProductStatus } from "../../../generated/prisma/enums";

export type ProductVariantAttributes = Record<string, string | number | boolean | null>;

export const ADMIN_PRODUCT_DOCUMENT_TYPES = {
  CERTIFICATE: ProductDocumentType.CERTIFICATE,
  COMPLIANCE: ProductDocumentType.COMPLIANCE,
  MANUAL: ProductDocumentType.MANUAL,
  WARRANTY: ProductDocumentType.WARRANTY
} as const;

const trimText = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
const trimOptionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
const normalizeTextArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : item))
        .filter((item) => item !== "")
    : value;

export class ProductImageInputDto {
  @ApiPropertyOptional({
    example: "Curved artery forceps"
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(180)
  altText?: string | null;

  @ApiPropertyOptional({
    default: false,
    example: true
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    default: 0,
    example: 1,
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    example: "https://cdn.example.com/products/forceps/main.jpg"
  })
  @Transform(trimText)
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  url!: string;
}

export class ProductVariantInputDto {
  @ApiProperty({
    example: {
      size: "6 inch"
    }
  })
  @IsObject()
  attributes!: ProductVariantAttributes;

  @ApiProperty({
    example: 175,
    minimum: 0
  })
  @Type(() => Number)
  @Min(0)
  mrp!: number;

  @ApiProperty({
    example: "6 inch"
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: 140,
    minimum: 0
  })
  @Type(() => Number)
  @Min(0)
  sellingPrice!: number;

  @ApiProperty({
    example: "FORCEPS-001-6IN"
  })
  @IsString()
  @Transform(trimText)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  @MaxLength(80)
  sku!: string;

  @ApiPropertyOptional({
    default: ProductStatus.ACTIVE,
    enum: ProductStatus
  })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class ProductDocumentInputDto {
  @ApiProperty({
    example: "products/forceps/certificate.pdf"
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(512)
  fileKey!: string;

  @ApiProperty({
    example: "https://cdn.example.com/products/forceps/certificate.pdf"
  })
  @Transform(trimText)
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(2048)
  fileUrl!: string;

  @ApiProperty({
    example: "Sterility Certificate"
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    enum: ADMIN_PRODUCT_DOCUMENT_TYPES,
    example: ADMIN_PRODUCT_DOCUMENT_TYPES.CERTIFICATE
  })
  @IsEnum(ADMIN_PRODUCT_DOCUMENT_TYPES)
  type!: (typeof ADMIN_PRODUCT_DOCUMENT_TYPES)[keyof typeof ADMIN_PRODUCT_DOCUMENT_TYPES];
}

export class ProductNestedInputDto {
  @ApiPropertyOptional({
    type: [ProductDocumentInputDto]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductDocumentInputDto)
  documents?: ProductDocumentInputDto[];

  @ApiPropertyOptional({
    type: [ProductImageInputDto]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];

  @ApiPropertyOptional({
    type: [ProductVariantInputDto]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants?: ProductVariantInputDto[];

  @ApiPropertyOptional({
    example: ["forceps", "artery"]
  })
  @IsOptional()
  @Transform(normalizeTextArray)
  @IsArray()
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  searchTags?: string[];
}

export class ProductScalarInputDto extends ProductNestedInputDto {
  @ApiProperty({
    example: 100,
    minimum: 0
  })
  @Type(() => Number)
  @Min(0)
  basePrice!: number;

  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @Transform(trimText)
  @IsUUID("4")
  brandId!: string;

  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @Transform(trimText)
  @IsUUID("4")
  categoryId!: string;

  @ApiProperty({
    example: "Reusable artery forceps for operating rooms."
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(20000)
  description!: string;

  @ApiProperty({
    example: false
  })
  @IsBoolean()
  disposable!: boolean;

  @ApiProperty({
    example: false
  })
  @IsBoolean()
  expirySensitive!: boolean;

  @ApiPropertyOptional({
    example: "Stainless steel"
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(120)
  material?: string | null;

  @ApiPropertyOptional({
    example: "General Surgery"
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(120)
  medicalSpecialty?: string | null;

  @ApiPropertyOptional({
    example: "Buy surgical forceps online."
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(320)
  metaDescription?: string | null;

  @ApiPropertyOptional({
    example: "Surgical Forceps"
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(160)
  metaTitle?: string | null;

  @ApiProperty({
    example: 150,
    minimum: 0
  })
  @Type(() => Number)
  @Min(0)
  mrp!: number;

  @ApiProperty({
    example: "Curved Artery Forceps"
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    example: "1 pc"
  })
  @IsOptional()
  @IsString()
  @Transform(trimOptionalText)
  @MaxLength(80)
  packSize?: string | null;

  @ApiProperty({
    example: 120,
    minimum: 0
  })
  @Type(() => Number)
  @Min(0)
  sellingPrice!: number;

  @ApiProperty({
    example: "Curved artery forceps."
  })
  @IsString()
  @Transform(trimText)
  @MinLength(1)
  @MaxLength(500)
  shortDescription!: string;

  @ApiProperty({
    example: "FORCEPS-001"
  })
  @IsString()
  @Transform(trimText)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  @MaxLength(80)
  sku!: string;

  @ApiProperty({
    example: "curved-artery-forceps"
  })
  @IsString()
  @Transform(trimText)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  slug!: string;

  @ApiProperty({
    enum: ProductStatus,
    example: ProductStatus.ACTIVE
  })
  @IsEnum(ProductStatus)
  status!: ProductStatus;

  @ApiProperty({
    example: true
  })
  @IsBoolean()
  sterile!: boolean;

  @ApiPropertyOptional({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsOptional()
  @Transform(trimOptionalText)
  @IsUUID("4")
  subcategoryId?: string | null;

  @ApiProperty({
    example: 18,
    maximum: 100,
    minimum: 0
  })
  @Type(() => Number)
  @Max(100)
  @Min(0)
  taxRate!: number;

  @ApiProperty({
    example: "piece"
  })
  @IsString()
  @Transform(trimText)
  @MaxLength(40)
  unit!: string;
}
