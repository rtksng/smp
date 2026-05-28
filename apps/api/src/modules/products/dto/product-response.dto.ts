import { ApiProperty } from "@nestjs/swagger";
import { ProductDocumentType, ProductStatus } from "../../../generated/prisma/enums";

export class ProductBrandResponseDto {
  @ApiProperty({ example: "brand-id" })
  id!: string;

  @ApiProperty({ example: "Acme Surgical" })
  name!: string;

  @ApiProperty({ example: "acme-surgical" })
  slug!: string;
}

export class ProductCategoryResponseDto {
  @ApiProperty({ example: "category-id" })
  id!: string;

  @ApiProperty({ example: "Surgical Instruments" })
  name!: string;

  @ApiProperty({ example: "surgical-instruments" })
  slug!: string;
}

export class ProductImageResponseDto {
  @ApiProperty({ example: "Curved artery forceps" })
  altText!: string | null;

  @ApiProperty({ example: "image-id" })
  id!: string;

  @ApiProperty({ example: true })
  isPrimary!: boolean;

  @ApiProperty({ example: 1 })
  sortOrder!: number;

  @ApiProperty({ example: "https://cdn.example.com/products/forceps/main.jpg" })
  url!: string;
}

export class ProductVariantResponseDto {
  @ApiProperty({
    example: {
      size: "6 inch"
    }
  })
  attributes!: Record<string, unknown>;

  @ApiProperty({ example: "variant-id" })
  id!: string;

  @ApiProperty({ example: 175 })
  mrp!: number;

  @ApiProperty({ example: "6 inch" })
  name!: string;

  @ApiProperty({ example: 140 })
  sellingPrice!: number;

  @ApiProperty({ example: "FORCEPS-001-6IN" })
  sku!: string;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  status!: ProductStatus;
}

export class ProductDocumentResponseDto {
  @ApiProperty({ example: "document-id" })
  id!: string;

  @ApiProperty({ example: "products/forceps/certificate.pdf" })
  fileKey!: string;

  @ApiProperty({
    example: "https://cdn.example.com/products/forceps/certificate.pdf"
  })
  fileUrl!: string;

  @ApiProperty({ example: "Sterility Certificate" })
  title!: string;

  @ApiProperty({ enum: ProductDocumentType, example: ProductDocumentType.CERTIFICATE })
  type!: ProductDocumentType;
}

export class ProductResponseDto {
  @ApiProperty({ example: 100 })
  basePrice!: number;

  @ApiProperty({ type: ProductBrandResponseDto })
  brand!: ProductBrandResponseDto;

  @ApiProperty({ example: "brand-id" })
  brandId!: string;

  @ApiProperty({ type: ProductCategoryResponseDto })
  category!: ProductCategoryResponseDto;

  @ApiProperty({ example: "category-id" })
  categoryId!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "Reusable artery forceps for operating rooms." })
  description!: string;

  @ApiProperty({ example: false })
  disposable!: boolean;

  @ApiProperty({ type: [ProductDocumentResponseDto] })
  documents!: ProductDocumentResponseDto[];

  @ApiProperty({ example: false })
  expirySensitive!: boolean;

  @ApiProperty({ example: "product-id" })
  id!: string;

  @ApiProperty({ type: [ProductImageResponseDto] })
  images!: ProductImageResponseDto[];

  @ApiProperty({ example: true })
  inStock!: boolean;

  @ApiProperty({ example: "Stainless steel" })
  material!: string | null;

  @ApiProperty({ example: "General Surgery" })
  medicalSpecialty!: string | null;

  @ApiProperty({ example: "Buy surgical forceps online." })
  metaDescription!: string | null;

  @ApiProperty({ example: "Surgical Forceps" })
  metaTitle!: string | null;

  @ApiProperty({ example: 150 })
  mrp!: number;

  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: "1 pc" })
  packSize!: string | null;

  @ApiProperty({ example: ["forceps", "artery"] })
  searchTags!: string[];

  @ApiProperty({ example: 120 })
  sellingPrice!: number;

  @ApiProperty({ example: "Curved artery forceps." })
  shortDescription!: string;

  @ApiProperty({ example: "FORCEPS-001" })
  sku!: string;

  @ApiProperty({ example: "curved-artery-forceps" })
  slug!: string;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  status!: ProductStatus;

  @ApiProperty({ example: true })
  sterile!: boolean;

  @ApiProperty({ example: 18 })
  taxRate!: number;

  @ApiProperty({ example: "piece" })
  unit!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;

  @ApiProperty({ type: [ProductVariantResponseDto] })
  variants!: ProductVariantResponseDto[];
}

export class ProductPaginationResponseDto {
  @ApiProperty({ example: true })
  hasNextPage!: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage!: boolean;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];

  @ApiProperty({ type: ProductPaginationResponseDto })
  pagination!: ProductPaginationResponseDto;
}
