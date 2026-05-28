import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

export enum InvoiceFormat {
  Html = "html",
  Json = "json",
  Pdf = "pdf"
}

export class InvoiceFormatQueryDto {
  @ApiPropertyOptional({
    enum: InvoiceFormat,
    example: InvoiceFormat.Json
  })
  @IsEnum(InvoiceFormat)
  @IsOptional()
  format?: InvoiceFormat;
}

export class InvoiceCustomerResponseDto {
  @ApiPropertyOptional({ example: "Ritika Surgical Clinic", nullable: true })
  businessName!: string | null;

  @ApiPropertyOptional({ example: "ritika@example.com", nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ example: "27ABCDE1234F1Z5", nullable: true })
  gstNumber!: string | null;

  @ApiProperty({ example: "9999999999" })
  mobileNumber!: string;

  @ApiProperty({ example: "Ritika Singh" })
  name!: string;
}

export class InvoiceBillingResponseDto {
  @ApiProperty({ example: "Clinic Road, Mumbai, Maharashtra 400001, India" })
  address!: string;

  @ApiProperty({ example: "Ritika Singh" })
  name!: string;

  @ApiProperty({ example: "Maharashtra" })
  placeOfSupply!: string;
}

export class InvoiceItemResponseDto {
  @ApiProperty({ example: 18 })
  cgstAmount!: number;

  @ApiProperty({ example: 9 })
  cgstRate!: number;

  @ApiProperty({ example: "Curved Artery Forceps" })
  description!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  hsnCode!: string | null;

  @ApiProperty({ example: "invoice-item-id" })
  id!: string;

  @ApiProperty({ example: 0 })
  igstAmount!: number;

  @ApiProperty({ example: 0 })
  igstRate!: number;

  @ApiProperty({ example: "order-item-id", nullable: true })
  orderItemId!: string | null;

  @ApiProperty({ example: "product-id" })
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: 18 })
  sgstAmount!: number;

  @ApiProperty({ example: 9 })
  sgstRate!: number;

  @ApiProperty({ example: "FORCEPS-001" })
  sku!: string;

  @ApiProperty({ example: 200 })
  taxableValue!: number;

  @ApiProperty({ example: 36 })
  taxAmount!: number;

  @ApiProperty({ example: 18 })
  taxRate!: number;

  @ApiProperty({ example: 236 })
  total!: number;

  @ApiProperty({ example: 100 })
  unitPrice!: number;
}

export class InvoiceTaxBreakupResponseDto {
  @ApiProperty({ example: 18 })
  cgst!: number;

  @ApiProperty({ example: 0 })
  igst!: number;

  @ApiProperty({ example: 18 })
  sgst!: number;

  @ApiProperty({ example: "CGST_SGST" })
  taxType!: string;
}

export class InvoiceTotalsResponseDto {
  @ApiProperty({ example: 236 })
  grandTotal!: number;

  @ApiProperty({ example: 200 })
  subtotal!: number;

  @ApiProperty({ example: 36 })
  tax!: number;
}

export class InvoicePdfResponseDto {
  @ApiProperty({ example: false })
  available!: boolean;

  @ApiProperty({
    example: "PDF generation is reserved for the async invoice worker."
  })
  message!: string;

  @ApiProperty({ example: "NOT_GENERATED" })
  status!: string;
}

export class InvoiceResponseDto {
  @ApiProperty({ type: InvoiceBillingResponseDto })
  billing!: InvoiceBillingResponseDto;

  @ApiProperty({ type: InvoiceCustomerResponseDto })
  customer!: InvoiceCustomerResponseDto;

  @ApiProperty({ example: "Maharashtra" })
  destinationState!: string;

  @ApiProperty({ example: "<!doctype html><html>..." })
  html!: string;

  @ApiProperty({ example: "invoice-id" })
  id!: string;

  @ApiProperty({ example: "INV-20260525-ABC12345" })
  invoiceNumber!: string;

  @ApiProperty({ type: [InvoiceItemResponseDto] })
  items!: InvoiceItemResponseDto[];

  @ApiProperty({ example: "ORD-20260525-ABC12345" })
  orderNumber!: string;

  @ApiProperty({ example: "order-id" })
  orderId!: string;

  @ApiProperty({ type: InvoicePdfResponseDto })
  pdf!: InvoicePdfResponseDto;

  @ApiPropertyOptional({ example: "Maharashtra", nullable: true })
  sourceState!: string | null;

  @ApiProperty({ type: InvoiceTaxBreakupResponseDto })
  taxBreakup!: InvoiceTaxBreakupResponseDto;

  @ApiProperty({ type: InvoiceTotalsResponseDto })
  totals!: InvoiceTotalsResponseDto;

  @ApiProperty({ example: "2026-05-25T10:00:00.000Z" })
  issuedAt!: Date;
}
