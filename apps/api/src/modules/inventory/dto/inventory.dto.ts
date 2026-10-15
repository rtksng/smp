import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  NotEquals,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProductStatus, StockMovementType } from "../../../generated/prisma/enums";

export enum ReturnStockDisposition {
  QUARANTINE = "QUARANTINE",
  RESTOCK = "RESTOCK",
  SCRAP = "SCRAP"
}

/**
 * Position of one stock line. Out of stock: nothing available. Low stock: some
 * available but at or below the line's threshold. In stock: above the threshold.
 */
export enum InventoryStockStatus {
  IN_STOCK = "IN_STOCK",
  LOW_STOCK = "LOW_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK"
}

/** Why stock left the warehouse outside of an order or a transfer. */
export enum StockOutReason {
  DAMAGED = "DAMAGED",
  EXPIRED = "EXPIRED",
  INTERNAL_USE = "INTERNAL_USE",
  LOST = "LOST",
  OTHER = "OTHER",
  RETURNED_TO_SUPPLIER = "RETURNED_TO_SUPPLIER",
  SAMPLE = "SAMPLE"
}

const parseOptionalBoolean = ({ value }: { value: unknown }) => {
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
};

export class StockInDto {
  @ApiProperty({ example: "BATCH-2026-001" })
  @IsString()
  @Matches(/\S/, { message: "batchNumber must contain non-whitespace characters" })
  @MaxLength(120)
  batchNumber!: string;

  @ApiPropertyOptional({ example: "2026-12-31" })
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiProperty({ example: 150, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  mrp!: number;

  @ApiPropertyOptional({ example: "Initial procurement stock." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({ example: 90, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice!: number;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 120, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice!: number;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  variantId?: string | null;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  warehouseId!: string;
}

export class AdjustStockDto {
  @ApiProperty({ example: "BATCH-2026-001" })
  @IsString()
  @Matches(/\S/, { message: "batchNumber must contain non-whitespace characters" })
  @MaxLength(120)
  batchNumber!: string;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiProperty({ example: "Cycle count correction." })
  @IsString()
  @Matches(/\S/, { message: "reason must contain non-whitespace characters" })
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({
    description:
      "Signed adjustment quantity. Positive adds stock; negative removes stock.",
    example: -2
  })
  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  variantId?: string | null;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  warehouseId!: string;
}

/** Removes stock from one batch, for example damaged, expired, or sample units. */
export class StockOutDto {
  @ApiProperty({ example: "BATCH-2026-001" })
  @IsString()
  @Matches(/\S/, { message: "batchNumber must contain non-whitespace characters" })
  @MaxLength(120)
  batchNumber!: string;

  @ApiPropertyOptional({ example: "Two boxes crushed in transit." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: StockOutReason, example: StockOutReason.DAMAGED })
  @IsEnum(StockOutReason)
  reason!: StockOutReason;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  variantId?: string | null;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  warehouseId!: string;
}

export class TransferStockDto {
  @ApiProperty({ example: "BATCH-2026-001" })
  @IsString()
  @Matches(/\S/, { message: "batchNumber must contain non-whitespace characters" })
  @MaxLength(120)
  batchNumber!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  fromWarehouseId!: string;

  @ApiPropertyOptional({ example: "Transfer for regional demand." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  productId!: string;

  @ApiProperty({ example: 3, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  toWarehouseId!: string;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  variantId?: string | null;
}

export class InventoryListQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  productId?: string;

  @ApiPropertyOptional({ example: "forceps" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({
    description: "Stock lines in this position only.",
    enum: InventoryStockStatus,
    example: InventoryStockStatus.LOW_STOCK
  })
  @IsOptional()
  @IsEnum(InventoryStockStatus)
  stockStatus?: InventoryStockStatus;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  warehouseId?: string;
}

export class StockBatchListQueryDto {
  @ApiPropertyOptional({
    default: false,
    description: "Include batches that are down to zero units."
  })
  @Transform(parseOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  includeEmpty?: boolean;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  productId!: string;

  @ApiPropertyOptional({
    description: "Variant batches. Leave out for the base product.",
    example: "7d9f8f33-d348-4a89-94e8-907be76a91c6"
  })
  @IsOptional()
  @IsUUID("4")
  variantId?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  warehouseId!: string;
}

export class InventorySummaryQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: 365, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  warehouseId?: string;
}

export class NearExpiryQueryDto extends InventoryListQueryDto {
  @ApiPropertyOptional({ default: 30, maximum: 365, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class StockMovementQueryDto extends InventoryListQueryDto {
  @ApiPropertyOptional({ enum: StockMovementType, example: StockMovementType.IN })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}

export class InventoryStockResponseDto {
  @ApiProperty({ example: 10 })
  availableQuantity!: number;

  @ApiProperty({ example: "stock-id" })
  id!: string;

  @ApiProperty({ example: 5 })
  lowStockThreshold!: number;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: 0 })
  reservedQuantity!: number;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "warehouse-id" })
  warehouseId!: string;
}

export class InventoryProductRefResponseDto {
  @ApiProperty({ example: "product-id" })
  id!: string;

  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: "CAF-001" })
  sku!: string;
}

export class InventoryStockProductResponseDto extends InventoryProductRefResponseDto {
  @ApiProperty({ enum: ProductStatus, example: ProductStatus.ACTIVE })
  status!: ProductStatus;
}

export class InventoryStockVariantResponseDto {
  @ApiProperty({ example: "variant-id" })
  id!: string;

  @ApiProperty({ example: "Size 6" })
  name!: string;

  @ApiProperty({ example: "CAF-001-6" })
  sku!: string;
}

export class InventoryWarehouseResponseDto {
  @ApiProperty({ example: "MUM-01" })
  code!: string;

  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: "Mumbai Central Warehouse" })
  name!: string;
}

export class InventoryStockListItemResponseDto extends InventoryStockResponseDto {
  @ApiProperty({ type: InventoryStockProductResponseDto })
  product!: InventoryStockProductResponseDto;

  @ApiProperty({ enum: InventoryStockStatus, example: InventoryStockStatus.IN_STOCK })
  stockStatus!: InventoryStockStatus;

  @ApiProperty({ type: InventoryStockVariantResponseDto, nullable: true })
  variant!: InventoryStockVariantResponseDto | null;

  @ApiProperty({ type: InventoryWarehouseResponseDto })
  warehouse!: InventoryWarehouseResponseDto;
}

export class InventorySummaryResponseDto {
  @ApiProperty({ description: "Distinct products assigned to the warehouses in view.", example: 120 })
  assignedProducts!: number;

  @ApiProperty({ description: "Units available to sell.", example: 2400 })
  availableUnits!: number;

  @ApiProperty({ description: "Stock lines above their low-stock threshold.", example: 90 })
  inStockItems!: number;

  @ApiProperty({ description: "Stock lines with units, at or below their threshold.", example: 12 })
  lowStockItems!: number;

  @ApiProperty({ description: "Batches with units that expire inside the window.", example: 3 })
  nearExpiryBatches!: number;

  @ApiProperty({ example: 30 })
  nearExpiryDays!: number;

  @ApiProperty({ description: "Stock lines with no units available.", example: 4 })
  outOfStockItems!: number;

  @ApiProperty({ description: "Units held for open orders.", example: 80 })
  reservedUnits!: number;

  @ApiProperty({ description: "Product or variant stock lines across the warehouses in view.", example: 106 })
  trackedItems!: number;
}

export class ReturnDispositionItemDto {
  @ApiProperty({
    enum: ReturnStockDisposition,
    example: ReturnStockDisposition.RESTOCK
  })
  @IsEnum(ReturnStockDisposition)
  disposition!: ReturnStockDisposition;

  @ApiPropertyOptional({ example: "Outer packaging is damaged." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  orderItemId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReturnDispositionDto {
  @ApiProperty({ type: [ReturnDispositionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnDispositionItemDto)
  items!: ReturnDispositionItemDto[];

  @ApiPropertyOptional({ example: "Return inspection completed at receiving desk." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  orderId!: string;
}

export class StockBatchResponseDto {
  @ApiProperty({ example: "BATCH-2026-001" })
  batchNumber!: string;

  @ApiProperty({ example: "2026-12-31T00:00:00.000Z", nullable: true })
  expiryDate!: Date | null;

  @ApiProperty({ example: "batch-id" })
  id!: string;

  @ApiProperty({ example: 150 })
  mrp!: number;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: 90 })
  purchasePrice!: number;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: 120 })
  sellingPrice!: number;

  @ApiProperty({ example: "warehouse-id" })
  warehouseId!: string;
}

export class StockBatchListItemResponseDto extends StockBatchResponseDto {
  @ApiProperty({ type: InventoryProductRefResponseDto })
  product!: InventoryProductRefResponseDto;

  @ApiProperty({ type: InventoryStockVariantResponseDto, nullable: true })
  variant!: InventoryStockVariantResponseDto | null;

  @ApiProperty({ type: InventoryWarehouseResponseDto })
  warehouse!: InventoryWarehouseResponseDto;
}

export class StockMovementActorResponseDto {
  @ApiProperty({ example: "admin-id" })
  id!: string;

  @ApiProperty({ example: "Ravi Sharma" })
  name!: string;
}

export class StockMovementResponseDto {
  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "movement-id" })
  id!: string;

  @ApiProperty({ example: "Cycle count correction.", nullable: true })
  notes!: string | null;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: 3 })
  quantity!: number;

  @ApiProperty({ example: "transfer-id", nullable: true })
  referenceId!: string | null;

  @ApiProperty({ example: "STOCK_TRANSFER", nullable: true })
  referenceType!: string | null;

  @ApiProperty({ enum: StockMovementType, example: StockMovementType.IN })
  type!: StockMovementType;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "warehouse-id" })
  warehouseId!: string;
}

export class StockMovementListItemResponseDto extends StockMovementResponseDto {
  @ApiProperty({ example: "BATCH-2026-001", nullable: true })
  batchNumber!: string | null;

  @ApiProperty({ nullable: true, type: StockMovementActorResponseDto })
  createdBy!: StockMovementActorResponseDto | null;

  @ApiProperty({
    description: "Signed change to on-hand stock: positive for inward, negative for outward.",
    example: -3
  })
  netQuantity!: number;

  @ApiProperty({ type: InventoryProductRefResponseDto })
  product!: InventoryProductRefResponseDto;

  @ApiProperty({
    description: "Stock-out reason, or the disposition chosen for a returned item.",
    example: StockOutReason.DAMAGED,
    nullable: true
  })
  reason!: string | null;

  @ApiProperty({ type: InventoryStockVariantResponseDto, nullable: true })
  variant!: InventoryStockVariantResponseDto | null;

  @ApiProperty({ type: InventoryWarehouseResponseDto })
  warehouse!: InventoryWarehouseResponseDto;
}
