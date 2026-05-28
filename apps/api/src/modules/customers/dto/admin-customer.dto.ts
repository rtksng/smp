import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

export class AdminCustomerListQueryDto {
  @ApiPropertyOptional({
    description: "Filter by active/inactive customer account state.",
    example: true
  })
  @Transform(({ value }: { value: unknown }) => parseOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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

  @ApiPropertyOptional({
    description:
      "Search customer name, mobile number, email, business name, or GSTIN.",
    example: "asha"
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class AdminCustomerResponseDto {
  @ApiProperty({ example: 2 })
  addressCount!: number;

  @ApiProperty({ example: "Asha Surgical Clinic", nullable: true })
  businessName!: string | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "asha@example.com", nullable: true })
  email!: string | null;

  @ApiProperty({ example: "27ABCDE1234F1Z5", nullable: true })
  gstNumber!: string | null;

  @ApiProperty({ example: "customer-id" })
  id!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "Asha Rao" })
  name!: string;

  @ApiProperty({ example: 3 })
  orderCount!: number;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  updatedAt!: Date;
}

export class AdminCustomerPaginationResponseDto {
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

export class AdminCustomerListResponseDto {
  @ApiProperty({ type: [AdminCustomerResponseDto] })
  items!: AdminCustomerResponseDto[];

  @ApiProperty({ type: AdminCustomerPaginationResponseDto })
  pagination!: AdminCustomerPaginationResponseDto;
}
