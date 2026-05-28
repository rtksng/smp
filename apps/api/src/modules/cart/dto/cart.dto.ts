import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProductStatus } from "../../../generated/prisma/enums";

export class AddCartItemDto {
  @ApiProperty({
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: 2,
    maximum: 999,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @ApiPropertyOptional({
    example: "9a14198b-e4bc-44bc-9d3a-e4e3d640a19a",
    nullable: true
  })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;
}

export class UpdateCartItemDto {
  @ApiProperty({
    example: 3,
    maximum: 999,
    minimum: 1
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;
}

export class CartTotalsResponseDto {
  @ApiProperty({ example: 0 })
  deliveryCharge!: number;

  @ApiProperty({ example: 0 })
  discount!: number;

  @ApiProperty({ example: 330.4 })
  grandTotal!: number;

  @ApiProperty({ example: 280 })
  subtotal!: number;

  @ApiProperty({ example: 50.4 })
  tax!: number;
}

export class CartItemResponseDto {
  @ApiProperty({ example: 5 })
  availableQuantity!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "cart-item-id" })
  id!: string;

  @ApiProperty({ example: "https://cdn.example.com/products/forceps/main.jpg", nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  productStatus!: ProductStatus;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: "curved-artery-forceps" })
  slug!: string;

  @ApiProperty({ example: "FORCEPS-001-6IN" })
  sku!: string;

  @ApiProperty({ example: 280 })
  subtotal!: number;

  @ApiProperty({ example: 50.4 })
  tax!: number;

  @ApiProperty({ example: 18 })
  taxRate!: number;

  @ApiProperty({ example: 330.4 })
  total!: number;

  @ApiProperty({ example: 140 })
  unitPrice!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "6 inch", nullable: true })
  variantName!: string | null;

  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE, nullable: true })
  variantStatus!: ProductStatus | null;
}

export class CartResponseDto {
  @ApiProperty({ example: "cart-id" })
  id!: string;

  @ApiProperty({ example: 1 })
  itemCount!: number;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty({ type: CartTotalsResponseDto })
  totals!: CartTotalsResponseDto;

  @ApiProperty({ example: 2 })
  totalQuantity!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}
