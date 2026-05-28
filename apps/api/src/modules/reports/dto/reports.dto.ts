import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DashboardReportQueryDto {
  @ApiPropertyOptional({ example: "2026-05-01" })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-05-26" })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ default: 30, maximum: 365, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Max(365)
  @Min(1)
  nearExpiryDays?: number;

  @ApiPropertyOptional({ example: "2a5d29bc-8dc8-4de0-87d0-e4e6042ce5cc" })
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class DashboardCardsResponseDto {
  @ApiProperty({ example: 42 })
  activeCustomers!: number;

  @ApiProperty({ example: 8 })
  activeDeliveryPartners!: number;

  @ApiProperty({ example: 3 })
  activeWarehouses!: number;

  @ApiProperty({ example: 5 })
  lowStockProducts!: number;

  @ApiProperty({ example: 2 })
  nearExpiryBatches!: number;

  @ApiProperty({ example: 12 })
  pendingOrders!: number;

  @ApiProperty({ example: 128520.25 })
  revenue!: number;

  @ApiProperty({ example: 4 })
  todayOrders!: number;

  @ApiProperty({ example: 64 })
  totalOrders!: number;
}

export class TimeSeriesOrdersResponseDto {
  @ApiProperty({ example: "2026-05-01" })
  date!: string;

  @ApiProperty({ example: 7 })
  orders!: number;
}

export class TimeSeriesRevenueResponseDto {
  @ApiProperty({ example: "2026-05-01" })
  date!: string;

  @ApiProperty({ example: 8520.5 })
  revenue!: number;
}

export class TopSellingProductResponseDto {
  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  productId!: string;

  @ApiProperty({ example: 18 })
  quantity!: number;

  @ApiProperty({ example: 21600 })
  revenue!: number;

  @ApiProperty({ example: "FORCEPS-001" })
  sku!: string;
}

export class StockAlertResponseDto {
  @ApiProperty({ example: 4 })
  lowStockProducts!: number;

  @ApiProperty({ example: 2 })
  nearExpiryBatches!: number;

  @ApiProperty({ example: "DEL-01" })
  warehouseCode!: string;

  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  warehouseId!: string;

  @ApiProperty({ example: "Delhi warehouse" })
  warehouseName!: string;
}

export class WarehouseStockSummaryResponseDto extends StockAlertResponseDto {
  @ApiProperty({ example: 8 })
  activeBatches!: number;

  @ApiProperty({ example: 120 })
  availableQuantity!: number;

  @ApiProperty({ example: 14 })
  reservedQuantity!: number;
}

export class DashboardChartsResponseDto {
  @ApiProperty({ type: [TimeSeriesOrdersResponseDto] })
  ordersByDay!: TimeSeriesOrdersResponseDto[];

  @ApiProperty({ type: [TimeSeriesRevenueResponseDto] })
  revenueByDay!: TimeSeriesRevenueResponseDto[];

  @ApiProperty({ type: [StockAlertResponseDto] })
  stockAlerts!: StockAlertResponseDto[];

  @ApiProperty({ type: [TopSellingProductResponseDto] })
  topSellingProducts!: TopSellingProductResponseDto[];

  @ApiProperty({ type: [WarehouseStockSummaryResponseDto] })
  warehouseStockSummary!: WarehouseStockSummaryResponseDto[];
}

export class DashboardReportResponseDto {
  @ApiProperty({ type: DashboardCardsResponseDto })
  cards!: DashboardCardsResponseDto;

  @ApiProperty({ type: DashboardChartsResponseDto })
  charts!: DashboardChartsResponseDto;
}
