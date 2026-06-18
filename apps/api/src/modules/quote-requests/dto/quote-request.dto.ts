import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const QUOTE_REQUEST_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED"
] as const;
export const QUOTE_CUSTOMER_DECISIONS = ["ACCEPTED", "REJECTED"] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];
export type QuoteCustomerDecisionStatus = (typeof QUOTE_CUSTOMER_DECISIONS)[number];

export class CreateQuoteRequestDto {
  @ApiProperty({ example: "Dr Asha Rao" })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Asha Surgical Clinic", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  organization?: string | null;

  @ApiProperty({ example: "asha@example.com" })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: "+919876543210" })
  @IsString()
  @MaxLength(24)
  mobileNumber!: string;

  @ApiProperty({ example: "Need 20 forceps and 8 draping kits for Mumbai." })
  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class QuoteRequestItemDto {
  @ApiPropertyOptional({ example: "product-id", nullable: true })
  productId!: string | null;

  @ApiPropertyOptional({ example: "variant-id", nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: "FORCEPS-001" })
  sku!: string;

  @ApiProperty({ example: "Curved Artery Forceps" })
  name!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 140 })
  unitPrice!: number;

  @ApiProperty({ example: 18 })
  taxRate!: number;

  @ApiProperty({ example: 280 })
  lineSubtotal!: number;

  @ApiProperty({ example: 50.4 })
  taxAmount!: number;

  @ApiProperty({ example: 330.4 })
  lineTotal!: number;
}

export class QuoteRequestTotalsDto {
  @ApiProperty({ example: 500 })
  subtotal!: number;

  @ApiProperty({ example: 50.4 })
  taxTotal!: number;

  @ApiProperty({ example: 50 })
  shippingTotal!: number;

  @ApiProperty({ example: 600.4 })
  grandTotal!: number;
}

export class QuoteRequestQuotationDto {
  @ApiProperty({ type: [QuoteRequestItemDto] })
  items!: QuoteRequestItemDto[];

  @ApiProperty({ type: QuoteRequestTotalsDto })
  totals!: QuoteRequestTotalsDto;

  @ApiPropertyOptional({ example: "Prices valid for current stock.", nullable: true })
  notes!: string | null;

  @ApiPropertyOptional({ example: "2026-06-30", nullable: true })
  validUntil!: string | null;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  respondedAt!: string;
}

export class QuoteRequestCustomerDecisionDto {
  @ApiProperty({ enum: QUOTE_CUSTOMER_DECISIONS, example: "ACCEPTED" })
  status!: QuoteCustomerDecisionStatus;

  @ApiPropertyOptional({ example: "Please prepare this for checkout.", nullable: true })
  note!: string | null;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  decidedAt!: string;
}

export class QuoteRequestResponseDto {
  @ApiProperty({ example: "quote-request-id" })
  id!: string;

  @ApiProperty({ enum: QUOTE_REQUEST_STATUSES, example: "NEW" })
  status!: QuoteRequestStatus;

  @ApiProperty({ example: "2026-06-15T10:00:00.000Z" })
  createdAt!: Date;

  @ApiProperty({ example: "Dr Asha Rao" })
  name!: string;

  @ApiProperty({ example: "Asha Surgical Clinic", nullable: true })
  organization!: string | null;

  @ApiProperty({ example: "asha@example.com" })
  email!: string;

  @ApiProperty({ example: "+919876543210" })
  mobileNumber!: string;

  @ApiProperty({ example: "Need 20 forceps and 8 draping kits for Mumbai." })
  message!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: QuoteRequestQuotationDto
  })
  quotation!: QuoteRequestQuotationDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: QuoteRequestCustomerDecisionDto
  })
  customerDecision!: QuoteRequestCustomerDecisionDto | null;

  @ApiPropertyOptional({ example: "cart-id", nullable: true })
  convertedCartId!: string | null;

  @ApiPropertyOptional({ example: "order-id", nullable: true })
  convertedOrderId!: string | null;
}

export class QuoteRequestListQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, maximum: 100, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: QUOTE_REQUEST_STATUSES, example: "NEW" })
  @IsOptional()
  @IsIn(QUOTE_REQUEST_STATUSES)
  status?: QuoteRequestStatus;
}

export class QuoteRequestPaginationDto {
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

export class UpdateQuoteRequestStatusDto {
  @ApiProperty({ enum: QUOTE_REQUEST_STATUSES })
  @IsIn(QUOTE_REQUEST_STATUSES)
  status!: QuoteRequestStatus;
}

export class SendQuoteItemDto {
  @ApiPropertyOptional({ example: "product-id", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  productId?: string | null;

  @ApiPropertyOptional({ example: "variant-id", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  variantId?: string | null;

  @ApiProperty({ example: "FORCEPS-001" })
  @IsString()
  @MaxLength(120)
  sku!: string;

  @ApiProperty({ example: "Curved Artery Forceps" })
  @IsString()
  @MaxLength(240)
  name!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: 140, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 18, maximum: 100, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class SendQuoteResponseDto {
  @ApiProperty({ type: [SendQuoteItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SendQuoteItemDto)
  items!: SendQuoteItemDto[];

  @ApiPropertyOptional({ example: 50, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingTotal?: number;

  @ApiPropertyOptional({ example: "Prices valid for current stock." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsDateString()
  @IsOptional()
  validUntil?: string | null;
}

export class UpdateCustomerQuoteDecisionDto {
  @ApiProperty({ enum: QUOTE_CUSTOMER_DECISIONS, example: "ACCEPTED" })
  @IsIn(QUOTE_CUSTOMER_DECISIONS)
  decision!: QuoteCustomerDecisionStatus;

  @ApiPropertyOptional({ example: "Please prepare this for checkout." })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class QuoteRequestListResponseDto {
  @ApiProperty({ type: [QuoteRequestResponseDto] })
  items!: QuoteRequestResponseDto[];

  @ApiProperty({ type: QuoteRequestPaginationDto })
  pagination!: QuoteRequestPaginationDto;
}

export class QuoteConversionResponseDto {
  @ApiProperty({ type: QuoteRequestResponseDto })
  quote!: QuoteRequestResponseDto;

  @ApiProperty({ type: Object })
  cart!: unknown;
}

export class QuoteOrderConversionResponseDto {
  @ApiProperty({ type: QuoteRequestResponseDto })
  quote!: QuoteRequestResponseDto;

  @ApiProperty({ type: Object })
  order!: unknown;
}
