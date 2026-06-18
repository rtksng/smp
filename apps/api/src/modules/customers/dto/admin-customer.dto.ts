import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CustomerStatus } from "../../../generated/prisma/enums";

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

  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

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

export class AdminCustomerAddressResponseDto {
  @ApiProperty({ example: "Mumbai" })
  city!: string;

  @ApiProperty({ example: "India" })
  country!: string;

  @ApiProperty({ example: "Asha Rao" })
  fullName!: string;

  @ApiProperty({ example: "address-id" })
  id!: string;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ example: "Clinic road" })
  line1!: string;

  @ApiProperty({ example: "Near main market", nullable: true })
  line2!: string | null;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "400001" })
  pincode!: string;

  @ApiProperty({ example: "Maharashtra" })
  state!: string;

  @ApiProperty({ example: "SHIPPING" })
  type!: string;
}

export class AdminCustomerOrderSummaryResponseDto {
  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: 1250 })
  grandTotal!: number;

  @ApiProperty({ example: "order-id" })
  id!: string;

  @ApiProperty({ example: "ORD-20260525-ABCD1234" })
  orderNumber!: string;

  @ApiProperty({ example: "PAID" })
  paymentStatus!: string;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z", nullable: true })
  placedAt!: Date | null;

  @ApiProperty({ example: "DELIVERED" })
  status!: string;
}

export class AdminCustomerSupportNoteResponseDto {
  @ApiProperty({ example: "admin-id", nullable: true })
  adminUserId!: string | null;

  @ApiProperty({ example: "Support Agent", nullable: true })
  adminName!: string | null;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "note-id" })
  id!: string;

  @ApiProperty({ example: "Customer requested a callback." })
  note!: string;
}

export class AdminCustomerDetailResponseDto extends AdminCustomerResponseDto {
  @ApiProperty({ type: [AdminCustomerAddressResponseDto] })
  addresses!: AdminCustomerAddressResponseDto[];

  @ApiProperty({ type: [AdminCustomerOrderSummaryResponseDto] })
  orders!: AdminCustomerOrderSummaryResponseDto[];

  @ApiProperty({ type: [AdminCustomerSupportNoteResponseDto] })
  supportNotes!: AdminCustomerSupportNoteResponseDto[];
}

export class UpdateCustomerStatusDto {
  @ApiPropertyOptional({
    description: "Optional support note explaining the status change.",
    example: "Repeated failed payment abuse."
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ enum: CustomerStatus, example: CustomerStatus.BLOCKED })
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}

export class AddCustomerSupportNoteDto {
  @ApiProperty({ example: "Customer requested a callback." })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}
