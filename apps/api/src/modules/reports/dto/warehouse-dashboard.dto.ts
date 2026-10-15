import { IsDateString, IsOptional, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InventorySummaryResponseDto } from "../../inventory/dto/inventory.dto";
import { DispatchQueueOrderResponseDto } from "../../delivery/dto/delivery.dto";

export class WarehouseDashboardQueryDto {
  @ApiPropertyOptional({
    description: "Fulfillment window start. Defaults to 30 days before dateTo.",
    example: "2026-09-16"
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Fulfillment window end. Defaults to today.", example: "2026-10-15" })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    description: "One of the admin's warehouses. Leave out for all of them.",
    example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc"
  })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class WarehouseDashboardWarehouseDto {
  @ApiProperty({ example: "Mumbai" })
  city!: string;

  @ApiProperty({ example: "MUM-01" })
  code!: string;

  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: "Mumbai Central Warehouse" })
  name!: string;

  @ApiProperty({ example: "Maharashtra" })
  state!: string;

  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"], example: "ACTIVE" })
  status!: string;
}

export class WarehouseDashboardDispatchDto {
  @ApiProperty({ description: "Assignments not yet picked up.", example: 3 })
  awaitingPickup!: number;

  @ApiProperty({ example: 12 })
  deliveredToday!: number;

  @ApiProperty({ example: 1 })
  failedToday!: number;

  @ApiProperty({ description: "Picked up or out for delivery.", example: 5 })
  inTransit!: number;

  @ApiProperty({ example: "2026-10-14T08:30:00.000Z", nullable: true })
  oldestReadySince!: Date | null;

  @ApiProperty({ description: "Confirmed or packed orders without a partner.", example: 7 })
  readyToDispatch!: number;
}

export class WarehouseDashboardRidersDto {
  @ApiProperty({ description: "Active partners linked to the warehouses in view.", example: 9 })
  assigned!: number;

  @ApiProperty({ description: "Online and not carrying a delivery.", example: 3 })
  available!: number;

  @ApiProperty({ description: "Carrying a delivery from these warehouses.", example: 4 })
  onDelivery!: number;

  @ApiProperty({ example: 7 })
  online!: number;
}

export class WarehouseDashboardFulfillmentDto {
  @ApiProperty({ example: 4 })
  cancelled!: number;

  @ApiProperty({ description: "Delivered, including orders later returned.", example: 80 })
  delivered!: number;

  @ApiProperty({ description: "Delivery attempts that finished, delivered or failed.", example: 86 })
  deliveryAttempts!: number;

  @ApiProperty({
    description: "Delivered attempts as a percentage of finished attempts.",
    example: 93.0,
    nullable: true
  })
  deliverySuccessRate!: number | null;

  @ApiProperty({
    description: "Delivered orders as a percentage of completed orders (delivered or cancelled).",
    example: 95.2,
    nullable: true
  })
  fulfillmentRate!: number | null;

  @ApiProperty({ description: "Still moving through the warehouse.", example: 12 })
  inProgress!: number;

  @ApiProperty({ description: "Orders placed in the window.", example: 96 })
  ordersPlaced!: number;
}

export class WarehouseDashboardLowStockItemDto {
  @ApiProperty({ example: 2 })
  availableQuantity!: number;

  @ApiProperty({ example: "stock-id" })
  id!: string;

  @ApiProperty({ example: 5 })
  lowStockThreshold!: number;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: "Curved Artery Forceps" })
  productName!: string;

  @ApiProperty({ example: "CAF-001" })
  sku!: string;

  @ApiProperty({ enum: ["LOW_STOCK", "OUT_OF_STOCK"], example: "LOW_STOCK" })
  status!: string;

  @ApiProperty({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "Size 6", nullable: true })
  variantName!: string | null;

  @ApiProperty({ example: "warehouse-id" })
  warehouseId!: string;

  @ApiProperty({ example: "Mumbai Central Warehouse" })
  warehouseName!: string;
}

export class WarehouseDashboardDeliveryDto {
  @ApiProperty({ example: "2026-10-15T09:10:00.000Z" })
  assignedAt!: Date;

  @ApiProperty({ example: "assignment-id" })
  id!: string;

  @ApiProperty({ example: "order-id" })
  orderId!: string;

  @ApiProperty({ example: "ORD-20261015-0003" })
  orderNumber!: string;

  @ApiProperty({ example: "+919876543210" })
  partnerMobile!: string;

  @ApiProperty({ example: "Vikram Singh" })
  partnerName!: string;

  @ApiProperty({ example: "OUT_FOR_DELIVERY" })
  status!: string;

  @ApiProperty({ example: "2026-10-15T10:02:00.000Z" })
  updatedAt!: Date;

  @ApiProperty({ example: "Mumbai Central Warehouse", nullable: true })
  warehouseName!: string | null;
}

export class WarehouseDashboardRiderDto {
  @ApiProperty({ example: 1 })
  activeDeliveries!: number;

  @ApiProperty({ example: "Vikram Singh" })
  fullName!: string;

  @ApiProperty({ example: "partner-id" })
  id!: string;

  @ApiProperty({ example: true })
  isOnline!: boolean;

  @ApiProperty({ example: "2026-10-15T10:02:00.000Z", nullable: true })
  lastSeenAt!: Date | null;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "MH01AB1234", nullable: true })
  vehicleNumber!: string | null;
}

export class WarehouseDashboardQueuesDto {
  @ApiProperty({ type: [WarehouseDashboardDeliveryDto] })
  activeDeliveries!: WarehouseDashboardDeliveryDto[];

  @ApiProperty({ description: "Oldest orders waiting for a partner.", type: [DispatchQueueOrderResponseDto] })
  dispatch!: DispatchQueueOrderResponseDto[];

  @ApiProperty({ description: "Lowest stock lines first.", type: [WarehouseDashboardLowStockItemDto] })
  lowStock!: WarehouseDashboardLowStockItemDto[];

  @ApiProperty({ description: "Online riders first.", type: [WarehouseDashboardRiderDto] })
  riders!: WarehouseDashboardRiderDto[];
}

export class WarehouseDashboardFiltersDto {
  @ApiProperty({ example: "2026-09-16" })
  dateFrom!: string;

  @ApiProperty({ example: "2026-10-15" })
  dateTo!: string;

  @ApiProperty({ example: "warehouse-id", nullable: true })
  warehouseId!: string | null;
}

export class WarehouseDashboardResponseDto {
  @ApiProperty({ type: WarehouseDashboardDispatchDto })
  dispatch!: WarehouseDashboardDispatchDto;

  @ApiProperty({ type: WarehouseDashboardFiltersDto })
  filters!: WarehouseDashboardFiltersDto;

  @ApiProperty({ type: WarehouseDashboardFulfillmentDto })
  fulfillment!: WarehouseDashboardFulfillmentDto;

  @ApiProperty({ example: "2026-10-15T10:05:00.000Z" })
  generatedAt!: string;

  @ApiProperty({ type: WarehouseDashboardQueuesDto })
  queues!: WarehouseDashboardQueuesDto;

  @ApiProperty({ type: WarehouseDashboardRidersDto })
  riders!: WarehouseDashboardRidersDto;

  @ApiProperty({ type: InventorySummaryResponseDto })
  stock!: InventorySummaryResponseDto;

  @ApiProperty({ example: "2026-10-15" })
  todayDate!: string;

  @ApiProperty({
    description: "The warehouse in view when exactly one is selected or assigned.",
    nullable: true,
    type: WarehouseDashboardWarehouseDto
  })
  warehouse!: WarehouseDashboardWarehouseDto | null;

  @ApiProperty({ type: [WarehouseDashboardWarehouseDto] })
  warehouseOptions!: WarehouseDashboardWarehouseDto[];
}
