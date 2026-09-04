import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WarehouseStatus } from "../../../generated/prisma/enums";

export class CreateWarehouseDto {
  @ApiProperty({ example: "Plot 1, Surgical Park" })
  @IsString()
  @MaxLength(500)
  address!: string;

  @ApiProperty({ example: "Mumbai" })
  @IsString()
  @MaxLength(120)
  city!: string;

  @ApiProperty({
    description: "Unique warehouse code.",
    example: "MUM-01"
  })
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code!: string;

  @ApiProperty({ example: "9876543210" })
  @IsString()
  @Matches(/^[0-9+()\-\s]{8,20}$/)
  contactNumber!: string;

  @ApiProperty({ example: "Ravi Sharma" })
  @IsString()
  @MaxLength(120)
  contactPerson!: string;

  @ApiPropertyOptional({ example: 19.076, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ example: 72.8777, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiProperty({ example: "Mumbai Central Warehouse" })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: "400001" })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  pincode!: string;

  @ApiProperty({ example: "Maharashtra" })
  @IsString()
  @MaxLength(120)
  state!: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({ example: "Plot 1, Surgical Park" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: "Mumbai" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: "MUM-01" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  code?: string;

  @ApiPropertyOptional({ example: "9876543210" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{8,20}$/)
  contactNumber?: string;

  @ApiPropertyOptional({ example: "Ravi Sharma" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @ApiPropertyOptional({ example: 19.076, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @ApiPropertyOptional({ example: 72.8777, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @ApiPropertyOptional({ example: "Mumbai Central Warehouse" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: "400001" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/)
  pincode?: string;

  @ApiPropertyOptional({ example: "Maharashtra" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;
}

export class WarehouseListQueryDto {
  @ApiPropertyOptional({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsOptional()
  @IsUUID("4")
  warehouseId?: string;

  @ApiPropertyOptional({ example: "Mumbai" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

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

  @ApiPropertyOptional({ example: "mumbai" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ example: "Maharashtra" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ enum: WarehouseStatus, example: WarehouseStatus.ACTIVE })
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;
}

export class AssignWarehouseStaffDto {
  @ApiProperty({ example: "7d9f8f33-d348-4a89-94e8-907be76a91c6" })
  @IsUUID("4")
  adminUserId!: string;
}

export class WarehouseResponseDto {
  @ApiProperty({ example: "Plot 1, Surgical Park" })
  address!: string;

  @ApiProperty({ example: "Mumbai" })
  city!: string;

  @ApiProperty({ example: "MUM-01" })
  code!: string;

  @ApiProperty({ example: "9876543210" })
  contactNumber!: string;

  @ApiProperty({ example: "Ravi Sharma" })
  contactPerson!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "warehouse-id" })
  id!: string;

  @ApiProperty({ example: 19.076, nullable: true })
  latitude!: number | null;

  @ApiProperty({ example: 72.8777, nullable: true })
  longitude!: number | null;

  @ApiProperty({ example: "Mumbai Central Warehouse" })
  name!: string;

  @ApiProperty({ example: "400001" })
  pincode!: string;

  @ApiProperty({ example: "Maharashtra" })
  state!: string;

  @ApiProperty({ enum: WarehouseStatus, example: WarehouseStatus.ACTIVE })
  status!: WarehouseStatus;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class WarehousePaginationResponseDto {
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

export class WarehouseListResponseDto {
  @ApiProperty({ type: [WarehouseResponseDto] })
  items!: WarehouseResponseDto[];

  @ApiProperty({ type: WarehousePaginationResponseDto })
  pagination!: WarehousePaginationResponseDto;
}

export class WarehouseStaffResponseDto {
  @ApiProperty({ example: "assignment-id" })
  id!: string;

  @ApiProperty({ example: "admin-id" })
  adminUserId!: string;

  @ApiProperty({ example: "admin@example.com" })
  email!: string;

  @ApiProperty({ example: "Ravi" })
  firstName!: string;

  @ApiProperty({ example: "Sharma", nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: "warehouse-id" })
  warehouseId!: string;
}
